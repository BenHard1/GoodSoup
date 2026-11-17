import "server-only";
import { cache } from "react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { Unit } from "./quantity";

export const RECIPE_IMAGES_BUCKET = "recipe-images";
const SIGNED_URL_TTL = 60 * 60; // 1 h

export type Visibility = "private" | "household" | "public";
export type Difficulty = "easy" | "medium" | "hard";

export type RecipeRow = {
  id: string;
  owner_id: string;
  household_id: string | null;
  visibility: Visibility;
  household_can_edit: boolean;
  title: string;
  description: string | null;
  servings: number;
  prep_minutes: number | null;
  cook_minutes: number | null;
  rest_minutes: number | null;
  total_minutes: number;
  difficulty: Difficulty | null;
  tips: string | null;
  tags: string[];
  diets: string[];
  origin: string;
  source_url: string | null;
  source_name: string | null;
  attribution: string | null;
  source_recipe_id: string | null;
  source_owner_id: string | null;
  rights_confirmed_at: string | null;
  published_at: string | null;
  moderation_status: "visible" | "hidden";
  cover_image_id: string | null;
  favorites_count: number;
  copies_count: number;
  created_at: string;
  updated_at: string;
};

export type Category = { id: string; household_id: string | null; slug: string; name: string; position: number };

export type RecipeCardData = Pick<
  RecipeRow,
  "id" | "title" | "total_minutes" | "difficulty" | "visibility" | "servings" | "owner_id" | "moderation_status"
> & { coverUrl: string | null; authorName: string | null; isFavorite: boolean };

export const getUnits = cache(async (): Promise<Unit[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("units").select("code, label, plural, kind").order("position");
  if (error) throw new Error("Impossible de charger les unités.");
  return data as Unit[];
});

export const getUnitMap = cache(async () => new Map((await getUnits()).map((u) => [u.code, u])));

/** Catégories système + catégories des foyers de l'utilisateur. */
export const getCategories = cache(async (): Promise<Category[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, household_id, slug, name, position")
    .order("position")
    .order("name");
  if (error) throw new Error("Impossible de charger les catégories.");
  return data as Category[];
});

/** Noms affichés (soi, membres de ses foyers, auteurs publics). */
export async function getDisplayNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_display_names", { p_ids: unique });
  return new Map(((data ?? []) as { id: string; display_name: string }[]).map((r) => [r.id, r.display_name]));
}

/** URL signées (bucket privé) pour une liste de chemins. */
export async function signImagePaths(paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.storage.from(RECIPE_IMAGES_BUCKET).createSignedUrls(unique, SIGNED_URL_TTL);
  const map = new Map<string, string>();
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
  }
  return map;
}

/** Image de couverture : celle choisie, sinon la première photo. */
async function getCoverPaths(recipes: Pick<RecipeRow, "id" | "cover_image_id">[]): Promise<Map<string, string>> {
  if (recipes.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase
    .from("recipe_images")
    .select("id, recipe_id, storage_path, position")
    .in(
      "recipe_id",
      recipes.map((r) => r.id),
    )
    .order("position")
    .order("created_at");
  const byRecipe = new Map<string, string>();
  const rows = (data ?? []) as { id: string; recipe_id: string; storage_path: string }[];
  for (const r of recipes) {
    const cover = rows.find((i) => i.id === r.cover_image_id) ?? rows.find((i) => i.recipe_id === r.id);
    if (cover) byRecipe.set(r.id, cover.storage_path);
  }
  return byRecipe;
}

export async function getFavoriteIds(recipeIds: string[]): Promise<Set<string>> {
  const user = await getCurrentUser();
  if (!user || recipeIds.length === 0) return new Set();
  const supabase = await createClient();
  const { data } = await supabase
    .from("favorites")
    .select("recipe_id")
    .eq("user_id", user.id)
    .in("recipe_id", recipeIds);
  return new Set((data ?? []).map((f) => f.recipe_id as string));
}

/** Enrichit des recettes pour l'affichage en cartes (photo, auteur, favori). */
export async function toCards(rows: RecipeRow[]): Promise<RecipeCardData[]> {
  const [covers, names, favorites] = await Promise.all([
    getCoverPaths(rows),
    getDisplayNames(rows.map((r) => r.owner_id)),
    getFavoriteIds(rows.map((r) => r.id)),
  ]);
  const signed = await signImagePaths([...covers.values()]);
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    total_minutes: r.total_minutes,
    difficulty: r.difficulty,
    visibility: r.visibility,
    servings: r.servings,
    owner_id: r.owner_id,
    moderation_status: r.moderation_status,
    coverUrl: covers.has(r.id) ? (signed.get(covers.get(r.id)!) ?? null) : null,
    authorName: names.get(r.owner_id) ?? null,
    isFavorite: favorites.has(r.id),
  }));
}

export type SearchScope = "mine" | "household" | "favorites" | "public" | "author";
export type SearchSort = "recent" | "updated" | "alpha" | "popular";

export type SearchParams = {
  scope: SearchScope;
  query?: string | null;
  householdId?: string | null;
  authorId?: string | null;
  categoryIds?: string[];
  maxMinutes?: number | null;
  difficulty?: Difficulty | null;
  diets?: string[];
  sort?: SearchSort;
  page?: number;
  limit?: number;
};

export const PAGE_SIZE = 24;

export async function searchRecipes(p: SearchParams): Promise<{ cards: RecipeCardData[]; hasMore: boolean }> {
  const supabase = await createClient();
  const page = Math.max(1, p.page ?? 1);
  const size = p.limit ?? PAGE_SIZE;
  const { data, error } = await supabase.rpc("search_recipes", {
    p_scope: p.scope,
    p_query: p.query || null,
    p_household_id: p.householdId ?? null,
    p_author_id: p.authorId ?? null,
    p_category_ids: p.categoryIds?.length ? p.categoryIds : null,
    p_max_minutes: p.maxMinutes ?? null,
    p_difficulty: p.difficulty ?? null,
    p_diets: p.diets?.length ? p.diets : null,
    p_sort: p.sort ?? "recent",
    p_limit: size + 1,
    p_offset: (page - 1) * size,
  });
  if (error) throw new Error("La recherche a échoué. Réessaie dans un instant.");
  const rows = (data ?? []) as RecipeRow[];
  return { cards: await toCards(rows.slice(0, size)), hasMore: rows.length > size };
}

export type RecipeIngredient = {
  id: string;
  position: number;
  section: string | null;
  name: string;
  quantity: number | null;
  quantity_max: number | null;
  unit_code: string | null;
  note: string | null;
  is_optional: boolean;
};

export type RecipeStep = {
  id: string;
  position: number;
  section: string | null;
  instruction: string;
  duration_minutes: number | null;
};

export type RecipeImage = {
  id: string;
  storage_path: string;
  position: number;
  alt_text: string | null;
  url: string | null;
};

export type RecipeDetail = {
  recipe: RecipeRow;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  images: RecipeImage[];
  categories: Category[];
  authorName: string | null;
  householdName: string | null;
  isOwner: boolean;
  canEdit: boolean;
  isFavorite: boolean;
  myNote: string | null;
  myRating: number | null;
  hasReported: boolean;
  sourceAvailable: boolean;
};

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export async function getRecipe(id: string): Promise<RecipeDetail | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data: recipe } = await supabase.from("recipes").select("*").eq("id", id).maybeSingle();
  if (!recipe) return null;
  const r = recipe as RecipeRow;

  const [ingredients, steps, images, cats, fav, note, rating, report, household, source] = await Promise.all([
    supabase.from("recipe_ingredients").select("*").eq("recipe_id", id).order("position"),
    supabase.from("recipe_steps").select("*").eq("recipe_id", id).order("position"),
    supabase
      .from("recipe_images")
      .select("id, storage_path, position, alt_text")
      .eq("recipe_id", id)
      .order("position")
      .order("created_at"),
    supabase.from("recipe_categories").select("categories(id, household_id, slug, name, position)").eq("recipe_id", id),
    supabase.from("favorites").select("recipe_id").eq("recipe_id", id).eq("user_id", user.id).maybeSingle(),
    supabase.from("recipe_notes").select("body").eq("recipe_id", id).eq("user_id", user.id).maybeSingle(),
    supabase.from("recipe_ratings").select("rating").eq("recipe_id", id).eq("user_id", user.id).maybeSingle(),
    supabase.from("reports").select("id").eq("recipe_id", id).eq("reporter_id", user.id).maybeSingle(),
    r.household_id
      ? supabase.from("households").select("name").eq("id", r.household_id).maybeSingle()
      : Promise.resolve({ data: null }),
    r.source_recipe_id
      ? supabase.from("recipes").select("id").eq("id", r.source_recipe_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const imageRows = (images.data ?? []) as Omit<RecipeImage, "url">[];
  const [signed, names] = await Promise.all([
    signImagePaths(imageRows.map((i) => i.storage_path)),
    getDisplayNames([r.owner_id]),
  ]);
  // La couverture choisie passe en premier.
  imageRows.sort((a, b) => Number(b.id === r.cover_image_id) - Number(a.id === r.cover_image_id));

  const isOwner = r.owner_id === user.id;
  return {
    recipe: r,
    ingredients: ((ingredients.data ?? []) as RecipeIngredient[]).map((i) => ({
      ...i,
      quantity: num(i.quantity),
      quantity_max: num(i.quantity_max),
    })),
    steps: (steps.data ?? []) as RecipeStep[],
    images: imageRows.map((i) => ({ ...i, url: signed.get(i.storage_path) ?? null })),
    categories: ((cats.data ?? []) as unknown as { categories: Category | null }[])
      .map((c) => c.categories)
      .filter((c): c is Category => c !== null)
      .sort((a, b) => a.position - b.position),
    authorName: names.get(r.owner_id) ?? null,
    householdName: (household.data as { name: string } | null)?.name ?? null,
    isOwner,
    canEdit: isOwner || (r.visibility === "household" && r.household_can_edit && Boolean(household.data)),
    isFavorite: Boolean(fav.data),
    myNote: (note.data as { body: string } | null)?.body ?? null,
    myRating: (rating.data as { rating: number } | null)?.rating ?? null,
    hasReported: Boolean(report.data),
    sourceAvailable: Boolean(source.data),
  };
}

export type ReportRow = {
  id: string;
  recipe_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  recipe: { id: string; title: string; moderation_status: string; owner_id: string } | null;
};

export async function getOpenReports(): Promise<ReportRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reports")
    .select(
      "id, recipe_id, reason, details, status, created_at, recipe:recipes(id, title, moderation_status, owner_id)",
    )
    .eq("status", "open")
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw new Error("Impossible de charger les signalements.");
  return (data ?? []) as unknown as ReportRow[];
}

export async function isAppAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_app_admin");
  return data === true;
}

export const getIngredientNames = cache(async (): Promise<string[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("ingredients").select("name").order("name").limit(2000);
  return (data ?? []).map((i) => i.name as string);
});
