"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { displayNameSchema } from "@/features/auth/schemas";
import { getMyHouseholds } from "@/features/households/queries";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export async function updateDisplayName(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  const parsed = displayNameSchema.safeParse(formData.get("displayName"));
  if (!parsed.success) return fail("Pseudonyme invalide.", { displayName: z.flattenError(parsed.error).formErrors });
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ display_name: parsed.data }).eq("id", user.id);
  if (error) return fail("Impossible d'enregistrer le pseudonyme.");
  revalidatePath("/", "layout");
  return ok("Pseudonyme enregistré.");
}

/** Fin du parcours de bienvenue : exige au moins un foyer. */
export async function completeOnboarding() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  const households = await getMyHouseholds();
  if (households.length === 0) redirect("/bienvenue?etape=foyer");
  const supabase = await createClient();
  await supabase.from("profiles").update({ onboarded_at: new Date().toISOString() }).eq("id", user.id);
  revalidatePath("/", "layout");
  redirect("/accueil");
}

/**
 * Suppression définitive du compte. Les foyers sont transmis (ou supprimés s'il n'y reste personne)
 * par les triggers de la base. Seule action utilisant la clé secrète.
 */
export async function deleteAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  if (String(formData.get("confirmation") ?? "").trim() !== "SUPPRIMER") {
    return fail("Tape SUPPRIMER pour confirmer.", { confirmation: ["Tape SUPPRIMER en majuscules."] });
  }
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return fail("La suppression a échoué. Réessaie ou contacte-nous.");
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/?compte=supprime");
}
