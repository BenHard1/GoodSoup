import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { NewPasswordForm } from "@/features/auth/forms";
import { DeleteAccountButton } from "@/features/profile/forms";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Paramètres" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Paramètres" />
      <Card>
        <h2 className="text-xl font-semibold">Compte</h2>
        <p className="mt-2 text-ink-soft">
          Adresse e-mail : <strong className="text-ink">{user?.email}</strong>
        </p>
      </Card>
      <Card>
        <h2 className="text-xl font-semibold">Changer de mot de passe</h2>
        <div className="mt-4 max-w-md">
          <NewPasswordForm submitLabel="Changer le mot de passe" />
        </div>
      </Card>
      <Card>
        <h2 className="text-xl font-semibold">Mes données</h2>
        <p className="mt-2 text-ink-soft">
          L&apos;export de toutes tes données (profil, recettes) arrive avec la bibliothèque de recettes (Phase 1). Voir
          la{" "}
          <Link href="/confidentialite" className="font-semibold text-coral-deep underline">
            politique de confidentialité
          </Link>
          .
        </p>
      </Card>
      <Card className="border-danger/40">
        <h2 className="text-xl font-semibold text-danger">Zone sensible</h2>
        <p className="mt-2 text-ink-soft">La suppression de ton compte est définitive.</p>
        <div className="mt-4">
          <DeleteAccountButton />
        </div>
      </Card>
    </div>
  );
}
