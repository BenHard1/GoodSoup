import "server-only";
import { cache } from "react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export type HouseholdRole = "owner" | "member";
export type MyHousehold = { id: string; name: string; role: HouseholdRole };

export type Profile = {
  id: string;
  display_name: string;
  avatar_path: string | null;
  timezone: string;
  preferences: { activeHouseholdId?: string } & Record<string, unknown>;
  onboarded_at: string | null;
};

export const getMyProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_path, timezone, preferences, onboarded_at")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error("Impossible de charger le profil.");
  return data as Profile | null;
});

export const getMyHouseholds = cache(async (): Promise<MyHousehold[]> => {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("household_members")
    .select("role, joined_at, households!inner(id, name)")
    .eq("user_id", user.id)
    .order("joined_at");
  if (error) throw new Error("Impossible de charger les foyers.");
  return (data ?? []).map((row) => {
    const h = row.households as unknown as { id: string; name: string };
    return { id: h.id, name: h.name, role: row.role as HouseholdRole };
  });
});

/** Foyer actif : celui mémorisé dans le profil s'il est toujours valide, sinon le plus ancien. */
export const getActiveHousehold = cache(async (): Promise<MyHousehold | null> => {
  const [profile, households] = await Promise.all([getMyProfile(), getMyHouseholds()]);
  if (households.length === 0) return null;
  const preferred = profile?.preferences?.activeHouseholdId;
  return households.find((h) => h.id === preferred) ?? households[0];
});

export type HouseholdMember = { userId: string; displayName: string; role: HouseholdRole; joinedAt: string };

export async function getHouseholdMembers(householdId: string): Promise<HouseholdMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("household_members")
    .select("user_id, role, joined_at, profiles!inner(display_name)")
    .eq("household_id", householdId)
    .order("joined_at");
  if (error) throw new Error("Impossible de charger les membres.");
  return (data ?? []).map((m) => ({
    userId: m.user_id as string,
    role: m.role as HouseholdRole,
    joinedAt: m.joined_at as string,
    displayName: ((m.profiles as unknown as { display_name: string }).display_name || "Sans nom") as string,
  }));
}

export type Invitation = { id: string; expiresAt: string; usedCount: number; maxUses: number };

export async function getActiveInvitations(householdId: string): Promise<Invitation[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("household_invitations")
    .select("id, expires_at, used_count, max_uses, revoked_at")
    .eq("household_id", householdId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  return (data ?? [])
    .filter((i) => i.used_count < i.max_uses)
    .map((i) => ({ id: i.id, expiresAt: i.expires_at, usedCount: i.used_count, maxUses: i.max_uses }));
}

export type FoodProfile = {
  id: string;
  household_id: string;
  user_id: string | null;
  display_name: string;
  allergies: string[];
  exclusions: string[];
  likes: string[];
  dislikes: string[];
  diets: string[];
  goals: string | null;
  portion_factor: number;
};

export async function getFoodProfiles(householdId: string): Promise<FoodProfile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("food_profiles")
    .select("*")
    .eq("household_id", householdId)
    .order("created_at");
  if (error) throw new Error("Impossible de charger les profils alimentaires.");
  return (data ?? []).map((f) => ({ ...f, portion_factor: Number(f.portion_factor) })) as FoodProfile[];
}
