import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getActiveHousehold, getMyProfile } from "@/features/households/queries";
import { ExpiryBadge } from "@/features/pantry/components/expiry-badge";
import { ExpiryReminder } from "@/features/pantry/components/expiry-reminder";
import { PantryAddForm } from "@/features/pantry/components/pantry-add-form";
import { PantryItemRow } from "@/features/pantry/components/pantry-item-row";
import { countAlerts, sortByExpiry, todayIn } from "@/features/pantry/expiry";
import { OFF_SOURCE } from "@/features/pantry/openfoodfacts";
import { getPantryItems, type PantryItem } from "@/features/pantry/queries";
import { LOCATIONS, locationFromSlug, locationLabel } from "@/features/pantry/schemas";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Mon frigo" };

export default async function FrigoPage({ searchParams }: PageProps<"/frigo">) {
  const { lieu } = await searchParams;
  const [profile, household] = await Promise.all([getMyProfile(), getActiveHousehold()]);

  if (!household) {
    return (
      <>
        <PageHeader title="Mon frigo" />
        <Alert>
          Le frigo est partagé par foyer.{" "}
          <Link href="/foyer" className="underline">
            Crée ou rejoins un foyer
          </Link>{" "}
          pour commencer.
        </Alert>
      </>
    );
  }

  let items: PantryItem[] | null = null;
  try {
    items = sortByExpiry(await getPantryItems(household.id));
  } catch {
    items = null;
  }

  const today = todayIn(profile?.timezone ?? "Europe/Paris");
  const location = locationFromSlug(lieu);
  const visible = items ? items.filter((i) => !location || i.location === location) : [];
  const alerts = countAlerts(items ?? [], today);
  const counts = Object.fromEntries(
    LOCATIONS.map((l) => [l.value, items?.filter((i) => i.location === l.value).length ?? 0]),
  );

  return (
    <>
      <PageHeader
        title="Mon frigo"
        description={`Ce que le foyer « ${household.name} » a sous la main : frigo, congélateur et placards.`}
      />

      {items === null ? (
        <Alert tone="error">Le frigo n&apos;a pas pu être chargé. Réessaie dans un instant.</Alert>
      ) : (
        <div className="flex flex-col gap-6">
          <ExpiryReminder expired={alerts.expired} soon={alerts.soon} />

          <Card>
            <h2 className="mb-4 text-xl font-semibold">Ajouter un produit</h2>
            <PantryAddForm householdId={household.id} location={location ?? "fridge"} />
          </Card>

          <section aria-labelledby="contenu">
            <h2 id="contenu" className="sr-only">
              Contenu
            </h2>
            <nav aria-label="Emplacements" className="mb-4 flex gap-2 overflow-x-auto">
              {[{ slug: undefined, value: null, label: "Tout" }, ...LOCATIONS].map((l) => {
                const active = (l.value ?? null) === location;
                const count = l.value ? counts[l.value] : items!.length;
                return (
                  <Link
                    key={l.label}
                    href={l.slug ? `/frigo?lieu=${l.slug}` : "/frigo"}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 font-semibold",
                      active ? "bg-ink text-white" : "border border-line bg-white hover:bg-cream",
                    )}
                  >
                    {l.label}
                    <span className={cn("text-sm", active ? "text-white/80" : "text-ink-soft")}>{count}</span>
                  </Link>
                );
              })}
            </nav>

            {visible.length ? (
              <ul className="flex flex-col gap-3">
                {visible.map((item) => (
                  <li key={item.id} className="rounded-card border border-line bg-white p-4 shadow-card">
                    <PantryItemRow item={item}>
                      <p className="font-semibold break-words">{item.name}</p>
                      <p className="text-sm text-ink-soft">
                        {[item.quantity, item.brand, location ? null : locationLabel(item.location)]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <div className="mt-1">
                        <ExpiryBadge expiresOn={item.expires_on} today={today} />
                      </div>
                    </PantryItemRow>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-card bg-cream p-6 text-ink-soft">
                {items.length
                  ? `Rien pour l'instant côté ${locationLabel(location ?? "").toLowerCase()}.`
                  : "Le frigo est vide. Ajoute ce que tu as sous la main, à la main ou en scannant un code-barres."}
              </p>
            )}
          </section>

          <p className="text-sm text-ink-soft">
            Les produits scannés sont identifiés grâce à{" "}
            <a href={OFF_SOURCE.url} target="_blank" rel="noopener noreferrer" className="underline">
              {OFF_SOURCE.name}
            </a>
            , base collaborative sous licence {OFF_SOURCE.license}. Le frigo ne se met pas à jour tout seul quand tu
            cuisines : retire ou modifie les produits au fil de l&apos;eau.
          </p>
        </div>
      )}
    </>
  );
}
