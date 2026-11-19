import { parseIsoDuration } from "./duration";
import { parseIngredientLine } from "./ingredient-line";
import { cleanInline, decodeEntities, htmlToText, truncate } from "./text-utils";
import type { DraftIngredient, DraftStep, RecipeDraft } from "./types";

/**
 * Lecture des données structurées schema.org/Recipe (JSON-LD) qu'une grande partie des sites de recettes
 * publient pour les moteurs de recherche. Aucune IA : on lit ce que le site déclare lui-même.
 */

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Obj = { [k: string]: Json };

const isObj = (v: Json | undefined): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const asArray = (v: Json | undefined): Json[] => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);

function hasType(o: Obj, type: string): boolean {
  return asArray(o["@type"]).some((t) => typeof t === "string" && t.replace(/^.*[/#]/, "") === type);
}

/** Blocs <script type="application/ld+json"> d'une page. */
export function extractJsonLdBlocks(html: string): Json[] {
  const out: Json[] = [];
  const re = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    const raw = m[1].trim().replace(/^<!\[CDATA\[|\]\]>$/g, "");
    for (const candidate of [raw, raw.replace(/[\u0000-\u001f]+/g, " ").replace(/,\s*([}\]])/g, "$1")]) {
      try {
        out.push(JSON.parse(candidate) as Json);
        break;
      } catch {
        // bloc invalide : on essaie la version nettoyée, sinon on l'ignore
      }
    }
  }
  return out;
}

/** Première entité Recipe trouvée (tableaux, @graph, mainEntity compris). */
export function findRecipe(blocks: Json[]): Obj | null {
  const seen = new Set<Json>();
  const stack = [...blocks];
  while (stack.length) {
    const node = stack.shift();
    if (node === undefined || node === null || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);
    if (Array.isArray(node)) {
      stack.push(...node);
      continue;
    }
    if (hasType(node, "Recipe")) return node;
    for (const key of ["@graph", "mainEntity", "mainEntityOfPage", "itemListElement", "item"]) {
      if (node[key] !== undefined) stack.push(node[key] as Json);
    }
  }
  return null;
}

const text = (v: Json | undefined): string | null => {
  if (typeof v === "string") return cleanInline(v) || null;
  if (typeof v === "number") return String(v);
  if (isObj(v)) return text(v.name ?? v.text ?? v["@value"]);
  if (Array.isArray(v)) return text(v[0]);
  return null;
};

function nameOf(v: Json | undefined): string | null {
  const names = asArray(v)
    .map((x) => (isObj(x) ? text(x.name) : text(x)))
    .filter((x): x is string => Boolean(x));
  return names.length ? names.join(", ") : null;
}

/** recipeYield : « 4 », « 4 personnes », ["4", "4 servings"], 6. */
export function parseServings(v: Json | undefined): number | null {
  for (const item of asArray(v)) {
    const s = typeof item === "number" ? String(item) : typeof item === "string" ? item : null;
    const m = s?.match(/\d+/);
    if (m) {
      const n = Number(m[0]);
      if (n >= 1 && n <= 100) return n;
    }
  }
  return null;
}

function imageOf(v: Json | undefined): string | null {
  for (const item of asArray(v)) {
    const url = typeof item === "string" ? item : isObj(item) ? (item.url ?? item.contentUrl) : null;
    if (typeof url === "string" && /^https?:\/\//i.test(url)) return url;
  }
  return null;
}

function instructionsOf(v: Json | undefined): DraftStep[] {
  const steps: DraftStep[] = [];
  const visit = (node: Json | undefined, section: string | null) => {
    for (const item of asArray(node)) {
      if (typeof item === "string") {
        // Un seul bloc de texte : une étape par ligne (ou par paragraphe HTML).
        for (const line of htmlToText(item).split("\n")) {
          const t = line.replace(/^\s*(?:\d+[.)]|étape\s*\d+\s*[:.-]?)\s*/i, "").trim();
          if (t) steps.push({ section, instruction: t });
        }
      } else if (isObj(item)) {
        if (hasType(item, "HowToSection")) {
          visit(item.itemListElement ?? item.steps, text(item.name));
        } else if (item.itemListElement !== undefined && !item.text) {
          visit(item.itemListElement, section);
        } else {
          const t = text(item.text) ?? text(item.name) ?? text(item.description);
          if (t) steps.push({ section, instruction: t });
        }
      }
    }
  };
  visit(v, null);
  return steps;
}

function tagsOf(recipe: Obj): string[] {
  const raw = [recipe.recipeCategory, recipe.recipeCuisine, recipe.keywords].flatMap((v) =>
    asArray(v).flatMap((x) => (typeof x === "string" ? decodeEntities(x).split(",") : [])),
  );
  const seen = new Set<string>();
  return raw
    .map((t) => t.trim())
    .filter((t) => {
      const k = t.toLocaleLowerCase("fr");
      if (!t || t.length > 40 || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 10);
}

/** Valeur d'une balise <meta property="og:…"> ou <meta name="…">. */
export function metaContent(html: string, key: string): string | null {
  const re = new RegExp(
    `<meta\\b(?=[^>]*\\b(?:property|name)\\s*=\\s*["']${key.replace(/[.:]/g, "\\$&")}["'])[^>]*\\bcontent\\s*=\\s*["']([^"']*)["']`,
    "i",
  );
  const m = html.match(re);
  return m ? cleanInline(m[1]) || null : null;
}

export function recipeFromJsonLd(html: string, sourceUrl: string): RecipeDraft | null {
  const recipe = findRecipe(extractJsonLdBlocks(html));
  if (!recipe) return null;

  const warnings: string[] = [];
  const ingredients: DraftIngredient[] = asArray(recipe.recipeIngredient ?? recipe.ingredients)
    .map((x) => (typeof x === "string" ? x : text(x)))
    .filter((x): x is string => Boolean(x))
    .map((line) => parseIngredientLine(cleanInline(line)))
    .filter((x): x is DraftIngredient => x !== null);
  const steps = instructionsOf(recipe.recipeInstructions);

  let prep = parseIsoDuration(recipe.prepTime);
  const cook = parseIsoDuration(recipe.cookTime);
  const total = parseIsoDuration(recipe.totalTime);
  if (prep === null && cook === null && total !== null) {
    prep = total;
    warnings.push("Le site n'indique qu'un temps total : il a été placé en préparation.");
  }
  const rest =
    total !== null && prep !== null && cook !== null && total - prep - cook >= 5 ? total - prep - cook : null;

  if (!ingredients.length) warnings.push("Aucun ingrédient n'a été trouvé : ajoute-les à la main.");
  if (!steps.length) warnings.push("Aucune étape n'a été trouvée : ajoute-les à la main.");

  const host = safeHost(sourceUrl);
  const author = nameOf(recipe.author);
  return {
    origin: "import_url",
    method: "structured",
    title: truncate(text(recipe.name) ?? metaContent(html, "og:title") ?? "Recette importée", 150),
    description: (() => {
      const d = text(recipe.description);
      return d ? truncate(d, 2000) : null;
    })(),
    servings: parseServings(recipe.recipeYield),
    prepMinutes: prep,
    cookMinutes: cook,
    restMinutes: rest,
    ingredients,
    steps,
    tips: null,
    tags: tagsOf(recipe),
    sourceUrl,
    sourceName: truncate(nameOf(recipe.publisher) ?? metaContent(html, "og:site_name") ?? host ?? "", 200) || null,
    attribution: author ? truncate(`Recette de ${author}`, 300) : null,
    imageUrl: imageOf(recipe.image),
    warnings,
  };
}

export function safeHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
