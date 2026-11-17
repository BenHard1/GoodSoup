import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/layout/logo";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { JoinInvitation } from "@/features/households/join-invitation";
import { getMyProfile } from "@/features/households/queries";
import { extractInvitationToken } from "@/features/households/schemas";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Invitation", robots: { index: false } };

export default async function JoinPage({ params }: PageProps<"/foyer/rejoindre/[token]">) {
  const { token: raw } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent(`/foyer/rejoindre/${raw}`)}`);

  const token = extractInvitationToken(raw);
  const supabase = await createClient();
  const preview = token ? (await supabase.rpc("get_invitation_preview", { p_token: token })).data?.[0] : null;
  const profile = await getMyProfile();
  const next = profile?.onboarded_at ? "/foyer" : "/bienvenue?etape=alimentation";

  return (
    <div className="min-h-dvh bg-cream/60">
      <header className="px-4 py-5 sm:px-8">
        <Logo />
      </header>
      <main id="contenu" className="flex justify-center px-4 pb-16 pt-4">
        <Card className="w-full max-w-md p-6 sm:p-8">
          <h1 className="text-3xl font-semibold">Invitation</h1>
          {!preview?.household_name || !preview.is_valid ? (
            <>
              <Alert tone="error" className="mt-4">
                Cette invitation est invalide, a expiré ou a déjà été utilisée. Demande un nouveau lien.
              </Alert>
              <Button asChild variant="secondary" className="mt-4">
                <Link href="/accueil">Retour</Link>
              </Button>
            </>
          ) : preview.already_member ? (
            <>
              <p className="mt-4">
                Tu fais déjà partie du foyer <strong>{preview.household_name}</strong>.
              </p>
              <Button asChild className="mt-4">
                <Link href={next}>Continuer</Link>
              </Button>
            </>
          ) : (
            <>
              <p className="mt-4">
                Tu es invité(e) à rejoindre le foyer <strong>{preview.household_name}</strong>. Vous partagerez les
                recettes du foyer, puis le frigo, les menus et les courses.
              </p>
              <div className="mt-6">
                <JoinInvitation token={token!} next={next} />
              </div>
            </>
          )}
        </Card>
      </main>
    </div>
  );
}
