import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { getActiveHousehold, getMyHouseholds } from "@/features/households/queries";
import { ImportFlow, type ImportMode } from "@/features/import/components/import-flow";
import { getCategories, getIngredientNames, getUnits } from "@/features/recipes/queries";

export const metadata: Metadata = { title: "Importer une recette" };

const MODES: ImportMode[] = ["lien", "pdf", "photo"];

export default async function ImportRecipePage({ searchParams }: PageProps<"/recettes/importer">) {
  const { depuis } = await searchParams;

  const mode = MODES.find((m) => m === depuis) ?? "lien";
  const [units, categories, households, active, ingredientNames] = await Promise.all([
    getUnits(),
    getCategories(),
    getMyHouseholds(),
    getActiveHousehold(),
    getIngredientNames(),
  ]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Importer une recette" />
      <ImportFlow
        initialMode={mode}
        units={units}
        categories={categories.filter((c) => !c.household_id || c.household_id === active?.id)}
        households={households.map((h) => ({ id: h.id, name: h.name }))}
        ingredientNames={ingredientNames}
      />
    </div>
  );
}
