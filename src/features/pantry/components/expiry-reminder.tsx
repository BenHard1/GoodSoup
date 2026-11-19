import { Refrigerator } from "lucide-react";
import Link from "next/link";
import { SOON_DAYS } from "../expiry";

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

/** Rappel de péremption affiché dans l'appli (aucune notification ni e-mail). */
export function ExpiryReminder({ expired, soon, linked = false }: { expired: number; soon: number; linked?: boolean }) {
  if (!expired && !soon) return null;
  const parts = [
    expired ? plural(expired, "produit périmé", "produits périmés") : null,
    soon ? `${plural(soon, "produit", "produits")} à consommer d'ici ${SOON_DAYS} jours` : null,
  ].filter(Boolean);
  return (
    <div
      role="status"
      className={
        "flex items-start gap-3 rounded-card border px-4 py-3 " +
        (expired ? "border-danger/30 bg-danger-soft" : "border-lemon bg-lemon-soft")
      }
    >
      <Refrigerator aria-hidden className={"mt-0.5 size-5 shrink-0 " + (expired ? "text-danger" : "text-ink")} />
      <p className="font-semibold">
        Dans le frigo : {parts.join(" et ")}.{" "}
        {linked ? (
          <Link href="/frigo" className="text-coral-deep underline underline-offset-4">
            Voir le frigo
          </Link>
        ) : null}
      </p>
    </div>
  );
}
