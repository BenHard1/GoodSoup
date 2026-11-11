import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/features/auth/auth-card";
import { ForgotPasswordForm } from "@/features/auth/forms";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Mot de passe oublié"
      subtitle="Indique ton e-mail : tu recevras un lien pour choisir un nouveau mot de passe."
    >
      <ForgotPasswordForm />
      <p className="mt-4 text-center text-sm">
        <Link href="/connexion" className="font-semibold text-coral-deep underline">
          Retour à la connexion
        </Link>
      </p>
    </AuthCard>
  );
}
