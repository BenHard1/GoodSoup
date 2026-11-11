import type { Metadata } from "next";
import { ComingSoonPanel } from "@/components/ui/coming-soon";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Mon frigo" };

export default function FrigoPage() {
  return (
    <>
      <PageHeader title="Mon frigo" />
      <ComingSoonPanel title="Ce module n'est pas encore disponible" phase={3}>
        <p>
          Tu pourras y noter ce que tu as au frigo, au congélateur et dans les placards, puis trouver des recettes
          compatibles.
        </p>
      </ComingSoonPanel>
    </>
  );
}
