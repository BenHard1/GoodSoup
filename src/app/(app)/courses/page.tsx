import type { Metadata } from "next";
import { ComingSoonPanel } from "@/components/ui/coming-soon";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Mes courses" };

export default function CoursesPage() {
  return (
    <>
      <PageHeader title="Mes courses" />
      <ComingSoonPanel title="Ce module n'est pas encore disponible" phase={4}>
        <p>La liste de courses partagée, générée depuis tes menus, arrivera avec le planificateur.</p>
      </ComingSoonPanel>
    </>
  );
}
