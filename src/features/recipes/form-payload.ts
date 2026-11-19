import type { RecipeFormValues } from "./form-values";
import { parseQuantity } from "./quantity";

const intOrNull = (s: string) => {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? Math.round(n) : Number.NaN;
};

/**
 * Transforme l'état du formulaire en données pour le serveur.
 * Les lignes vides sont ignorées ; une quantité incompréhensible est signalée au lieu d'être perdue.
 */
export function valuesToPayload(v: RecipeFormValues): { payload: Record<string, unknown>; errors: string[] } {
  const errors: string[] = [];
  const ingredients = v.ingredients
    .filter((i) => i.name.trim() || i.quantity.trim())
    .map((i, index) => {
      const q = parseQuantity(i.quantity);
      if (!q)
        errors.push(`Ingrédient ${index + 1} : quantité « ${i.quantity} » non comprise (ex. 200, 1,5, 1/2, 2-3).`);
      if (!i.name.trim()) errors.push(`Ingrédient ${index + 1} : indique le nom de l'ingrédient.`);
      return {
        section: i.section.trim() || null,
        name: i.name.trim(),
        quantity: q?.quantity ?? null,
        quantity_max: q?.quantityMax ?? null,
        unit_code: i.unit_code || null,
        note: i.note.trim() || null,
        is_optional: i.is_optional,
      };
    });
  const steps = v.steps
    .filter((s) => s.instruction.trim())
    .map((s) => ({
      section: s.section.trim() || null,
      instruction: s.instruction.trim(),
      duration_minutes: intOrNull(s.duration_minutes),
    }));
  const seen = new Set<string>();
  const tags = v.tags
    .split(/[,;#\n]/)
    .map((t) => t.trim().slice(0, 40))
    .filter((t) => {
      const k = t.toLocaleLowerCase("fr");
      if (!t || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 20);

  return {
    errors,
    payload: {
      ...(v.id ? { id: v.id } : {}),
      ...(v.expected_updated_at ? { expected_updated_at: v.expected_updated_at } : {}),
      ...(v.origin && !v.id ? { origin: v.origin } : {}),
      title: v.title,
      description: v.description,
      servings: v.servings,
      prep_minutes: intOrNull(v.prep_minutes),
      cook_minutes: intOrNull(v.cook_minutes),
      rest_minutes: intOrNull(v.rest_minutes),
      difficulty: v.difficulty || null,
      tips: v.tips,
      tags,
      diets: v.diets,
      category_ids: v.category_ids,
      visibility: v.visibility,
      household_id: v.visibility === "household" ? v.household_id || null : null,
      household_can_edit: v.household_can_edit,
      rights_confirmed: v.visibility === "public" ? v.rights_confirmed : false,
      source_url: v.source_url.trim(),
      source_name: v.source_name,
      attribution: v.attribution,
      ingredients,
      steps,
    },
  };
}
