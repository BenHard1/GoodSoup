import { parseHumanDuration } from "./duration";
import { looksLikeIngredient, parseIngredientLine } from "./ingredient-line";
import { truncate } from "./text-utils";
import type { DraftIngredient, DraftStep, ImportOrigin, RecipeDraft } from "./types";

/**
 * Analyse par règles simples d'un texte de recette brut (PDF, photo reconnue par OCR, page web sans
 * données structurées). Le résultat est toujours relu par l'utilisateur avant enregistrement.
 */

const ING_HEADING = /^(?:les\s+)?ingr[ée]dients?\b(?:\s*(?:pour|\()[^:]*)?\s*:?\s*$/i;
const STEP_HEADING =
  /^(?:la\s+)?(?:pr[ée]paration|[ée]tapes?(?:\s+de\s+pr[ée]paration)?|instructions?|d[ée]roul[ée]|m[ée]thode|r[ée]alisation|recette|directions|method|steps)\s*:?\s*$/i;
const TIPS_HEADING = /^(?:astuces?|conseils?|notes?|le\s+conseil\s+du\s+chef|variantes?|tips?)\b[^:]{0,30}:?\s*(.*)$/i;
const STEP_NUMBER =
  /^\s*(?:(?:[ÉéEe]tape|ÉTAPE|[Ss]tep)\s*(\d+)\s*[:.)-]?|(\d{1,2})\s*[.)/-](?!\d)|(\d{1,2})\s+(?=[A-ZÀ-Ý]))\s*/;
const stepNumber = (line: string) => {
  const m = line.match(STEP_NUMBER);
  return m ? Number(m[1] ?? m[2] ?? m[3]) : null;
};

const SERVINGS_RE =
  /(?:pour|serves?|servings?|portions?)\s*:?\s*(\d{1,3})(?:\s*(?:personnes?|pers\.?|parts?|portions?|people|couverts))?|(\d{1,3})\s*(?:personnes?|pers\.|parts|portions|couverts)\b/i;
const TIME_RE = {
  prep: /(?:temps\s+de\s+)?pr[ée]paration\s*:?\s*([^,;|]*?\d[^,;|]*?)(?=$|[,;|]|\s+(?:temps|cuisson|repos)\b)/i,
  cook: /(?:temps\s+de\s+)?cuisson\s*:?\s*([^,;|]*?\d[^,;|]*?)(?=$|[,;|]|\s+(?:temps|pr[ée]paration|repos)\b)/i,
  rest: /(?:temps\s+de\s+)?repos\s*:?\s*([^,;|]*?\d[^,;|]*?)(?=$|[,;|]|\s+(?:temps|pr[ée]paration|cuisson)\b)/i,
};

type Meta = { servings: number | null; prep: number | null; cook: number | null; rest: number | null };

/** Lit portions et durées sur une ligne ; retourne true si la ligne n'était que des métadonnées. */
function readMeta(line: string, meta: Meta): boolean {
  let consumed = line;
  const s = line.match(SERVINGS_RE);
  if (s && meta.servings === null) {
    const n = Number(s[1] ?? s[2]);
    if (n >= 1 && n <= 100) meta.servings = n;
  }
  if (s) consumed = consumed.replace(s[0], " ");
  for (const key of ["prep", "cook", "rest"] as const) {
    const m = line.match(TIME_RE[key]);
    if (!m) continue;
    const minutes = parseHumanDuration(m[1]);
    if (minutes !== null && meta[key] === null) meta[key] = minutes;
    if (minutes !== null) consumed = consumed.replace(m[0], " ");
  }
  // Ligne de métadonnées si, une fois ces informations retirées, il ne reste que de la ponctuation.
  return (
    consumed !== line &&
    !/[\p{L}]{3,}/u.test(consumed.replace(/temps|total|difficult[ée]\s*:?\s*\w+|co[uû]t\s*:?\s*\w+/gi, ""))
  );
}

const isSectionLabel = (line: string) => /^[^.!?]{2,60}:$/.test(line) && !/^\d/.test(line);

function normalizeLines(text: string): string[] {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/(\p{L})-\n(\p{Ll})/gu, "$1$2") // césure en fin de ligne (OCR, PDF)
    .split("\n")
    .map((l) =>
      l
        .replace(/\s+/g, " ")
        .replace(/^[|_~=]+\s*/, "")
        .trim(),
    )
    .filter((l) => l && !/^[\p{P}\p{S}\s\d]{0,3}$/u.test(l) && !/^(?:page\s*)?\d+\s*(?:\/\s*\d+)?$/i.test(l));
}

export function recipeFromText(
  text: string,
  origin: ImportOrigin,
  options: { sourceUrl?: string | null; sourceName?: string | null } = {},
): RecipeDraft {
  const lines = normalizeLines(text);
  const meta: Meta = { servings: null, prep: null, cook: null, rest: null };
  const warnings: string[] = [];

  let title = "";
  const intro: string[] = [];
  const ingredientLines: { section: string | null; line: string }[] = [];
  const stepLines: { section: string | null; line: string; numbered: boolean }[] = [];
  const tips: string[] = [];

  type Zone = "intro" | "ingredients" | "steps" | "tips";
  let zone: Zone = "intro";
  let section: string | null = null;
  const sawIngredientHeading = lines.some((l) => ING_HEADING.test(l));
  const sawStepHeading = lines.some((l) => STEP_HEADING.test(l));

  for (const line of lines) {
    if (ING_HEADING.test(line)) {
      readMeta(line, meta);
      zone = "ingredients";
      section = null;
      continue;
    }
    if (STEP_HEADING.test(line)) {
      zone = "steps";
      section = null;
      continue;
    }
    const tip = line.match(TIPS_HEADING);
    if (tip && (zone === "steps" || zone === "ingredients") && line.length < 60) {
      zone = "tips";
      if (tip[1]) tips.push(tip[1]);
      continue;
    }
    if (readMeta(line, meta)) continue;

    if (zone === "intro") {
      if (!title && line.length <= 150 && !looksLikeIngredient(line)) {
        title = line;
        continue;
      }
      // Sans titre de section « Ingrédients », les lignes en forme d'ingrédient y vont directement.
      if (!sawIngredientHeading && looksLikeIngredient(line)) {
        zone = "ingredients";
      } else if (!sawIngredientHeading && STEP_NUMBER.test(line)) {
        zone = "steps";
      } else {
        intro.push(line);
        continue;
      }
    }

    if (zone === "ingredients") {
      if (isSectionLabel(line)) {
        section = line.replace(/:$/, "").trim().slice(0, 80);
        continue;
      }
      // Sans titre « Préparation », la première ligne qui n'a pas l'air d'un ingrédient ouvre les étapes.
      if (!sawStepHeading && !looksLikeIngredient(line) && (line.length > 60 || STEP_NUMBER.test(line))) {
        zone = "steps";
        section = null;
      } else {
        ingredientLines.push({ section, line });
        continue;
      }
    }

    if (zone === "steps") {
      if (isSectionLabel(line)) {
        section = line.replace(/:$/, "").trim().slice(0, 80);
        continue;
      }
      stepLines.push({ section, line, numbered: STEP_NUMBER.test(line) });
      continue;
    }

    if (zone === "tips") tips.push(line);
  }

  const ingredients = ingredientLines
    .map(({ section: s, line }) => parseIngredientLine(line, s))
    .filter((x): x is DraftIngredient => x !== null)
    .slice(0, 100);

  const steps = mergeSteps(stepLines).slice(0, 60);

  if (!title) {
    title = "Recette importée";
    warnings.push("Le titre n'a pas été reconnu.");
  }
  if (!ingredients.length) warnings.push("Aucun ingrédient n'a été reconnu : ajoute-les à la main.");
  if (!steps.length) warnings.push("Aucune étape n'a été reconnue : ajoute-les à la main.");
  if (ingredients.some((i) => !i.quantity && !i.unit_code))
    warnings.push("Certains ingrédients n'ont pas de quantité : vérifie qu'aucune n'a été mal lue.");

  return {
    origin,
    method: "text",
    title: truncate(title.replace(/\s*[:.]$/, ""), 150),
    description: intro.length ? truncate(intro.join(" "), 2000) : null,
    servings: meta.servings,
    prepMinutes: meta.prep,
    cookMinutes: meta.cook,
    restMinutes: meta.rest,
    ingredients,
    steps,
    tips: tips.length ? truncate(tips.join("\n"), 5000) : null,
    tags: [],
    sourceUrl: options.sourceUrl ?? null,
    sourceName: options.sourceName ?? null,
    attribution: null,
    imageUrl: null,
    warnings,
  };
}

/**
 * Regroupe les lignes en étapes : une ligne numérotée ouvre une étape ; sinon, une ligne qui suit une
 * phrase inachevée (pas de point final) la continue — c'est le cas des retours à la ligne des PDF et photos.
 */
function mergeSteps(lines: { section: string | null; line: string; numbered: boolean }[]): DraftStep[] {
  const steps: DraftStep[] = [];
  const anyNumbered = lines.some((l) => l.numbered);
  let expected = 1;
  for (const { section, line, numbered: looksNumbered } of lines) {
    // Une ligne n'ouvre une étape numérotée que si son numéro suit le précédent (« 30 minutes… » ne compte pas).
    const n = looksNumbered ? stepNumber(line) : null;
    const numbered = n !== null && (n === expected || n === 1);
    if (numbered) expected = n + 1;
    const content = (numbered ? line.replace(STEP_NUMBER, "") : line).trim();
    if (!content) {
      if (numbered) steps.push({ section, instruction: "" });
      continue;
    }
    const last = steps[steps.length - 1];
    const continues =
      last &&
      last.section === section &&
      (anyNumbered ? !numbered : !/[.!?]$/.test(last.instruction) || /^\p{Ll}/u.test(content));
    if (continues || (last && last.instruction === "")) {
      last.instruction = `${last.instruction} ${content}`.trim();
    } else {
      steps.push({ section, instruction: content });
    }
  }
  return steps.filter((s) => s.instruction).map((s) => ({ ...s, instruction: truncate(s.instruction, 3000) }));
}
