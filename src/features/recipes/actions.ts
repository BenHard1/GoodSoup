"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { RECIPE_IMAGES_BUCKET } from "./queries";
import { categoryNameSchema, recipeFieldErrors, recipePayloadSchema, reportSchema, slugify } from "./schemas";

const uuid = z.uuid();

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  return user;
}

type DbError = { message?: string; code?: string } | null;

/** Message lisible depuis une erreur SQL : nos exceptions métier sont en français, le reste reste générique. */
function dbMessage(error: DbError, fallback: string) {
  if (!error) return fallback;
  if (error.code === "P0001" || error.code === "42501" || error.code === "PT409") return error.message ?? fallback;
  if (error.code === "23514") return "Certaines valeurs sont hors limites. Vérifie le formulaire.";
  return fallback;
}

function revalidateRecipes(id?: string) {
  revalidatePath("/recettes");
  revalidatePath("/decouvrir");
  revalidatePath("/accueil");
  if (id) revalidatePath(`/recettes/${id}`);
}

// ---------------------------------------------------------------------------
// Enregistrement
// ---------------------------------------------------------------------------

export type SaveRecipeResult =
  | { status: "success"; recipeId: string; updatedAt: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string[]>; conflict?: boolean };

/**
 * Crée ou modifie une recette en une seule transaction (fonction SQL save_recipe).
 * Appelée directement par le formulaire client, qui garde son brouillon tant que le succès n'est pas confirmé.
 */
export async function saveRecipe(input: unknown): Promise<SaveRecipeResult> {
  await requireUser();
  const parsed = recipePayloadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Certains champs sont à corriger.",
      fieldErrors: recipeFieldErrors(parsed.error),
    };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_recipe", { p: parsed.data });
  if (error) {
    return {
      status: "error",
      message: dbMessage(error, "L'enregistrement a échoué. Ton brouillon est conservé : réessaie."),
      conflict: error.code === "PT409",
    };
  }
  const recipeId = data as string;
  const { data: row } = await supabase.from("recipes").select("updated_at").eq("id", recipeId).single();
  revalidateRecipes(recipeId);
  return { status: "success", recipeId, updatedAt: (row?.updated_at as string) ?? "" };
}

export async function deleteRecipe(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = uuid.safeParse(formData.get("recipeId"));
  if (!id.success) return fail("Recette invalide.");
  const supabase = await createClient();
  const { data: recipe } = await supabase.from("recipes").select("owner_id").eq("id", id.data).maybeSingle();
  if (!recipe || recipe.owner_id !== user.id) return fail("Seul l'auteur peut supprimer cette recette.");

  // Photos d'abord : une fois la recette supprimée, plus personne n'aurait le droit de les effacer.
  const { data: images } = await supabase.from("recipe_images").select("storage_path").eq("recipe_id", id.data);
  const paths = (images ?? []).map((i) => i.storage_path as string);
  if (paths.length) {
    const { error } = await supabase.storage.from(RECIPE_IMAGES_BUCKET).remove(paths);
    if (error) return fail("Les photos n'ont pas pu être supprimées. Réessaie.");
  }
  const { error } = await supabase.from("recipes").delete().eq("id", id.data);
  if (error) return fail("La suppression a échoué. Réessaie.");
  revalidateRecipes();
  redirect("/recettes?supprimee=1");
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

const imagePathSchema = z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webp|jpg|jpeg|png)$/);

/** Enregistre une photo déjà envoyée dans le stockage (le navigateur l'a compressée et envoyée). */
export async function registerRecipeImage(input: {
  recipeId: string;
  path: string;
  width?: number;
  height?: number;
}): Promise<ActionState> {
  await requireUser();
  const recipeId = uuid.safeParse(input.recipeId);
  const path = imagePathSchema.safeParse(input.path);
  if (!recipeId.success || !path.success || !path.data.startsWith(`${recipeId.data}/`)) {
    return fail("Photo invalide.");
  }
  const supabase = await createClient();
  const { count } = await supabase
    .from("recipe_images")
    .select("id", { count: "exact", head: true })
    .eq("recipe_id", recipeId.data);
  const dim = (v?: number) => (v && Number.isInteger(v) && v > 0 && v <= 10000 ? v : null);
  const { error } = await supabase.from("recipe_images").insert({
    recipe_id: recipeId.data,
    storage_path: path.data,
    position: count ?? 0,
    width: dim(input.width),
    height: dim(input.height),
  });
  if (error) {
    // Pas d'image orpheline dans le stockage.
    await supabase.storage.from(RECIPE_IMAGES_BUCKET).remove([path.data]);
    return fail(dbMessage(error, "La photo n'a pas pu être enregistrée."));
  }
  revalidateRecipes(recipeId.data);
  return ok();
}

export async function deleteRecipeImage(imageId: string): Promise<ActionState> {
  await requireUser();
  const id = uuid.safeParse(imageId);
  if (!id.success) return fail("Photo invalide.");
  const supabase = await createClient();
  const { data: image } = await supabase
    .from("recipe_images")
    .select("recipe_id, storage_path")
    .eq("id", id.data)
    .maybeSingle();
  if (!image) return fail("Photo introuvable.");
  const { error: storageError } = await supabase.storage
    .from(RECIPE_IMAGES_BUCKET)
    .remove([image.storage_path as string]);
  if (storageError) return fail("La photo n'a pas pu être supprimée.");
  const { error } = await supabase.from("recipe_images").delete().eq("id", id.data);
  if (error) return fail("La photo n'a pas pu être supprimée.");
  revalidateRecipes(image.recipe_id as string);
  return ok();
}

export async function setRecipeCover(recipeId: string, imageId: string): Promise<ActionState> {
  await requireUser();
  if (!uuid.safeParse(recipeId).success || !uuid.safeParse(imageId).success) return fail("Photo invalide.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .update({ cover_image_id: imageId })
    .eq("id", recipeId)
    .select("id");
  if (error || !data?.length) return fail("Impossible de changer la photo principale.");
  revalidateRecipes(recipeId);
  return ok();
}

// ---------------------------------------------------------------------------
// Favoris, note personnelle, appréciation
// ---------------------------------------------------------------------------

export async function toggleFavorite(recipeId: string, favorite: boolean): Promise<ActionState> {
  const user = await requireUser();
  if (!uuid.safeParse(recipeId).success) return fail("Recette invalide.");
  const supabase = await createClient();
  const { error } = favorite
    ? await supabase.from("favorites").upsert({ user_id: user.id, recipe_id: recipeId }, { ignoreDuplicates: true })
    : await supabase.from("favorites").delete().eq("user_id", user.id).eq("recipe_id", recipeId);
  if (error) return fail("Impossible de mettre à jour tes favoris.");
  revalidateRecipes(recipeId);
  return ok();
}

export async function saveRecipeNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const recipeId = uuid.safeParse(formData.get("recipeId"));
  const body = z
    .string()
    .trim()
    .max(5000, { error: "5000 caractères maximum." })
    .safeParse(formData.get("body") ?? "");
  if (!recipeId.success) return fail("Recette invalide.");
  if (!body.success) return fail("Note trop longue.", { body: z.flattenError(body.error).formErrors });
  const supabase = await createClient();
  const { error } = body.data
    ? await supabase
        .from("recipe_notes")
        .upsert({ user_id: user.id, recipe_id: recipeId.data, body: body.data }, { onConflict: "user_id,recipe_id" })
    : await supabase.from("recipe_notes").delete().eq("user_id", user.id).eq("recipe_id", recipeId.data);
  if (error) return fail("La note n'a pas pu être enregistrée.");
  revalidatePath(`/recettes/${recipeId.data}`);
  return ok(body.data ? "Note enregistrée." : "Note effacée.");
}

export async function rateRecipe(recipeId: string, rating: number | null): Promise<ActionState> {
  const user = await requireUser();
  if (!uuid.safeParse(recipeId).success) return fail("Recette invalide.");
  const supabase = await createClient();
  if (rating === null) {
    await supabase.from("recipe_ratings").delete().eq("user_id", user.id).eq("recipe_id", recipeId);
  } else {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return fail("Note invalide.");
    const { error } = await supabase
      .from("recipe_ratings")
      .upsert({ user_id: user.id, recipe_id: recipeId, rating }, { onConflict: "user_id,recipe_id" });
    if (error) return fail("Impossible d'enregistrer ton avis.");
  }
  revalidatePath(`/recettes/${recipeId}`);
  return ok();
}

// ---------------------------------------------------------------------------
// Copie personnelle
// ---------------------------------------------------------------------------

export async function copyRecipe(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const sourceId = uuid.safeParse(formData.get("recipeId"));
  if (!sourceId.success) return fail("Recette invalide.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("copy_recipe", { p_source_id: sourceId.data });
  if (error) return fail(dbMessage(error, "La copie a échoué. Réessaie."));
  const newId = data as string;

  // Les photos sont dupliquées : la copie reste complète même si l'original est supprimé.
  const { data: images } = await supabase
    .from("recipe_images")
    .select("id, storage_path, position, alt_text, width, height")
    .eq("recipe_id", sourceId.data)
    .order("position");
  const { data: source } = await supabase.from("recipes").select("cover_image_id").eq("id", sourceId.data).single();
  let failed = 0;
  for (const img of images ?? []) {
    const ext = String(img.storage_path).split(".").pop() ?? "webp";
    const dest = `${newId}/${randomUUID()}.${ext}`;
    const { error: copyError } = await supabase.storage
      .from(RECIPE_IMAGES_BUCKET)
      .copy(img.storage_path as string, dest);
    if (copyError) {
      failed++;
      continue;
    }
    const { data: inserted, error: insertError } = await supabase
      .from("recipe_images")
      .insert({
        recipe_id: newId,
        storage_path: dest,
        position: img.position,
        alt_text: img.alt_text,
        width: img.width,
        height: img.height,
      })
      .select("id")
      .single();
    if (insertError) {
      failed++;
      await supabase.storage.from(RECIPE_IMAGES_BUCKET).remove([dest]);
    } else if (img.id === source?.cover_image_id) {
      await supabase.from("recipes").update({ cover_image_id: inserted.id }).eq("id", newId);
    }
  }
  revalidateRecipes(newId);
  redirect(`/recettes/${newId}?copiee=1${failed ? `&photos_manquantes=${failed}` : ""}`);
}

// ---------------------------------------------------------------------------
// Signalements et modération
// ---------------------------------------------------------------------------

export async function reportRecipe(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = reportSchema.safeParse({
    recipeId: formData.get("recipeId"),
    reason: formData.get("reason"),
    details: formData.get("details"),
  });
  if (!parsed.success) return fail("Choisis un motif.", { reason: ["Choisis un motif."] });
  const supabase = await createClient();
  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    recipe_id: parsed.data.recipeId,
    reason: parsed.data.reason,
    details: parsed.data.details,
  });
  if (error?.code === "23505") return ok("Tu as déjà signalé cette recette. Merci !");
  if (error) return fail(dbMessage(error, "Le signalement n'a pas pu être envoyé."));
  revalidatePath(`/recettes/${parsed.data.recipeId}`);
  return ok("Merci, la modération va examiner cette recette.");
}

export async function moderateRecipe(formData: FormData) {
  await requireUser();
  const recipeId = uuid.safeParse(formData.get("recipeId"));
  const decision = z.enum(["hide", "restore", "dismiss"]).safeParse(formData.get("decision"));
  if (!recipeId.success || !decision.success) return;
  const supabase = await createClient();
  await supabase.rpc("moderate_recipe", {
    p_recipe_id: recipeId.data,
    p_status: decision.data === "hide" ? "hidden" : "visible",
    p_report_status: decision.data === "hide" ? "actioned" : "dismissed",
  });
  revalidatePath("/admin/signalements");
  revalidateRecipes(recipeId.data);
}

// ---------------------------------------------------------------------------
// Catégories du foyer
// ---------------------------------------------------------------------------

export async function createCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const householdId = uuid.safeParse(formData.get("householdId"));
  const name = categoryNameSchema.safeParse(formData.get("name"));
  if (!householdId.success) return fail("Foyer invalide.");
  if (!name.success) return fail("Nom invalide.", { name: z.flattenError(name.error).formErrors });
  const supabase = await createClient();
  const { error } = await supabase.from("categories").insert({
    household_id: householdId.data,
    slug: slugify(name.data),
    name: name.data,
    created_by: user.id,
  });
  if (error?.code === "23505") return fail("Cette catégorie existe déjà.", { name: ["Choisis un autre nom."] });
  if (error) return fail("Impossible de créer la catégorie.");
  revalidatePath("/foyer");
  return ok("Catégorie ajoutée.");
}

export async function renameCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const id = uuid.safeParse(formData.get("categoryId"));
  const name = categoryNameSchema.safeParse(formData.get("name"));
  if (!id.success) return fail("Catégorie invalide.");
  if (!name.success) return fail("Nom invalide.", { name: z.flattenError(name.error).formErrors });
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .update({ name: name.data })
    .eq("id", id.data)
    .not("household_id", "is", null)
    .select("id");
  if (error || !data?.length) return fail("Impossible de renommer la catégorie.");
  revalidatePath("/foyer");
  return ok("Catégorie renommée.");
}

export async function deleteCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const id = uuid.safeParse(formData.get("categoryId"));
  if (!id.success) return fail("Catégorie invalide.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id.data)
    .not("household_id", "is", null)
    .select("id");
  if (error || !data?.length) return fail("Impossible de supprimer la catégorie.");
  revalidatePath("/foyer");
  return ok("Catégorie supprimée.");
}
