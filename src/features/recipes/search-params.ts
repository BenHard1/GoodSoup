import { z } from "zod";
import { DIET_VALUES } from "@/features/households/food-options";
import type { Difficulty, SearchSort } from "./queries";

type Raw = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export type Filters = {
  q: string;
  categorie: string | null;
  duree: number | null;
  difficulte: Difficulty | null;
  regime: string | null;
  tri: SearchSort;
  page: number;
};

export const DURATIONS = [15, 30, 45, 60, 90] as const;
export const SORTS: { value: SearchSort; label: string }[] = [
  { value: "recent", label: "Plus récentes" },
  { value: "updated", label: "Modifiées récemment" },
  { value: "alpha", label: "Ordre alphabétique" },
  { value: "popular", label: "Les plus appréciées" },
];

/** Lit les filtres de l'adresse en ignorant toute valeur inattendue. */
export function parseFilters(raw: Raw, defaultSort: SearchSort = "recent"): Filters {
  const categorie = z.uuid().safeParse(first(raw.categorie));
  const duree = Number(first(raw.duree));
  const difficulte = z.enum(["easy", "medium", "hard"]).safeParse(first(raw.difficulte));
  const regime = first(raw.regime);
  const tri = z.enum(["recent", "updated", "alpha", "popular"]).safeParse(first(raw.tri));
  const page = Number.parseInt(first(raw.page), 10);
  return {
    q: first(raw.q).trim().slice(0, 100),
    categorie: categorie.success ? categorie.data : null,
    duree: (DURATIONS as readonly number[]).includes(duree) ? duree : null,
    difficulte: difficulte.success ? difficulte.data : null,
    regime: DIET_VALUES.includes(regime) ? regime : null,
    tri: tri.success ? tri.data : defaultSort,
    page: Number.isFinite(page) && page > 0 && page < 1000 ? page : 1,
  };
}

export const hasActiveFilters = (f: Filters) => Boolean(f.q || f.categorie || f.duree || f.difficulte || f.regime);

/** Construit une adresse en conservant les filtres courants. */
export function filtersHref(base: string, f: Partial<Filters> & Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (v === null || v === undefined || v === "" || (k === "page" && v === 1)) continue;
    params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `${base}?${s}` : base;
}
