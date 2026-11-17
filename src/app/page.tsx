import { BookOpen, CalendarDays, Refrigerator } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/layout/logo";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/supabase/server";

const FEATURES = [
  { Icon: BookOpen, title: "Toutes tes recettes", text: "Celles de famille, celles d'Internet, au même endroit." },
  { Icon: Refrigerator, title: "Ce qu'il y a au frigo", text: "Cuisine avec ce que tu as, gaspille moins." },
  { Icon: CalendarDays, title: "Les menus de la semaine", text: "Planifie à deux et prépare la liste de courses." },
];

export default async function LandingPage({ searchParams }: PageProps<"/">) {
  if (await getCurrentUser()) redirect("/accueil");
  const { compte } = await searchParams;
  return (
    <div className="min-h-dvh bg-cream">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-8">
        <Logo />
        <Link href="/connexion" className="font-semibold underline-offset-4 hover:underline">
          Se connecter
        </Link>
      </header>
      <main id="contenu" className="mx-auto max-w-5xl px-4 pb-16 pt-8 sm:px-8 sm:pt-16">
        {compte === "supprime" ? (
          <Alert tone="success" className="mb-8">
            Ton compte et tes données ont été supprimés.
          </Alert>
        ) : null}
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-6xl">
          Le carnet de cuisine de tout le foyer.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-ink-soft">
          Rassemble tes recettes, partage-les avec ceux qui cuisinent avec toi et retrouve-les sur ton téléphone comme
          sur ton ordinateur.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/inscription">Créer mon carnet</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/connexion">J&apos;ai déjà un compte</Link>
          </Button>
        </div>
        <ul className="mt-16 grid gap-4 sm:grid-cols-3">
          {FEATURES.map(({ Icon, title, text }) => (
            <li key={title} className="rounded-card bg-white p-5 shadow-card">
              <span className="flex size-11 items-center justify-center rounded-full bg-coral-soft">
                <Icon aria-hidden className="size-5 text-coral-deep" />
              </span>
              <h2 className="mt-4 text-lg font-semibold">{title}</h2>
              <p className="mt-1 text-ink-soft">{text}</p>
            </li>
          ))}
        </ul>
      </main>
      <footer className="flex justify-center gap-4 py-6 text-sm text-ink-soft">
        <Link href="/confidentialite" className="hover:underline">
          Confidentialité
        </Link>
        <Link href="/mentions-legales" className="hover:underline">
          Mentions légales
        </Link>
      </footer>
    </div>
  );
}
