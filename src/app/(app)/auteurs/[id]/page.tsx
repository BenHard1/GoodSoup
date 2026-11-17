import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/features/recipes/components/pagination";
import { RecipeGrid } from "@/features/recipes/components/recipe-card";
import { getDisplayNames, searchRecipes } from "@/features/recipes/queries";
import { parseFilters } from "@/features/recipes/search-params";

export const metadata: Metadata = { title: "Auteur" };

export default async function AuthorPage({ params, searchParams }: PageProps<"/auteurs/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const filters = parseFilters(await searchParams);
  const [names, { cards, hasMore }] = await Promise.all([
    getDisplayNames([id]),
    searchRecipes({ scope: "author", authorId: id, sort: filters.tri, page: filters.page }),
  ]);
  const name = names.get(id);
  if (!name || (cards.length === 0 && filters.page === 1)) notFound();
  return (
    <>
      <PageHeader title={`Les recettes de ${name}`} description="Recettes publiques de ce membre." />
      <RecipeGrid recipes={cards} />
      <Pagination base={`/auteurs/${id}`} filters={filters} hasMore={hasMore} />
    </>
  );
}
