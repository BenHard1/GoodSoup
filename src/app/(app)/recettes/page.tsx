import type { Metadata } from "next";
import { ComingSoonPanel } from "@/components/ui/coming-soon";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Mes recettes" };

export default function RecettesPage() {
  return (
    <>
      <PageHeader title="Mes recettes" />
      <ComingSoonPanel title="Ce module n'est pas encore disponible" phase={1}>
        <p>
          La bibliothèque de recettes (création, photos, ingrédients, recherche, favoris, partage) est la prochaine
          étape du développement.
        </p>
      </ComingSoonPanel>
    </>
  );
}
