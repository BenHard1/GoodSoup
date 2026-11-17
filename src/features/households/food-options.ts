/** Les 14 allergènes à déclaration obligatoire dans l'Union européenne (règlement INCO). */
export const ALLERGENS = [
  { value: "gluten", label: "Gluten" },
  { value: "crustaces", label: "Crustacés" },
  { value: "oeufs", label: "Œufs" },
  { value: "poissons", label: "Poissons" },
  { value: "arachides", label: "Arachides" },
  { value: "soja", label: "Soja" },
  { value: "lait", label: "Lait" },
  { value: "fruits-a-coque", label: "Fruits à coque" },
  { value: "celeri", label: "Céleri" },
  { value: "moutarde", label: "Moutarde" },
  { value: "sesame", label: "Sésame" },
  { value: "sulfites", label: "Sulfites" },
  { value: "lupin", label: "Lupin" },
  { value: "mollusques", label: "Mollusques" },
] as const;

export const DIETS = [
  { value: "vegetarien", label: "Végétarien" },
  { value: "vegan", label: "Végétalien (vegan)" },
  { value: "pescetarien", label: "Pescétarien" },
  { value: "sans-gluten", label: "Sans gluten" },
  { value: "sans-lactose", label: "Sans lactose" },
  { value: "sans-porc", label: "Sans porc" },
  { value: "halal", label: "Halal" },
  { value: "casher", label: "Casher" },
] as const;

export const ALLERGEN_VALUES = ALLERGENS.map((a) => a.value) as string[];
export const DIET_VALUES = DIETS.map((d) => d.value) as string[];

/** « tomate, coriandre ; olives » → ["tomate", "coriandre", "olives"] (dédoublonné, nettoyé). */
export function parseList(input: unknown, max = 50): string[] {
  if (typeof input !== "string") return [];
  const items = input
    .split(/[,;\n]/)
    .map((s) => s.trim().replace(/\s+/g, " ").slice(0, 60))
    .filter(Boolean);
  return [...new Map(items.map((i) => [i.toLocaleLowerCase("fr"), i])).values()].slice(0, max);
}
