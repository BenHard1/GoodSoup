/**
 * Point d'extension IA (Phase 2+). Aucune IA n'est utilisée en Phases 0-1 :
 * le fournisseur « none » répond explicitement que le service n'est pas activé.
 */
export type AiAvailability = { enabled: false; reason: string } | { enabled: true; provider: string };

export interface AiProvider {
  readonly name: string;
  availability(): AiAvailability;
}

export const noneProvider: AiProvider = {
  name: "none",
  availability: () => ({ enabled: false, reason: "L'assistant IA n'est pas encore activé." }),
};

export function getAiProvider(): AiProvider {
  return noneProvider;
}
