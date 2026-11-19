/**
 * Open Food Facts : base collaborative et gratuite de produits alimentaires (licence ODbL).
 * Aucune clé n'est nécessaire ; l'API demande seulement un User-Agent qui identifie l'application.
 * https://openfoodfacts.github.io/openfoodfacts-server/api/
 */

export const OFF_SOURCE = {
  name: "Open Food Facts",
  url: "https://world.openfoodfacts.org",
  license: "ODbL",
} as const;

export type OffProduct = { name: string; brand: string | null; quantity: string | null };

const clean = (value: unknown, max: number) => {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
};

/** Extrait le nom (français en priorité), la première marque et la contenance d'une réponse de l'API. */
export function parseOffResponse(body: unknown): OffProduct | null {
  if (!body || typeof body !== "object") return null;
  const { status, product } = body as { status?: unknown; product?: Record<string, unknown> };
  if (status !== 1 || !product || typeof product !== "object") return null;
  const name =
    clean(product.product_name_fr, 80) ?? clean(product.product_name, 80) ?? clean(product.generic_name_fr, 80);
  if (!name) return null;
  const brand = clean(typeof product.brands === "string" ? product.brands.split(",")[0] : null, 80);
  return { name, brand, quantity: clean(product.quantity, 40) };
}

export const offProductUrl = (barcode: string) =>
  `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,product_name_fr,generic_name_fr,brands,quantity`;
