import type { Metadata } from "next";
import { ComingSoonPanel } from "@/components/ui/coming-soon";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Découvrir" };

export default function DecouvrirPage() {
  return (
    <>
      <PageHeader title="Découvrir" />
      <ComingSoonPanel title="Ce module n'est pas encore disponible" phase={1}>
        <p>
          La bibliothèque publique, où chacun peut publier ses propres recettes et enregistrer celles des autres, arrive
          avec la Phase 1.
        </p>
      </ComingSoonPanel>
    </>
  );
}
