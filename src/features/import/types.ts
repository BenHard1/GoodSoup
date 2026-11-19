/**
 * Recette importée, avant relecture. Rien n'est enregistré tant que l'utilisateur n'a pas relu et validé
 * le formulaire : ce brouillon ne sert qu'à le pré-remplir.
 */
export type ImportOrigin = "import_url" | "import_pdf" | "import_photo";

export type DraftIngredient = {
  section: string | null;
  /** Quantité telle que saisie dans le formulaire (« 200 », « 1,5 », « 2-3 »), vide si aucune. */
  quantity: string;
  unit_code: string | null;
  name: string;
  note: string | null;
  is_optional: boolean;
};

export type DraftStep = { section: string | null; instruction: string };

export type RecipeDraft = {
  origin: ImportOrigin;
  /** « structured » : données schema.org fournies par le site ; « text » : texte brut analysé par heuristiques. */
  method: "structured" | "text";
  title: string;
  description: string | null;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  restMinutes: number | null;
  ingredients: DraftIngredient[];
  steps: DraftStep[];
  tips: string | null;
  tags: string[];
  sourceUrl: string | null;
  sourceName: string | null;
  attribution: string | null;
  imageUrl: string | null;
  /** Points à vérifier en priorité lors de la relecture. */
  warnings: string[];
};

export const MAX_TEXT_LENGTH = 50_000;
