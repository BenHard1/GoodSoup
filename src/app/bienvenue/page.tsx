import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FoodProfileForm } from "@/features/households/food-profile-form";
import { getActiveHousehold, getFoodProfiles, getMyProfile } from "@/features/households/queries";
import { HouseholdStep, NameStep } from "@/features/onboarding/steps";
import { completeOnboarding } from "@/features/profile/actions";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Bienvenue" };

const STEPS = ["profil", "foyer", "alimentation"] as const;
type Step = (typeof STEPS)[number];

export default async function OnboardingPage({ searchParams }: PageProps<"/bienvenue">) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?next=/bienvenue");
  const [profile, household] = await Promise.all([getMyProfile(), getActiveHousehold()]);
  if (!profile) redirect("/connexion");

  const { etape } = await searchParams;
  let step: Step = STEPS.includes(etape as Step) ? (etape as Step) : "profil";
  if (step === "alimentation" && !household) step = "foyer";
  const index = STEPS.indexOf(step);

  const ownFoodProfile =
    step === "alimentation" && household
      ? ((await getFoodProfiles(household.id)).find((f) => f.user_id === user.id) ?? null)
      : null;

  return (
    <div className="min-h-dvh bg-cream/60">
      <header className="px-4 py-5 sm:px-8">
        <Logo />
      </header>
      <main id="contenu" className="mx-auto max-w-2xl px-4 pb-16">
        <p className="text-sm font-semibold text-coral-deep">
          Étape {index + 1} sur {STEPS.length}
        </p>
        <div className="mt-2 flex gap-2" aria-hidden>
          {STEPS.map((s, i) => (
            <span key={s} className={`h-1.5 flex-1 rounded-full ${i <= index ? "bg-coral-strong" : "bg-line"}`} />
          ))}
        </div>

        {step === "profil" ? (
          <section className="mt-6">
            <h1 className="text-3xl font-semibold">Bienvenue dans Good Soup !</h1>
            <p className="mt-2 text-ink-soft">Comment veux-tu qu&apos;on t&apos;appelle ?</p>
            <Card className="mt-6">
              <NameStep defaultName={profile.display_name} />
            </Card>
          </section>
        ) : null}

        {step === "foyer" ? (
          <section className="mt-6">
            <h1 className="text-3xl font-semibold">Ton foyer</h1>
            <p className="mt-2 text-ink-soft">
              Un foyer regroupe les personnes qui partagent recettes, frigo, menus et courses.
            </p>
            <div className="mt-6">
              {household ? (
                <Card>
                  <p>
                    Tu fais déjà partie du foyer <strong>{household.name}</strong>.
                  </p>
                  <Button asChild className="mt-4">
                    <Link href="/bienvenue?etape=alimentation">Continuer</Link>
                  </Button>
                </Card>
              ) : (
                <HouseholdStep defaultName={profile.display_name ? `Chez ${profile.display_name}` : "Mon foyer"} />
              )}
            </div>
          </section>
        ) : null}

        {step === "alimentation" && household ? (
          <section className="mt-6">
            <h1 className="text-3xl font-semibold">Tes préférences</h1>
            <p className="mt-2 text-ink-soft">
              Facultatif : elles serviront plus tard aux suggestions de menus. Tu pourras les modifier dans ton profil.
            </p>
            <Card className="mt-6">
              <FoodProfileForm
                householdId={household.id}
                profile={ownFoodProfile}
                forSelf
                defaultName={profile.display_name}
                submitLabel="Enregistrer mes préférences"
              />
            </Card>
            <form action={completeOnboarding} className="mt-6 flex justify-end">
              <Button type="submit">Terminer et découvrir l&apos;app</Button>
            </form>
          </section>
        ) : null}
      </main>
    </div>
  );
}
