import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/ui/page-header";
import { getActiveHousehold, getMyHouseholds } from "@/features/households/queries";
import { PhotoManager } from "@/features/recipes/components/photo-manager";
import { RecipeForm } from "@/features/recipes/components/recipe-form";
import { recipeToValues } from "@/features/recipes/form-values";
import { getCategories, getIngredientNames, getRecipe, getUnits } from "@/features/recipes/queries";

export const metadata: Metadata = { title: "Modifier la recette" };

export default async function EditRecipePage({ params }: PageProps<"/recettes/[id]/modifier">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const detail = await getRecipe(id);
  if (!detail || !detail.canEdit) notFound();
  const [units, categories, households, active, ingredientNames] = await Promise.all([
    getUnits(),
    getCategories(),
    getMyHouseholds(),
    getActiveHousehold(),
    getIngredientNames(),
  ]);
  const r = detail.recipe;
  const householdId = r.household_id ?? active?.id;
  const selected = new Set(detail.categories.map((c) => c.id));
  const isCopyOfOther = r.origin === "copy" && r.source_owner_id !== r.owner_id;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Modifier la recette" description={r.title} />
      <div className="mb-6">
        <PhotoManager
          recipeId={r.id}
          coverImageId={r.cover_image_id}
          images={detail.images.map((i) => ({ id: i.id, url: i.url }))}
        />
      </div>
      <RecipeForm
        initial={recipeToValues(detail, householdId)}
        units={units}
        categories={categories.filter((c) => !c.household_id || c.household_id === householdId || selected.has(c.id))}
        households={households.map((h) => ({ id: h.id, name: h.name }))}
        ingredientNames={ingredientNames}
        canChangeSharing={detail.isOwner}
        isCopy={r.origin === "copy"}
        publishBlockedReason={
          isCopyOfOther
            ? "Cette recette est une copie d'une recette d'un autre membre : elle ne peut pas être republiée."
            : undefined
        }
      />
    </div>
  );
}
