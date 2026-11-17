"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { publicEnv } from "@/lib/env";
import { safeNextPath } from "@/lib/safe-redirect";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { getMyProfile } from "./queries";
import { extractInvitationToken, householdNameSchema, parseFoodProfileForm } from "./schemas";

const uuid = z.uuid();

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  return user;
}

/**
 * Après succès, redirige côté serveur si le formulaire le demande (parcours de bienvenue, invitation).
 * Une redirection serveur est fiable même si la page se réaffiche autrement après la mise à jour.
 */
function redirectIfRequested(formData: FormData) {
  const dest = safeNextPath(formData.get("redirectTo"), "");
  if (dest) redirect(dest);
}

/** Message lisible depuis une erreur levée par une fonction SQL (P0001 / 42501). */
function dbMessage(error: { message?: string; code?: string } | null, fallback: string) {
  if (error?.code === "P0001" || error?.code === "42501") return error.message ?? fallback;
  return fallback;
}

export async function setActiveHousehold(householdId: string) {
  await requireUser();
  if (!uuid.safeParse(householdId).success) return;
  const profile = await getMyProfile();
  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ preferences: { ...(profile?.preferences ?? {}), activeHouseholdId: householdId } })
    .eq("id", profile!.id);
  revalidatePath("/", "layout");
}

export async function createHousehold(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = householdNameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return fail("Nom invalide.", { name: z.flattenError(parsed.error).formErrors });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_household", { p_name: parsed.data });
  if (error) return fail(dbMessage(error, "Impossible de créer le foyer."));
  await setActiveHousehold(data as string);
  revalidatePath("/", "layout");
  redirectIfRequested(formData);
  return ok("Foyer créé.");
}

export async function joinHousehold(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const token = extractInvitationToken(String(formData.get("invitation") ?? ""));
  if (!token) return fail("Ce lien d'invitation n'est pas reconnu.", { invitation: ["Colle le lien reçu."] });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_household_invitation", { p_token: token });
  if (error) return fail(dbMessage(error, "Impossible de rejoindre ce foyer."));
  await setActiveHousehold(data as string);
  revalidatePath("/", "layout");
  redirectIfRequested(formData);
  return ok("Bienvenue dans le foyer !");
}

export type InvitationState = ActionState & { link?: string };

export async function createInvitation(_prev: InvitationState, formData: FormData): Promise<InvitationState> {
  await requireUser();
  const householdId = uuid.safeParse(formData.get("householdId"));
  if (!householdId.success) return fail("Foyer invalide.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_household_invitation", { p_household_id: householdId.data });
  if (error) return fail(dbMessage(error, "Impossible de créer l'invitation."));
  revalidatePath("/foyer");
  return {
    status: "success",
    message: "Lien créé. Il ne sera plus affiché ensuite : copie-le maintenant.",
    link: `${publicEnv.NEXT_PUBLIC_SITE_URL}/foyer/rejoindre/${data as string}`,
  };
}

export async function revokeInvitation(formData: FormData) {
  await requireUser();
  const id = uuid.safeParse(formData.get("invitationId"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.rpc("revoke_household_invitation", { p_invitation_id: id.data });
  revalidatePath("/foyer");
}

export async function renameHousehold(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const id = uuid.safeParse(formData.get("householdId"));
  const name = householdNameSchema.safeParse(formData.get("name"));
  if (!id.success) return fail("Foyer invalide.");
  if (!name.success) return fail("Nom invalide.", { name: z.flattenError(name.error).formErrors });
  const supabase = await createClient();
  const { data, error } = await supabase.from("households").update({ name: name.data }).eq("id", id.data).select("id");
  if (error || !data?.length) return fail("Seul le propriétaire peut renommer le foyer.");
  revalidatePath("/", "layout");
  return ok("Nom enregistré.");
}

export async function leaveHousehold(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const id = uuid.safeParse(formData.get("householdId"));
  if (!id.success) return fail("Foyer invalide.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_household", { p_household_id: id.data });
  if (error) return fail(dbMessage(error, "Impossible de quitter le foyer."));
  revalidatePath("/", "layout");
  redirect("/foyer");
}

export async function removeMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const hid = uuid.safeParse(formData.get("householdId"));
  const uid = uuid.safeParse(formData.get("userId"));
  if (!hid.success || !uid.success) return fail("Requête invalide.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_household_member", { p_household_id: hid.data, p_user_id: uid.data });
  if (error) return fail(dbMessage(error, "Impossible de retirer ce membre."));
  revalidatePath("/foyer");
  return ok("Membre retiré.");
}

export async function saveFoodProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const householdId = uuid.safeParse(formData.get("householdId"));
  if (!householdId.success) return fail("Foyer invalide.");
  const profileId = formData.get("profileId") ? uuid.safeParse(formData.get("profileId")) : null;
  const forSelf = formData.get("forSelf") === "1";
  const parsed = parseFoodProfileForm(formData);
  if (!parsed.success) return fail("Certains champs sont à corriger.", z.flattenError(parsed.error).fieldErrors);

  const row = {
    household_id: householdId.data,
    display_name: parsed.data.displayName,
    allergies: parsed.data.allergies,
    exclusions: parsed.data.exclusions,
    likes: parsed.data.likes,
    dislikes: parsed.data.dislikes,
    diets: parsed.data.diets,
    goals: parsed.data.goals ?? null,
  };

  const supabase = await createClient();
  let error;
  if (profileId?.success) {
    ({ error } = await supabase.from("food_profiles").update(row).eq("id", profileId.data));
  } else if (forSelf) {
    ({ error } = await supabase
      .from("food_profiles")
      .upsert({ ...row, user_id: user.id }, { onConflict: "household_id,user_id" }));
  } else {
    ({ error } = await supabase.from("food_profiles").insert({ ...row, user_id: null }));
  }
  if (error) return fail("Impossible d'enregistrer le profil alimentaire.");
  revalidatePath("/profil");
  revalidatePath("/foyer");
  return ok("Préférences enregistrées.");
}

export async function deleteFoodProfile(formData: FormData) {
  await requireUser();
  const id = uuid.safeParse(formData.get("profileId"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from("food_profiles").delete().eq("id", id.data).is("user_id", null);
  revalidatePath("/foyer");
}
