import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { getActiveHousehold } from "@/features/households/queries";
import { Pagination } from "@/features/recipes/components/pagination";
import { RecipeGrid } from "@/features/recipes/components/recipe-card";
import { RecipeFilters } from "@/features/recipes/components/recipe-filters";
import { getCategories, searchRecipes, type SearchScope } from "@/features/recipes/queries";
import { hasActiveFilters, parseFilters } from "@/features/recipes/search-params";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Mes recettes" };

const TABS: { value: string; scope: SearchScope; label: string }[] = [
  { value: "miennes", scope: "mine", label: "Mes recettes" },
  { value: "foyer", scope: "household", label: "Du foyer" },
  { value: "favoris", scope: "favorites", label: "Favoris" },
];

export default async function RecettesPage({ searchParams }: PageProps<"/recettes">) {
  const raw = await searchParams;
  const tab = TABS.find((t) => t.value === raw.vue) ?? TABS[0];
  const filters = parseFilters(raw);
  const [household, categories] = await Promise.all([getActiveHousehold(), getCategories()]);
  const { cards, hasMore } = await searchRecipes({
    scope: tab.scope,
    householdId: household?.id,
    query: filters.q,
    categoryIds: filters.categorie ? [filters.categorie] : [],
    maxMinutes: filters.duree,
    difficulty: filters.difficulte,
    diets: filters.regime ? [filters.regime] : [],
    sort: filters.tri,
    page: filters.page,
  });
  const visibleCategories = categories.filter((c) => !c.household_id || c.household_id === household?.id);

  return (
    <>
      <PageHeader
        title="Mes recettes"
        description={household ? `Ton carnet et celui du foyer « ${household.name} ».` : undefined}
        actions={
          <Button asChild>
            <Link href="/recettes/nouvelle">
              <Plus aria-hidden className="size-5" /> Nouvelle recette
            </Link>
          </Button>
        }
      />
      {raw.supprimee ? (
        <Alert tone="success" className="mb-4">
          Recette supprimée.
        </Alert>
      ) : null}

      <nav aria-label="Bibliothèques" className="mb-4 flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={t.value === "miennes" ? "/recettes" : `/recettes?vue=${t.value}`}
            aria-current={t.value === tab.value ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center rounded-full px-4 font-semibold",
              t.value === tab.value ? "bg-ink text-white" : "border border-line bg-white hover:bg-cream",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <RecipeFilters
        action="/recettes"
        filters={filters}
        categories={visibleCategories}
        hidden={tab.value === "miennes" ? {} : { vue: tab.value }}
      />

      <section aria-label="Résultats" className="mt-6">
        {cards.length ? (
          <RecipeGrid recipes={cards} showAuthor={tab.scope !== "mine"} />
        ) : (
          <EmptyState tab={tab.value} filtered={hasActiveFilters(filters)} />
        )}
        <Pagination
          base="/recettes"
          filters={filters}
          hasMore={hasMore}
          extra={tab.value === "miennes" ? {} : { vue: tab.value }}
        />
      </section>
    </>
  );
}

function EmptyState({ tab, filtered }: { tab: string; filtered: boolean }) {
  if (filtered) {
    return (
      <p className="rounded-card bg-cream p-6 text-center text-ink-soft">
        Aucune recette ne correspond à ta recherche.
      </p>
    );
  }
  const text = {
    miennes: "Ton carnet est vide pour l'instant. Ajoute ta première recette !",
    foyer:
      "Aucune recette n'est encore partagée avec ton foyer. Choisis la visibilité « Foyer » sur une recette pour la partager.",
    favoris: "Tu n'as pas encore de favori. Touche le cœur d'une recette pour la retrouver ici.",
  }[tab];
  return (
    <div className="flex flex-col items-center gap-4 rounded-card bg-cream p-8 text-center">
      <p className="max-w-md text-ink-soft">{text}</p>
      {tab === "miennes" ? (
        <Button asChild>
          <Link href="/recettes/nouvelle">Créer une recette</Link>
        </Button>
      ) : (
        <Link href="/decouvrir" className="font-semibold text-coral-deep underline-offset-4 hover:underline">
          Explorer la bibliothèque publique
        </Link>
      )}
    </div>
  );
}
