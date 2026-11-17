import { z } from "zod";
import { DIET_VALUES } from "@/features/households/food-options";

const trimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `${max} caractères maximum.` });
const optionalText = (max: number) =>
  trimmed(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));
const minutes = z.coerce
  .number({ error: "Nombre de minutes invalide." })
  .int({ error: "Nombre entier attendu." })
  .min(0, { error: "Durée invalide." })
  .max(10000, { error: "Durée trop longue." })
  .nullable()
  .optional()
  .transform((v) => (v === undefined ? null : v));

export const VISIBILITIES = [
  { value: "private", label: "Privée", hint: "Visible par toi seul." },
  { value: "household", label: "Foyer", hint: "Visible par les membres de ton foyer." },
  { value: "public", label: "Publique", hint: "Visible par tous les membres de Good Soup." },
] as const;

export const DIFFICULTIES = [
  { value: "easy", label: "Facile" },
  { value: "medium", label: "Moyenne" },
  { value: "hard", label: "Difficile" },
] as const;

export const ingredientSchema = z
  .object({
    section: optionalText(80),
    name: trimmed(120).min(1, { error: "Nom de l'ingrédient requis." }),
    quantity: z.number().positive().max(1_000_000).nullable(),
    quantity_max: z.number().positive().max(1_000_000).nullable(),
    unit_code: z.string().max(20).nullable(),
    note: optionalText(200),
    is_optional: z.boolean().default(false),
  })
  .refine((i) => i.quantity_max === null || (i.quantity !== null && i.quantity_max >= i.quantity), {
    error: "Fourchette de quantité invalide.",
    path: ["quantity_max"],
  });

export const stepSchema = z.object({
  section: optionalText(80),
  instruction: trimmed(3000).min(1, { error: "Décris l'étape." }),
  duration_minutes: z.number().int().min(0).max(10000).nullable().default(null),
});

export const recipePayloadSchema = z
  .object({
    id: z.uuid().optional(),
    expected_updated_at: z.string().optional(),
    title: trimmed(150).min(1, { error: "Donne un titre à ta recette." }),
    description: optionalText(2000),
    servings: z.coerce
      .number({ error: "Nombre de portions invalide." })
      .int()
      .min(1, { error: "Au moins 1 portion." })
      .max(100, { error: "100 portions maximum." }),
    prep_minutes: minutes,
    cook_minutes: minutes,
    rest_minutes: minutes,
    difficulty: z.enum(["easy", "medium", "hard"]).nullable().default(null),
    tips: optionalText(5000),
    tags: z.array(trimmed(40).min(1)).max(20, { error: "20 mots-clés maximum." }).default([]),
    diets: z
      .array(z.enum(DIET_VALUES as [string, ...string[]]))
      .max(20)
      .default([]),
    visibility: z.enum(["private", "household", "public"]).default("private"),
    household_id: z.uuid().nullable().default(null),
    household_can_edit: z.boolean().default(true),
    rights_confirmed: z.boolean().default(false),
    source_url: z
      .union([z.url({ protocol: /^https?$/, error: "Adresse web invalide (https://…)." }), z.literal("")])
      .nullable()
      .default(null)
      .transform((v) => v || null),
    source_name: optionalText(200),
    attribution: optionalText(300),
    category_ids: z.array(z.uuid()).max(30).default([]),
    ingredients: z.array(ingredientSchema).max(100, { error: "100 ingrédients maximum." }).default([]),
    steps: z.array(stepSchema).max(60, { error: "60 étapes maximum." }).default([]),
  })
  .superRefine((r, ctx) => {
    if (r.visibility === "household" && !r.household_id) {
      ctx.addIssue({ code: "custom", path: ["visibility"], message: "Choisis le foyer avec qui partager." });
    }
    if (r.visibility === "public" && !r.rights_confirmed) {
      ctx.addIssue({
        code: "custom",
        path: ["rights_confirmed"],
        message: "Confirme que tu as le droit de publier cette recette.",
      });
    }
  });

export type RecipePayload = z.infer<typeof recipePayloadSchema>;

/** Erreurs de validation regroupées par champ racine (« ingredients », « steps », « title »…). */
export function recipeFieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const [root, index] = issue.path;
    const key = String(root ?? "form");
    const prefix =
      key === "ingredients" && typeof index === "number"
        ? `Ingrédient ${index + 1} : `
        : key === "steps" && typeof index === "number"
          ? `Étape ${index + 1} : `
          : "";
    (out[key] ??= []).push(prefix + issue.message);
  }
  return out;
}

export const reportSchema = z.object({
  recipeId: z.uuid(),
  reason: z.enum(["spam", "inappropriate", "copyright", "dangerous", "other"]),
  details: optionalText(1000),
});

export const REPORT_REASONS = [
  { value: "inappropriate", label: "Contenu inapproprié" },
  { value: "copyright", label: "Copie d'une recette protégée" },
  { value: "dangerous", label: "Recette dangereuse" },
  { value: "spam", label: "Publicité ou spam" },
  { value: "other", label: "Autre" },
] as const;

export const categoryNameSchema = trimmed(40).min(1, { error: "Nom requis." });

/** « Plats du soir » → « plats-du-soir » */
export function slugify(name: string): string {
  return (
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/œ/g, "oe")
      .replace(/æ/g, "ae")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "categorie"
  );
}
