import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/features/auth/auth-card";
import { SignUpForm } from "@/features/auth/forms";

export const metadata: Metadata = { title: "Inscription" };

export default async function SignUpPage({ searchParams }: PageProps<"/inscription">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  return (
    <AuthCard
      title="Créer un compte"
      subtitle={
        <>
          Déjà inscrit ?{" "}
          <Link
            href={next ? `/connexion?next=${encodeURIComponent(next)}` : "/connexion"}
            className="font-semibold text-coral-deep underline"
          >
            Connecte-toi
          </Link>
        </>
      }
    >
      <SignUpForm next={next} />
    </AuthCard>
  );
}
