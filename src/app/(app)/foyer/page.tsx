import { Crown, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { deleteFoodProfile, revokeInvitation } from "@/features/households/actions";
import { FoodProfileForm } from "@/features/households/food-profile-form";
import {
  InvitePanel,
  LeaveHouseholdButton,
  NewHouseholdForm,
  RemoveMemberButton,
  RenameHouseholdForm,
  SwitchHouseholdButton,
} from "@/features/households/household-panels";
import {
  getActiveHousehold,
  getActiveInvitations,
  getFoodProfiles,
  getHouseholdMembers,
  getMyHouseholds,
} from "@/features/households/queries";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mon foyer" };

const dateFr = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

export default async function HouseholdPage() {
  const user = (await getCurrentUser())!;
  const [household, households] = await Promise.all([getActiveHousehold(), getMyHouseholds()]);
  if (!household) return null;
  const isOwner = household.role === "owner";
  const [members, invitations, foodProfiles] = await Promise.all([
    getHouseholdMembers(household.id),
    isOwner ? getActiveInvitations(household.id) : Promise.resolve([]),
    getFoodProfiles(household.id),
  ]);
  const guests = foodProfiles.filter((f) => f.user_id === null);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={household.name}
        description={isOwner ? "Tu es propriétaire de ce foyer." : "Tu es membre de ce foyer."}
      />

      <Card>
        <h2 className="text-xl font-semibold">Membres</h2>
        <ul className="mt-3 divide-y divide-line">
          {members.map((m) => (
            <li key={m.userId} className="flex min-h-14 items-center justify-between gap-3 py-2">
              <div>
                <p className="font-semibold">
                  {m.displayName}{" "}
                  {m.userId === user.id ? <span className="font-normal text-ink-soft">(toi)</span> : null}
                </p>
                <p className="flex items-center gap-1 text-sm text-ink-soft">
                  {m.role === "owner" ? (
                    <>
                      <Crown aria-hidden className="size-3.5" /> Propriétaire
                    </>
                  ) : (
                    "Membre"
                  )}{" "}
                  · depuis le {dateFr(m.joinedAt)}
                </p>
              </div>
              {isOwner && m.userId !== user.id ? (
                <RemoveMemberButton householdId={household.id} userId={m.userId} name={m.displayName} />
              ) : null}
            </li>
          ))}
        </ul>
      </Card>

      {isOwner ? (
        <Card>
          <h2 className="text-xl font-semibold">Inviter quelqu&apos;un</h2>
          <p className="mt-1 text-sm text-ink-soft">La personne crée son compte puis rejoint le foyer avec ce lien.</p>
          <div className="mt-4">
            <InvitePanel householdId={household.id} />
          </div>
          {invitations.length ? (
            <div className="mt-5">
              <h3 className="text-sm font-semibold">Liens actifs</h3>
              <ul className="mt-2 divide-y divide-line">
                {invitations.map((inv) => (
                  <li key={inv.id} className="flex min-h-12 items-center justify-between gap-3 text-sm">
                    <span>
                      Expire le {dateFr(inv.expiresAt)} · utilisé {inv.usedCount}/{inv.maxUses}
                    </span>
                    <form action={revokeInvitation}>
                      <input type="hidden" name="invitationId" value={inv.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        Révoquer
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <h2 className="text-xl font-semibold">Personnes sans compte</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Un enfant, un proche qui mange souvent avec vous : ajoute ses allergies et préférences pour les futurs menus.
        </p>
        {guests.length ? (
          <ul className="mt-4 flex flex-col gap-4">
            {guests.map((g) => (
              <li key={g.id}>
                <details className="rounded-xl border border-line p-4">
                  <summary className="flex min-h-11 cursor-pointer items-center justify-between font-semibold">
                    {g.display_name}
                  </summary>
                  <div className="mt-4">
                    <FoodProfileForm householdId={household.id} profile={g} />
                    <form action={deleteFoodProfile} className="mt-3">
                      <input type="hidden" name="profileId" value={g.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        <Trash2 aria-hidden className="size-4" /> Supprimer ce profil
                      </Button>
                    </form>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        ) : null}
        <details className="mt-4 rounded-xl border border-dashed border-line p-4">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold">Ajouter une personne</summary>
          <div className="mt-4">
            <FoodProfileForm householdId={household.id} submitLabel="Ajouter" />
          </div>
        </details>
      </Card>

      {isOwner ? (
        <Card>
          <h2 className="text-xl font-semibold">Réglages</h2>
          <div className="mt-4">
            <RenameHouseholdForm householdId={household.id} name={household.name} />
          </div>
        </Card>
      ) : null}

      <Card>
        <h2 className="text-xl font-semibold">Mes foyers</h2>
        <ul className="mt-3 divide-y divide-line">
          {households.map((h) => (
            <li key={h.id} className="flex min-h-12 items-center justify-between gap-3">
              <span className="font-semibold">
                {h.name} {h.id === household.id ? <span className="font-normal text-ink-soft">(actif)</span> : null}
              </span>
              {h.id !== household.id ? <SwitchHouseholdButton householdId={h.id} /> : null}
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <NewHouseholdForm />
        </div>
        <div className="mt-6 border-t border-line pt-4">
          <LeaveHouseholdButton householdId={household.id} name={household.name} isLastMember={members.length === 1} />
        </div>
      </Card>
    </div>
  );
}
