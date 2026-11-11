import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getActiveHousehold, getMyProfile } from "@/features/households/queries";
import { getCurrentUser } from "@/lib/supabase/server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  const [profile, household] = await Promise.all([getMyProfile(), getActiveHousehold()]);
  if (!profile?.onboarded_at || !household) redirect("/bienvenue");

  return (
    <AppShell displayName={profile.display_name} householdName={household.name}>
      {children}
    </AppShell>
  );
}
