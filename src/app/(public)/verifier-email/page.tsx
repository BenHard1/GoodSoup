import { MailCheck } from "lucide-react";
import type { Metadata } from "next";
import { AuthCard } from "@/features/auth/auth-card";

export const metadata: Metadata = { title: "Vérifie ta boîte mail" };

export default async function CheckEmailPage({ searchParams }: PageProps<"/verifier-email">) {
  const { email } = await searchParams;
  return (
    <AuthCard title="Vérifie ta boîte mail">
      <div className="flex flex-col items-center gap-4 text-center">
        <MailCheck aria-hidden className="size-14 text-coral-strong" />
        <p>
          Un lien de confirmation a été envoyé
          {typeof email === "string" ? (
            <>
              {" "}
              à <strong>{email}</strong>
            </>
          ) : null}
          . Clique dessus pour activer ton compte.
        </p>
        <p className="text-sm text-ink-soft">Rien reçu après quelques minutes ? Regarde dans les indésirables.</p>
      </div>
    </AuthCard>
  );
}
