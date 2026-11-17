import type { Metadata } from "next";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Mentions légales" };

export default function LegalPage() {
  return (
    <Card className="w-full max-w-3xl p-6 sm:p-10">
      <article className="flex flex-col gap-4 leading-relaxed [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold">
        <h1 className="text-3xl font-semibold">Mentions légales</h1>
        <p className="rounded-lg bg-lemon-soft p-3 text-sm font-semibold">
          Brouillon — à compléter avant l&apos;ouverture publique (passages entre crochets).
        </p>
        <h2>Éditeur</h2>
        <p>[Nom de l&apos;éditeur], [adresse ou mention « particulier, non professionnel »], [e-mail de contact].</p>
        <h2>Directeur de la publication</h2>
        <p>[Nom].</p>
        <h2>Hébergement</h2>
        <p>Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis — [à vérifier].</p>
        <p>Données : Supabase, région Union européenne (Paris).</p>
      </article>
    </Card>
  );
}
