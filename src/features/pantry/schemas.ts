import { z } from "zod";

export const LOCATIONS = [
  { value: "fridge", label: "Frigo", slug: "frigo" },
  { value: "freezer", label: "Congélateur", slug: "congelateur" },
  { value: "pantry", label: "Placard", slug: "placard" },
] as const;

export type PantryLocation = (typeof LOCATIONS)[number]["value"];

const LOCATION_VALUES = LOCATIONS.map((l) => l.value) as [PantryLocation, ...PantryLocation[]];

export const locationLabel = (value: string) => LOCATIONS.find((l) => l.value === value)?.label ?? value;

/** Filtre d'emplacement lu dans l'adresse (?lieu=congelateur). */
export const locationFromSlug = (slug: string | string[] | undefined): PantryLocation | null =>
  LOCATIONS.find((l) => l.slug === slug)?.value ?? null;

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, { error: message })
    .transform((v) => v || null);

/** Code-barres EAN-8, UPC-A (12), EAN-13 ou GTIN-14 : chiffres uniquement, clé de contrôle valide. */
export function normalizeBarcode(input: unknown): string | null {
  const digits = String(input ?? "").replace(/[\s-]/g, "");
  if (!/^\d{8}$|^\d{12,14}$/.test(digits)) return null;
  const body = digits.slice(0, -1);
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const n = Number(body[body.length - 1 - i]);
    sum += i % 2 === 0 ? n * 3 : n;
  }
  return (10 - (sum % 10)) % 10 === Number(digits.at(-1)) ? digits : null;
}

export const pantryItemSchema = z.object({
  name: z.string().trim().min(1, { error: "Indique le produit." }).max(80, { error: "80 caractères maximum." }),
  brand: optionalText(80, "80 caractères maximum."),
  quantity: optionalText(40, "40 caractères maximum."),
  location: z.enum(LOCATION_VALUES, { error: "Emplacement inconnu." }),
  expiresOn: z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))), {
      error: "Date invalide.",
    })
    .transform((v) => v || null),
  barcode: z
    .string()
    .trim()
    .transform((v) => (v ? normalizeBarcode(v) : null)),
});

export type PantryItemInput = z.infer<typeof pantryItemSchema>;

export function parsePantryItemForm(formData: FormData) {
  return pantryItemSchema.safeParse({
    name: formData.get("name") ?? "",
    brand: formData.get("brand") ?? "",
    quantity: formData.get("quantity") ?? "",
    location: formData.get("location") ?? "fridge",
    expiresOn: formData.get("expiresOn") ?? "",
    barcode: formData.get("barcode") ?? "",
  });
}
