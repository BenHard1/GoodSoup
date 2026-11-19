/** Péremption : calculs purs, sur des dates « AAAA-MM-JJ » (sans heure ni fuseau). */

export const SOON_DAYS = 3;

export type ExpiryStatus = "expired" | "today" | "soon" | "ok" | "none";

/** Date du jour « AAAA-MM-JJ » dans le fuseau de l'utilisateur. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
      now,
    );
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

const toUtc = (isoDate: string) => {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

/** Nombre de jours entre aujourd'hui et la date de péremption (négatif si dépassée). */
export function daysUntil(expiresOn: string, today: string): number {
  return Math.round((toUtc(expiresOn) - toUtc(today)) / 86_400_000);
}

export function expiryStatus(expiresOn: string | null, today: string): ExpiryStatus {
  if (!expiresOn) return "none";
  const days = daysUntil(expiresOn, today);
  if (days < 0) return "expired";
  if (days === 0) return "today";
  if (days <= SOON_DAYS) return "soon";
  return "ok";
}

export function expiryLabel(expiresOn: string | null, today: string): string | null {
  if (!expiresOn) return null;
  const days = daysUntil(expiresOn, today);
  if (days < -1) return `Périmé depuis ${-days} jours`;
  if (days === -1) return "Périmé depuis hier";
  if (days === 0) return "Périme aujourd'hui";
  if (days === 1) return "Périme demain";
  if (days <= SOON_DAYS) return `Périme dans ${days} jours`;
  const date = new Date(toUtc(expiresOn));
  const sameYear = expiresOn.slice(0, 4) === today.slice(0, 4);
  return `À consommer avant le ${date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: "UTC",
  })}`;
}

/** Compte les produits périmés et ceux à consommer vite (aujourd'hui compris). */
export function countAlerts(items: { expires_on: string | null }[], today: string) {
  let expired = 0;
  let soon = 0;
  for (const item of items) {
    const status = expiryStatus(item.expires_on, today);
    if (status === "expired") expired += 1;
    else if (status === "today" || status === "soon") soon += 1;
  }
  return { expired, soon };
}

/** Tri : dates les plus proches d'abord, produits sans date à la fin, puis par nom. */
export function sortByExpiry<T extends { expires_on: string | null; name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.expires_on !== b.expires_on) {
      if (!a.expires_on) return 1;
      if (!b.expires_on) return -1;
      return a.expires_on < b.expires_on ? -1 : 1;
    }
    return a.name.localeCompare(b.name, "fr");
  });
}
