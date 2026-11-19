import { parseQuantity, quantityToInput } from "@/features/recipes/quantity";
import type { DraftIngredient } from "./types";

/**
 * Analyse une ligne d'ingrédient libre (« 200 g de farine », « 2 c. à soupe d'huile d'olive »,
 * « 1 boîte (400 g) de tomates concassées », « Sel, poivre ») en ingrédient structuré.
 * Les unités reconnues correspondent au référentiel `public.units` ; une unité inconnue reste dans le nom.
 */

// Alias → code d'unité. Les variantes les plus longues sont testées d'abord.
const UNIT_ALIASES: [string, string][] = [
  ["cuillères à soupe", "cs"],
  ["cuillère à soupe", "cs"],
  ["cuillerées à soupe", "cs"],
  ["cuillerée à soupe", "cs"],
  ["cuil. à soupe", "cs"],
  ["c. à soupe", "cs"],
  ["c.à soupe", "cs"],
  ["c.à.s.", "cs"],
  ["c.à.s", "cs"],
  ["c. à s.", "cs"],
  ["càs", "cs"],
  ["cas", "cs"],
  ["cs", "cs"],
  ["tablespoons", "cs"],
  ["tablespoon", "cs"],
  ["tbsp.", "cs"],
  ["tbsp", "cs"],
  ["cuillères à café", "cc"],
  ["cuillère à café", "cc"],
  ["cuillerées à café", "cc"],
  ["cuillerée à café", "cc"],
  ["cuil. à café", "cc"],
  ["c. à café", "cc"],
  ["c.à café", "cc"],
  ["c.à.c.", "cc"],
  ["c.à.c", "cc"],
  ["c. à c.", "cc"],
  ["càc", "cc"],
  ["cac", "cc"],
  ["cc", "cc"],
  ["teaspoons", "cc"],
  ["teaspoon", "cc"],
  ["tsp.", "cc"],
  ["tsp", "cc"],
  ["kilogrammes", "kg"],
  ["kilogramme", "kg"],
  ["kilos", "kg"],
  ["kilo", "kg"],
  ["kg", "kg"],
  ["milligrammes", "mg"],
  ["mg", "mg"],
  ["grammes", "g"],
  ["gramme", "g"],
  ["grams", "g"],
  ["gram", "g"],
  ["gr.", "g"],
  ["gr", "g"],
  ["g", "g"],
  ["millilitres", "ml"],
  ["millilitre", "ml"],
  ["ml", "ml"],
  ["centilitres", "cl"],
  ["centilitre", "cl"],
  ["cl", "cl"],
  ["décilitres", "dl"],
  ["décilitre", "dl"],
  ["dl", "dl"],
  ["litres", "l"],
  ["litre", "l"],
  ["liters", "l"],
  ["liter", "l"],
  ["l", "l"],
  ["tasses", "tasse"],
  ["tasse", "tasse"],
  ["cups", "tasse"],
  ["cup", "tasse"],
  ["verres", "verre"],
  ["verre", "verre"],
  ["gousses", "gousse"],
  ["gousse", "gousse"],
  ["tranches", "tranche"],
  ["tranche", "tranche"],
  ["bottes", "botte"],
  ["botte", "botte"],
  ["bouquets", "botte"],
  ["bouquet", "botte"],
  ["feuilles", "feuille"],
  ["feuille", "feuille"],
  ["brins", "brin"],
  ["brin", "brin"],
  ["boîtes", "boite"],
  ["boîte", "boite"],
  ["boites", "boite"],
  ["boite", "boite"],
  ["sachets", "sachet"],
  ["sachet", "sachet"],
  ["pots", "pot"],
  ["pot", "pot"],
  ["paquets", "paquet"],
  ["paquet", "paquet"],
  ["pincées", "pincee"],
  ["pincée", "pincee"],
  ["pincees", "pincee"],
  ["pincee", "pincee"],
  ["filets", "filet"],
  ["filet", "filet"],
  ["noix", "noix"],
  ["poignées", "poignee"],
  ["poignée", "poignee"],
  ["pièces", "piece"],
  ["pièce", "piece"],
  ["pcs", "piece"],
];

// Unités qui ne doivent être reconnues que suivies de « de » / « d' » (sinon c'est l'ingrédient : « 3 noix »).
const NEEDS_OF = new Set(["noix", "filet", "feuille", "verre", "pot", "botte"]);

const FRACTIONS = "¼½¾⅓⅔⅛";
const NUM = `(?:\\d+\\s+\\d+/\\d+|\\d+/\\d+|\\d+(?:[.,]\\d+)?\\s?[${FRACTIONS}]?|[${FRACTIONS}])`;
const QTY_RE = new RegExp(`^(${NUM}(?:\\s*(?:-|–|à|to|ou)\\s*${NUM})?)(?![\\d/])`, "i");
const ARTICLE_QTY_RE = /^(une?|a|an)\s+/i;
const OF_RE = /^(?:de\s+la\s+|de\s+l['’]\s*|des\s+|du\s+|de\s+|d['’]\s*|of\s+)/i;
const QS_RE = /^(?:q\.?\s?s\.?|quantité suffisante)(?:\s+(?:de\s+|d['’]))?\s*/i;
const OPTIONAL_RE =
  /\s*[([]?\s*(?:facultatif|facultative|optionnel(?:le)?|optional|selon (?:les )?goûts?)\s*[)\]]?\s*/i;
const BULLET_RE = /^\s*(?:[-–—•*·▪●○◦►✓✔︎☐□]+|\d+[.)]\s+(?=\D))\s*/;

function matchUnit(rest: string): { code: string; length: number } | null {
  const lower = rest.toLowerCase();
  for (const [alias, code] of UNIT_ALIASES) {
    if (!lower.startsWith(alias)) continue;
    const after = rest.slice(alias.length);
    // Fin de mot (« g » ne doit pas avaler « gingembre »), sauf alias terminé par un point.
    if (!alias.endsWith(".") && /^[\p{L}\d]/u.test(after)) continue;
    if (NEEDS_OF.has(alias.replace(/s$/, "")) || NEEDS_OF.has(code)) {
      if (!OF_RE.test(after.trimStart())) continue;
    }
    return { code, length: alias.length };
  }
  return null;
}

function normalizeQuantity(raw: string): string | null {
  const s = raw
    .replace(/\s+(?:to|ou)\s+/i, "-")
    .replace(/(\d)\s?([¼½¾⅓⅔⅛])/g, "$1 $2")
    .trim();
  const q = parseQuantity(s);
  if (!q || q.quantity === null) return null;
  return quantityToInput(q.quantity, q.quantityMax);
}

export function parseIngredientLine(input: string, section: string | null = null): DraftIngredient | null {
  let line = input.replace(/\s+/g, " ").replace(BULLET_RE, "").trim();
  if (!line || line.length > 300) return line ? fallback(line.slice(0, 300), section) : null;

  let is_optional = false;
  if (OPTIONAL_RE.test(line)) {
    is_optional = true;
    line = line
      .replace(OPTIONAL_RE, " ")
      .replace(/\s+/g, " ")
      .replace(/[,;]\s*$/, "")
      .trim();
  }

  let quantity = "";
  let unit_code: string | null = null;

  const qs = line.match(QS_RE);
  if (qs) {
    unit_code = "qs";
    line = line.slice(qs[0].length);
  } else {
    const q = line.match(QTY_RE);
    if (q) {
      const normalized = normalizeQuantity(q[1]);
      if (normalized) {
        quantity = normalized;
        line = line.slice(q[0].length).trimStart();
      }
    } else {
      // « une pincée de sel », « a cup of sugar » : l'article vaut 1 seulement devant une unité.
      const art = line.match(ARTICLE_QTY_RE);
      if (art) {
        const unit = matchUnit(line.slice(art[0].length));
        if (unit) {
          quantity = "1";
          line = line.slice(art[0].length);
        }
      }
    }
    if (quantity) {
      const unit = matchUnit(line);
      if (unit) {
        unit_code = unit.code;
        line = line.slice(unit.length).trimStart();
      }
    }
  }

  // « 1 boîte (400 g) de tomates » : la précision entre parenthèses devient une note.
  const notes: string[] = [];
  line = line.replace(/^\(([^)]{1,80})\)\s*/, (_, inner: string) => {
    notes.push(inner.trim());
    return "";
  });
  if (quantity || unit_code) line = line.replace(OF_RE, "");
  line = line.replace(/\s*\(([^)]{1,120})\)\s*/g, (_, inner: string) => {
    notes.push(inner.trim());
    return " ";
  });
  line = line.trim();

  // « oignon, émincé » : après la virgule, une note — seulement si une quantité a été lue,
  // pour garder « Sel, poivre » comme un seul ingrédient.
  if ((quantity || unit_code) && line.includes(",")) {
    const [name, ...rest] = line.split(",");
    if (name.trim()) {
      notes.push(rest.join(",").trim());
      line = name.trim();
    }
  }

  if (!line) {
    if (!quantity) return null;
    line = notes.shift() ?? "";
    if (!line) return null;
  }
  if (unit_code === "piece") unit_code = null;

  return {
    section,
    quantity,
    unit_code,
    name: capitalize(line).slice(0, 120),
    note: notes.filter(Boolean).join(", ").slice(0, 200) || null,
    is_optional,
  };
}

function fallback(line: string, section: string | null): DraftIngredient {
  return { section, quantity: "", unit_code: null, name: line.slice(0, 120), note: null, is_optional: false };
}

const capitalize = (s: string) => (s ? s[0].toLocaleUpperCase("fr") + s.slice(1) : s);

/** Une ligne ressemble-t-elle à un ingrédient (commence par une quantité, une puce ou une unité) ? */
export function looksLikeIngredient(line: string): boolean {
  const s = line.trim();
  if (!s || s.length > 120) return false;
  if (/[.!?]$/.test(s) && s.split(" ").length > 8) return false;
  if (BULLET_RE.test(s) && !/^\d+[.)]/.test(s)) return true;
  if (QS_RE.test(s)) return true;
  const q = s.match(QTY_RE);
  if (q) {
    const rest = s.slice(q[0].length).trimStart();
    // « 180 °C », « 20 minutes » : pas des ingrédients.
    if (/^(?:°|degrés|min|minutes?|heures?|h\b|personnes?|pers|portions?|parts?)/i.test(rest)) return false;
    return rest.length > 0 && s.split(" ").length <= 14;
  }
  const art = s.match(ARTICLE_QTY_RE);
  return Boolean(art && matchUnit(s.slice(art[0].length)));
}
