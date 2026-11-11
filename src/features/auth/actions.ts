"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { publicEnv } from "@/lib/env";
import { safeNextPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";
import { authErrorMessage } from "./errors";
import { emailSchema, newPasswordSchema, signInSchema, signUpSchema } from "./schemas";

const confirmUrl = (next: string) => `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=${encodeURIComponent(next)}`;

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail("Certains champs sont à corriger.", z.flattenError(parsed.error).fieldErrors);
  }
  const next = safeNextPath(formData.get("next"), "/bienvenue");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: confirmUrl(next),
    },
  });
  if (error) return fail(authErrorMessage(error));

  // Confirmation d'e-mail désactivée (cas exceptionnel) : la session est déjà ouverte.
  if (data.session) redirect(next);
  redirect(`/verifier-email?email=${encodeURIComponent(parsed.data.email)}`);
}

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail("Certains champs sont à corriger.", z.flattenError(parsed.error).fieldErrors);
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return fail(authErrorMessage(error));
  redirect(safeNextPath(formData.get("next")));
}

export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return fail("Adresse e-mail invalide.", { email: ["Adresse e-mail invalide."] });
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: confirmUrl("/reinitialiser"),
  });
  // On ne révèle pas si l'adresse existe ; seules les limites de fréquence sont signalées.
  if (error && (error.status === 429 || error.code?.startsWith("over_"))) return fail(authErrorMessage(error));
  return ok("Si un compte existe avec cette adresse, un e-mail vient de t'être envoyé.");
}

export async function updatePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = newPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail("Certains champs sont à corriger.", z.flattenError(parsed.error).fieldErrors);
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail(authErrorMessage(error));
  return ok("Ton mot de passe a été modifié.");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/connexion");
}
