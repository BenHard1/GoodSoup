import type { Metadata } from "next";
import { ComingSoonPanel } from "@/components/ui/coming-soon";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Assistant culinaire" };

export default function AssistantPage() {
  return (
    <>
      <PageHeader title="Assistant culinaire" />
      <ComingSoonPanel title="Ce module n'est pas encore disponible" phase={5}>
        <p>
          L&apos;assistant IA n&apos;est pas encore activé. L&apos;application reste entièrement utilisable sans lui.
        </p>
      </ComingSoonPanel>
    </>
  );
}
