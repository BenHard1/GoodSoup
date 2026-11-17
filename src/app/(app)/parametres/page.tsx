import { Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { NewPasswordForm } from "@/features/auth/forms";
import { DeleteAccountButton } from "@/features/profile/forms";
import { isAppAdmin } from "@/features/recipes/queries";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Paramètres" };

export default async function SettingsPage() {
  const [user, admin] = await Promise.all([getCurrentUser(), isAppAdmin()]);
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
          Télécharge toutes tes données (profil, foyers, profils alimentaires, recettes, favoris, notes) dans un fichier
          JSON. Voir la{" "}
          <Link href="/confidentialite" className="font-semibold text-coral-deep underline">
            politique de confidentialité
          </Link>
          .
        </p>
        <a
          href="/parametres/export"
          download
          className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-full border border-line bg-white px-5 font-semibold hover:bg-cream"
        >
          <Download aria-hidden className="size-4" /> Exporter mes données
        </a>
      </Card>
      {admin ? (
        <Card>
          <h2 className="text-xl font-semibold">Modération</h2>
          <Link
            href="/admin/signalements"
            className="mt-2 inline-flex min-h-11 items-center font-semibold text-coral-deep underline"
          >
            Voir les signalements
          </Link>
        </Card>
      ) : null}
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
