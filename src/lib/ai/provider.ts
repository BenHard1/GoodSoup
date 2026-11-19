import type { RecipeExtractor } from "@/features/import/extractor";

/**
 * Point d'extension IA. Aucune IA n'est utilisée pour l'instant :
 * le fournisseur « none » répond explicitement que le service n'est pas activé.
 *
 * Pour brancher une IA plus tard : implémenter `AiProvider` (et, pour l'import de recettes,
 * `recipeExtractor`), puis le retourner depuis `getAiProvider()` selon `AI_PROVIDER`.
 * L'import utilisera alors automatiquement cet extracteur à la place des règles simples.
 */
export type AiAvailability = { enabled: false; reason: string } | { enabled: true; provider: string };

export interface AiProvider {
  readonly name: string;
  availability(): AiAvailability;
  /** Structuration d'une recette importée (lien, texte de PDF ou de photo). Facultatif. */
  readonly recipeExtractor?: RecipeExtractor;
}

export const noneProvider: AiProvider = {
  name: "none",
  availability: () => ({ enabled: false, reason: "L'assistant IA n'est pas encore activé." }),
};

export function getAiProvider(): AiProvider {
  return noneProvider;
}
