import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { FoodProfileForm } from "@/features/households/food-profile-form";
import { getActiveHousehold, getFoodProfiles, getMyProfile } from "@/features/households/queries";
import { DisplayNameForm } from "@/features/profile/forms";

export const metadata: Metadata = { title: "Mon profil" };

export default async function ProfilePage() {
  const [profile, household] = await Promise.all([getMyProfile(), getActiveHousehold()]);
  if (!profile || !household) return null;
  const own = (await getFoodProfiles(household.id)).find((f) => f.user_id === profile.id) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Mon profil" />
      <Card>
        <DisplayNameForm defaultName={profile.display_name} />
      </Card>
      <Card>
        <h2 className="text-xl font-semibold">Mes préférences alimentaires</h2>
        <p className="mt-1 text-sm text-ink-soft">Visibles par les membres du foyer « {household.name} » uniquement.</p>
        <div className="mt-5">
          <FoodProfileForm householdId={household.id} profile={own} forSelf defaultName={profile.display_name} />
        </div>
      </Card>
    </div>
  );
}
