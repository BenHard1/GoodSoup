import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { AuthCard } from "@/features/auth/auth-card";
import { SignInForm } from "@/features/auth/forms";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: PageProps<"/connexion">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  return (
    <AuthCard
      title="Bon retour !"
      subtitle={
        <>
          Pas encore de compte ?{" "}
          <Link
            href={next ? `/inscription?next=${encodeURIComponent(next)}` : "/inscription"}
            className="font-semibold text-coral-deep underline"
          >
            Inscris-toi
          </Link>
        </>
      }
    >
      {sp.erreur === "lien" ? (
        <Alert tone="error" className="mb-4">
          Ce lien est invalide ou a expiré. Connecte-toi ou demande un nouveau lien.
        </Alert>
      ) : null}
      <SignInForm next={next} />
    </AuthCard>
  );
}
