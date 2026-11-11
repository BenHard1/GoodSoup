import type { Metadata } from "next";
import { AuthCard } from "@/features/auth/auth-card";
import { NewPasswordForm } from "@/features/auth/forms";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

/** Accessible uniquement avec la session ouverte par le lien de réinitialisation (voir proxy). */
export default function ResetPasswordPage() {
  return (
    <AuthCard title="Nouveau mot de passe">
      <NewPasswordForm />
    </AuthCard>
  );
}
