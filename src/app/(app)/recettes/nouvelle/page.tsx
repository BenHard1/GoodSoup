import { Camera, FileText, Link2, PenLine, Video } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { getActiveHousehold, getMyHouseholds } from "@/features/households/queries";
import { RecipeForm } from "@/features/recipes/components/recipe-form";
import { emptyRecipeValues } from "@/features/recipes/form-values";
import { getCategories, getIngredientNames, getUnits } from "@/features/recipes/queries";

export const metadata: Metadata = { title: "Nouvelle recette" };

const IMPORTS = [
  { Icon: Link2, label: "Depuis un lien", href: "/recettes/importer?depuis=lien" },
  { Icon: FileText, label: "Depuis un PDF", href: "/recettes/importer?depuis=pdf" },
  { Icon: Camera, label: "Depuis une photo", href: "/recettes/importer?depuis=photo" },
] as const;

const LATER = [{ Icon: Video, label: "Depuis une vidéo", phase: 6 }];

export default async function NewRecipePage() {
  const [units, categories, households, active, ingredientNames] = await Promise.all([
    getUnits(),
    getCategories(),
    getMyHouseholds(),
    getActiveHousehold(),
    getIngredientNames(),
  ]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Nouvelle recette" />
      <section aria-label="Façons d'ajouter une recette" className="mb-6">
        <ul className="flex gap-2 overflow-x-auto pb-1">
          <li>
            <span
              aria-current="true"
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-ink px-4 font-semibold text-white"
            >
              <PenLine aria-hidden className="size-4" /> Saisie manuelle
            </span>
          </li>
          {IMPORTS.map(({ Icon, label, href }) => (
            <li key={label}>
              <Link
                href={href}
                className="inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-ink bg-white px-4 font-semibold text-ink hover:bg-cream"
              >
                <Icon aria-hidden className="size-4" /> {label}
              </Link>
            </li>
          ))}
          {LATER.map(({ Icon, label, phase }) => (
            <li key={label}>
              <span
                aria-disabled="true"
                className="inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-dashed border-line bg-white px-4 text-ink-soft"
              >
                <Icon aria-hidden className="size-4" /> {label}
                <span className="rounded-full bg-lemon-soft px-2 py-0.5 text-xs font-semibold text-ink">
                  Bientôt · phase {phase}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>
      <RecipeForm
        initial={emptyRecipeValues(active?.id)}
        units={units}
        categories={categories.filter((c) => !c.household_id || c.household_id === active?.id)}
        households={households.map((h) => ({ id: h.id, name: h.name }))}
        ingredientNames={ingredientNames}
        canChangeSharing
      />
    </div>
  );
}
