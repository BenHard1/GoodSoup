import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/features/recipes/components/pagination";
import { RecipeGrid } from "@/features/recipes/components/recipe-card";
import { RecipeFilters } from "@/features/recipes/components/recipe-filters";
import { getCategories, searchRecipes } from "@/features/recipes/queries";
import { hasActiveFilters, parseFilters } from "@/features/recipes/search-params";

export const metadata: Metadata = { title: "Découvrir" };

export default async function DiscoverPage({ searchParams }: PageProps<"/decouvrir">) {
  const filters = parseFilters(await searchParams, "popular");
  const categories = (await getCategories()).filter((c) => !c.household_id);
  const { cards, hasMore } = await searchRecipes({
    scope: "public",
    query: filters.q,
    categoryIds: filters.categorie ? [filters.categorie] : [],
    maxMinutes: filters.duree,
    difficulty: filters.difficulte,
    diets: filters.regime ? [filters.regime] : [],
    sort: filters.tri,
    page: filters.page,
  });

  return (
    <>
      <PageHeader
        title="Découvrir"
        description="Les recettes publiées par les membres de Good Soup. Copie celles qui te plaisent dans ton carnet."
      />
      <RecipeFilters action="/decouvrir" filters={filters} categories={categories} />
      <section aria-label="Recettes publiques" className="mt-6">
        {cards.length ? (
          <RecipeGrid recipes={cards} showAuthor />
        ) : (
          <p className="rounded-card bg-cream p-8 text-center text-ink-soft">
            {hasActiveFilters(filters)
              ? "Aucune recette publique ne correspond à ta recherche."
              : "La bibliothèque publique est encore vide. Publie une de tes recettes (visibilité « Publique ») pour l'inaugurer !"}
          </p>
        )}
        <Pagination base="/decouvrir" filters={filters} hasMore={hasMore} />
      </section>
    </>
  );
}
