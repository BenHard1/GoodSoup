"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { getRecipeExtractor } from "./extractor";
import { FetchPageError, fetchPage } from "./safe-fetch";
import { MAX_TEXT_LENGTH, type RecipeDraft } from "./types";

export type ImportResult = { status: "success"; draft: RecipeDraft } | { status: "error"; message: string };

const urlSchema = z.url({ protocol: /^https?$/, error: "Colle l'adresse complète de la page (https://…)." }).max(2000);
const textSchema = z.object({
  text: z.string().max(MAX_TEXT_LENGTH * 2),
  origin: z.enum(["import_pdf", "import_photo"]),
  sourceName: z.string().trim().max(200).nullable().optional(),
});

/** Quota anti-abus partagé par tous les imports (chaque import est une analyse, rien n'est enregistré). */
async function consumeQuota(): Promise<string | null> {
  if (!(await getCurrentUser())) redirect("/connexion");
  const supabase = await createClient();
  const { error } = await supabase.rpc("check_rate_limit", {
    p_action: "recipe_import",
    p_max: 100,
    p_window: "1 day",
  });
  return error ? "Tu as atteint la limite d'imports pour aujourd'hui. Réessaie demain." : null;
}

/** Import par lien : la page est lue par notre serveur, puis ses données schema.org sont analysées. */
export async function importRecipeFromUrl(rawUrl: string): Promise<ImportResult> {
  const url = urlSchema.safeParse(typeof rawUrl === "string" ? rawUrl.trim() : "");
  if (!url.success) return { status: "error", message: url.error.issues[0]?.message ?? "Adresse invalide." };
  const quota = await consumeQuota();
  if (quota) return { status: "error", message: quota };
  try {
    const page = await fetchPage(url.data);
    const draft = await getRecipeExtractor().extract({ kind: "html", html: page.html, sourceUrl: page.url });
    if (!draft.ingredients.length && !draft.steps.length) {
      return {
        status: "error",
        message:
          "Aucune recette n'a été trouvée sur cette page. Essaie l'import par photo (capture d'écran) ou la saisie manuelle.",
      };
    }
    return { status: "success", draft };
  } catch (e) {
    return {
      status: "error",
      message: e instanceof FetchPageError ? e.message : "La page n'a pas pu être importée. Réessaie plus tard.",
    };
  }
}

/** Import d'un texte extrait dans le navigateur (PDF ou photo) : seul le texte est transmis, jamais le fichier. */
export async function importRecipeFromText(input: unknown): Promise<ImportResult> {
  const parsed = textSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Texte invalide." };
  const text = parsed.data.text.slice(0, MAX_TEXT_LENGTH);
  if (text.replace(/\s/g, "").length < 20) {
    return {
      status: "error",
      message:
        parsed.data.origin === "import_photo"
          ? "Aucun texte lisible n'a été trouvé sur la photo. Essaie une photo plus nette, bien éclairée et prise de face."
          : "Aucun texte n'a été trouvé dans ce PDF.",
    };
  }
  const quota = await consumeQuota();
  if (quota) return { status: "error", message: quota };
  const draft = await getRecipeExtractor().extract({
    kind: "text",
    text,
    origin: parsed.data.origin,
    sourceName: parsed.data.sourceName ?? null,
  });
  return { status: "success", draft };
}
