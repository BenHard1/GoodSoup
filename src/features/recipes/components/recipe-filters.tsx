import { Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DIETS } from "@/features/households/food-options";
import { cn } from "@/lib/cn";
import type { Category } from "../queries";
import { DIFFICULTIES } from "../schemas";
import { DURATIONS, SORTS, hasActiveFilters, type Filters } from "../search-params";

const selectCls =
  "min-h-11 w-full rounded-field border border-ink-faint bg-white px-3 text-base text-ink focus-visible:border-ink";

/**
 * Recherche et filtres en formulaire GET : fonctionne sans JavaScript,
 * l'adresse reflète la recherche (partageable, bouton retour du navigateur).
 */
export function RecipeFilters({
  action,
  filters,
  categories,
  hidden = {},
}: {
  action: string;
  filters: Filters;
  categories: Category[];
  hidden?: Record<string, string>;
}) {
  const active = hasActiveFilters(filters);
  const resetHref = Object.keys(hidden).length ? `${action}?${new URLSearchParams(hidden)}` : action;
  return (
    <form action={action} method="get" role="search" className="flex flex-col gap-3">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <div className="flex gap-2">
        <label htmlFor="recherche" className="sr-only">
          Rechercher une recette ou un ingrédient
        </label>
        <div className="relative flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-ink-soft"
          />
          <input
            id="recherche"
            name="q"
            type="search"
            defaultValue={filters.q}
            placeholder="Nom de recette ou ingrédient…"
            className="min-h-12 w-full rounded-full border border-ink-faint bg-white pl-10 pr-4 text-base placeholder:text-ink-faint focus-visible:border-ink"
          />
        </div>
        <Button type="submit">Chercher</Button>
      </div>
      <details className="group rounded-card border border-line bg-white" open={active}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 font-semibold">
          <SlidersHorizontal aria-hidden className="size-4" /> Filtres et tri
          {active ? <span className="rounded-full bg-coral-soft px-2 py-0.5 text-xs">actifs</span> : null}
        </summary>
        <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Catégorie
            <select name="categorie" defaultValue={filters.categorie ?? ""} className={selectCls}>
              <option value="">Toutes</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.household_id ? " (foyer)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Durée totale
            <select name="duree" defaultValue={filters.duree ?? ""} className={selectCls}>
              <option value="">Peu importe</option>
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d < 60 ? `${d} min` : `${d / 60 === 1 ? "1 h" : "1 h 30"}`} ou moins
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Difficulté
            <select name="difficulte" defaultValue={filters.difficulte ?? ""} className={selectCls}>
              <option value="">Toutes</option>
              {DIFFICULTIES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Régime
            <select name="regime" defaultValue={filters.regime ?? ""} className={selectCls}>
              <option value="">Tous</option>
              {DIETS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Trier par
            <select name="tri" defaultValue={filters.tri} className={selectCls}>
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-5">
            <Button type="submit" size="sm">
              Appliquer
            </Button>
            {active ? (
              <Link
                href={resetHref}
                className={cn(
                  "inline-flex min-h-10 items-center px-3 text-sm font-semibold text-coral-deep underline-offset-4 hover:underline",
                )}
              >
                Effacer les filtres
              </Link>
            ) : null}
          </div>
        </div>
      </details>
    </form>
  );
}
