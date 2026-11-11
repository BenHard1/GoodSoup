import { BookOpen, CalendarDays, Compass, Refrigerator, ShoppingBasket, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { getActiveHousehold, getMyProfile } from "@/features/households/queries";

export const metadata: Metadata = { title: "Accueil" };

const UPCOMING = [
  {
    href: "/recettes",
    Icon: BookOpen,
    title: "Mes recettes",
    phase: 1,
    text: "Créer, organiser et retrouver tes recettes.",
  },
  {
    href: "/decouvrir",
    Icon: Compass,
    title: "Découvrir",
    phase: 1,
    text: "La bibliothèque publique de la communauté.",
  },
  { href: "/frigo", Icon: Refrigerator, title: "Mon frigo", phase: 3, text: "Ce que tu as sous la main." },
  { href: "/menus", Icon: CalendarDays, title: "Mes menus", phase: 4, text: "Le planning de la semaine." },
  { href: "/courses", Icon: ShoppingBasket, title: "Mes courses", phase: 4, text: "La liste partagée du foyer." },
];

export default async function HomePage() {
  const [profile, household] = await Promise.all([getMyProfile(), getActiveHousehold()]);
  const hour = new Date().toLocaleString("fr-FR", {
    hour: "numeric",
    hour12: false,
    timeZone: profile?.timezone ?? "Europe/Paris",
  });
  const greeting = Number(hour) >= 18 || Number(hour) < 5 ? "Bonsoir" : "Bonjour";

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-card bg-cream p-6 sm:p-8">
        <p className="font-semibold text-coral-deep">{household?.name}</p>
        <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">
          {greeting} {profile?.display_name} !
        </h1>
        <p className="mt-2 max-w-xl text-ink-soft">
          Ton carnet est prêt. La bibliothèque de recettes arrive dans la prochaine étape du développement.
        </p>
        <Link
          href="/foyer"
          className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-coral-deep underline-offset-4 hover:underline"
        >
          <Users aria-hidden className="size-4" /> Inviter quelqu&apos;un dans mon foyer
        </Link>
      </section>

      <section aria-labelledby="bientot">
        <h2 id="bientot" className="text-2xl font-semibold">
          Bientôt dans Good Soup
        </h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {UPCOMING.map(({ href, Icon, title, phase, text }) => (
            <li key={href}>
              <Link href={href} className="block h-full">
                <Card className="h-full transition-transform duration-150 hover:-translate-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="flex size-11 items-center justify-center rounded-full bg-coral-soft">
                      <Icon aria-hidden className="size-5 text-coral-deep" />
                    </span>
                    <span className="rounded-full bg-lemon-soft px-3 py-1 text-xs font-semibold">Phase {phase}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-ink-soft">{text}</p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
