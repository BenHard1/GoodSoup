import { quantityToInput } from "./quantity";
import type { RecipeDetail } from "./queries";

export type IngredientRow = {
  key: string;
  section: string;
  quantity: string;
  unit_code: string;
  name: string;
  note: string;
  is_optional: boolean;
};

export type StepRow = { key: string; section: string; instruction: string; duration_minutes: string };

export type RecipeFormValues = {
  id?: string;
  expected_updated_at?: string;
  title: string;
  description: string;
  servings: string;
  prep_minutes: string;
  cook_minutes: string;
  rest_minutes: string;
  difficulty: string;
  tips: string;
  tags: string;
  diets: string[];
  category_ids: string[];
  visibility: "private" | "household" | "public";
  household_id: string;
  household_can_edit: boolean;
  rights_confirmed: boolean;
  source_url: string;
  source_name: string;
  attribution: string;
  /** Recette importée (lien, PDF, photo) : fixée à la création, jamais modifiable ensuite. */
  origin?: "import_url" | "import_pdf" | "import_photo";
  ingredients: IngredientRow[];
  steps: StepRow[];
};

let counter = 0;
export const rowKey = () => `r${Date.now().toString(36)}${(counter++).toString(36)}`;

export const emptyIngredient = (): IngredientRow => ({
  key: rowKey(),
  section: "",
  quantity: "",
  unit_code: "",
  name: "",
  note: "",
  is_optional: false,
});

export const emptyStep = (): StepRow => ({ key: rowKey(), section: "", instruction: "", duration_minutes: "" });

export function emptyRecipeValues(householdId?: string): RecipeFormValues {
  return {
    title: "",
    description: "",
    servings: "4",
    prep_minutes: "",
    cook_minutes: "",
    rest_minutes: "",
    difficulty: "",
    tips: "",
    tags: "",
    diets: [],
    category_ids: [],
    visibility: "private",
    household_id: householdId ?? "",
    household_can_edit: true,
    rights_confirmed: false,
    source_url: "",
    source_name: "",
    attribution: "",
    ingredients: [emptyIngredient(), emptyIngredient(), emptyIngredient()],
    steps: [emptyStep(), emptyStep()],
  };
}

const str = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

export function recipeToValues(d: RecipeDetail, fallbackHouseholdId?: string): RecipeFormValues {
  const r = d.recipe;
  return {
    id: r.id,
    expected_updated_at: r.updated_at,
    title: r.title,
    description: r.description ?? "",
    servings: String(r.servings),
    prep_minutes: str(r.prep_minutes),
    cook_minutes: str(r.cook_minutes),
    rest_minutes: str(r.rest_minutes),
    difficulty: r.difficulty ?? "",
    tips: r.tips ?? "",
    tags: r.tags.join(", "),
    diets: r.diets,
    category_ids: d.categories.map((c) => c.id),
    visibility: r.visibility,
    household_id: r.household_id ?? fallbackHouseholdId ?? "",
    household_can_edit: r.household_can_edit,
    rights_confirmed: Boolean(r.rights_confirmed_at),
    source_url: r.source_url ?? "",
    source_name: r.source_name ?? "",
    attribution: r.attribution ?? "",
    ingredients: d.ingredients.map((i) => ({
      key: rowKey(),
      section: i.section ?? "",
      quantity: quantityToInput(i.quantity, i.quantity_max),
      unit_code: i.unit_code ?? "",
      name: i.name,
      note: i.note ?? "",
      is_optional: i.is_optional,
    })),
    steps: d.steps.map((s) => ({
      key: rowKey(),
      section: s.section ?? "",
      instruction: s.instruction,
      duration_minutes: str(s.duration_minutes),
    })),
  };
}
