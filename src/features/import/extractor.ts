import { getAiProvider } from "@/lib/ai/provider";
import { recipeFromJsonLd } from "./json-ld";
import { htmlToText } from "./text-utils";
import { recipeFromText } from "./text-recipe";
import type { ImportOrigin, RecipeDraft } from "./types";

/**
 * Point d'entrée unique de la structuration d'une recette importée.
 *
 * Aujourd'hui : règles simples, sans IA ni service tiers (schema.org pour les liens, heuristiques pour
 * le texte des PDF et des photos). Plus tard, un fournisseur d'IA activé pourra proposer son propre
 * extracteur via `AiProvider.recipeExtractor` : les écrans et les actions n'auront pas à changer.
 */
export type ExtractionInput =
  | { kind: "html"; html: string; sourceUrl: string }
  | { kind: "text"; text: string; origin: Exclude<ImportOrigin, "import_url">; sourceName?: string | null };

export interface RecipeExtractor {
  readonly name: string;
  extract(input: ExtractionInput): Promise<RecipeDraft>;
}

export const ruleBasedExtractor: RecipeExtractor = {
  name: "rules",
  async extract(input) {
    if (input.kind === "html") {
      const structured = recipeFromJsonLd(input.html, input.sourceUrl);
      if (structured) return structured;
      // Pas de données structurées : on tente l'analyse du texte visible de la page.
      const draft = recipeFromText(htmlToText(input.html), "import_url", { sourceUrl: input.sourceUrl });
      draft.warnings.unshift(
        "Ce site ne décrit pas sa recette dans un format standard : le texte de la page a été analysé, vérifie tout attentivement.",
      );
      return { ...draft, sourceName: hostOf(input.sourceUrl) };
    }
    return recipeFromText(input.text, input.origin, { sourceName: input.sourceName ?? null });
  },
};

export function getRecipeExtractor(): RecipeExtractor {
  const provider = getAiProvider();
  return (provider.availability().enabled && provider.recipeExtractor) || ruleBasedExtractor;
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
