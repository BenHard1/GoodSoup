import type { Metadata } from "next";
import { ComingSoonPanel } from "@/components/ui/coming-soon";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Mes menus" };

export default function MenusPage() {
  return (
    <>
      <PageHeader title="Mes menus" />
      <ComingSoonPanel title="Ce module n'est pas encore disponible" phase={4}>
        <p>Le planificateur de la semaine (déjeuners, dîners, restes) arrivera après la bibliothèque et le frigo.</p>
      </ComingSoonPanel>
    </>
  );
}
