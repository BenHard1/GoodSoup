/**
 * Quantités d'ingrédients : saisie libre (« 1/2 », « 1,5 », « 2-3 », « ½ ») et affichage à la française.
 * L'ajustement du nombre de portions ne modifie jamais la recette enregistrée : il est purement visuel.
 */

const UNICODE_FRACTIONS: Record<string, number> = {
  "¼": 0.25,
  "½": 0.5,
  "¾": 0.75,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅛": 0.125,
};

export type QuantityRange = { quantity: number | null; quantityMax: number | null };

function parseSingle(raw: string): number | null {
  let s = raw.trim().replace(",", ".");
  if (!s) return null;
  // « 1½ » ou « 1 ½ »
  let unicode = 0;
  for (const [ch, v] of Object.entries(UNICODE_FRACTIONS)) {
    if (s.endsWith(ch)) {
      unicode = v;
      s = s.slice(0, -ch.length).trim();
      break;
    }
  }
  if (!s) return unicode || null;
  // « 1 1/2 »
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const den = Number(mixed[3]);
    return den ? Number(mixed[1]) + Number(mixed[2]) / den + unicode : null;
  }
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) {
    const den = Number(frac[2]);
    return den ? Number(frac[1]) / den + unicode : null;
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return Number(s) + unicode;
}

/** Analyse une quantité saisie. Retourne null si la saisie n'est pas comprise. */
export function parseQuantity(input: string): QuantityRange | null {
  const s = input.trim();
  if (!s) return { quantity: null, quantityMax: null };
  const parts = s.split(/\s*(?:-|–|à)\s*/);
  if (parts.length > 2) return null;
  const min = parseSingle(parts[0]);
  if (min === null || min <= 0) return null;
  if (parts.length === 1) return { quantity: round(min), quantityMax: null };
  const max = parseSingle(parts[1]);
  if (max === null || max < min) return null;
  return { quantity: round(min), quantityMax: max === min ? null : round(max) };
}

const round = (n: number, digits = 3) => Math.round(n * 10 ** digits) / 10 ** digits;

const NICE_FRACTIONS: [number, string][] = [
  [0.25, "¼"],
  [1 / 3, "⅓"],
  [0.5, "½"],
  [2 / 3, "⅔"],
  [0.75, "¾"],
];

/** 0.5 → « ½ », 1.5 → « 1 ½ », 2.25 → « 2 ¼ », 1.2 → « 1,2 », 333.333 → « 333 ». */
export function formatQuantity(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  const whole = Math.floor(n);
  const frac = n - whole;
  if (n < 10) {
    for (const [v, ch] of NICE_FRACTIONS) {
      if (Math.abs(frac - v) < 0.02) return whole ? `${whole} ${ch}` : ch;
    }
  }
  const digits = n >= 100 ? 0 : n >= 10 ? 1 : 2;
  return round(n, digits).toLocaleString("fr-FR", { maximumFractionDigits: digits });
}

/** Valeur saisissable dans le formulaire (« 1,5 », « 2-3 »). */
export function quantityToInput(quantity: number | null, quantityMax: number | null): string {
  if (quantity === null) return "";
  const fmt = (n: number) => String(round(n)).replace(".", ",");
  return quantityMax !== null ? `${fmt(quantity)}-${fmt(quantityMax)}` : fmt(quantity);
}

/** Met une quantité à l'échelle du nombre de portions voulu. */
export function scaleQuantity(n: number | null, baseServings: number, targetServings: number): number | null {
  if (n === null || !baseServings || baseServings <= 0) return n;
  return n * (targetServings / baseServings);
}

export type Unit = { code: string; label: string; plural: string; kind: string };

export type DisplayIngredient = {
  name: string;
  quantity: number | null;
  quantity_max: number | null;
  unit_code: string | null;
  note: string | null;
  is_optional: boolean;
};

/** « 1 ½ c. à soupe d'huile d'olive », « 3 œufs », « sel » ; mise à l'échelle comprise. */
export function formatIngredientQuantity(
  ing: Pick<DisplayIngredient, "quantity" | "quantity_max" | "unit_code">,
  units: Map<string, Unit>,
  factor = 1,
): string {
  const q = ing.quantity !== null ? ing.quantity * factor : null;
  const qMax = ing.quantity_max !== null ? ing.quantity_max * factor : null;
  const unit = ing.unit_code ? units.get(ing.unit_code) : undefined;
  if (q === null) {
    return unit && unit.kind === "other" ? unit.label : "";
  }
  const amount = qMax !== null ? `${formatQuantity(q)} à ${formatQuantity(qMax)}` : formatQuantity(q);
  if (!unit || unit.code === "piece") return amount;
  const plural = (qMax ?? q) > 1;
  return `${amount} ${plural ? unit.plural : unit.label}`;
}
