import {
  emptyIngredient,
  emptyRecipeValues,
  emptyStep,
  rowKey,
  type RecipeFormValues,
} from "@/features/recipes/form-values";
import type { RecipeDraft } from "./types";

const str = (n: number | null) => (n === null ? "" : String(n));

/** Pré-remplit le formulaire de recette avec le brouillon importé (toujours privé). */
export function draftToFormValues(draft: RecipeDraft): RecipeFormValues {
  const base = emptyRecipeValues();
  return {
    ...base,
    origin: draft.origin,
    title: draft.title,
    description: draft.description ?? "",
    servings: str(draft.servings ?? 4),
    prep_minutes: str(draft.prepMinutes),
    cook_minutes: str(draft.cookMinutes),
    rest_minutes: str(draft.restMinutes),
    tips: draft.tips ?? "",
    tags: draft.tags.join(", "),
    visibility: "private",
    household_id: "",
    rights_confirmed: false,
    source_url: draft.sourceUrl ?? "",
    source_name: draft.sourceName ?? "",
    attribution: draft.attribution ?? "",
    ingredients: draft.ingredients.length
      ? draft.ingredients.map((i) => ({
          key: rowKey(),
          section: i.section ?? "",
          quantity: i.quantity,
          unit_code: i.unit_code ?? "",
          name: i.name,
          note: i.note ?? "",
          is_optional: i.is_optional,
        }))
      : [emptyIngredient(), emptyIngredient(), emptyIngredient()],
    steps: draft.steps.length
      ? draft.steps.map((s) => ({
          key: rowKey(),
          section: s.section ?? "",
          instruction: s.instruction,
          duration_minutes: "",
        }))
      : [emptyStep(), emptyStep()],
  };
}
