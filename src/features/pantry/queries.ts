import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PantryLocation } from "./schemas";

export type PantryItem = {
  id: string;
  name: string;
  brand: string | null;
  quantity: string | null;
  location: PantryLocation;
  expires_on: string | null;
  barcode: string | null;
};

export async function getPantryItems(householdId: string): Promise<PantryItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pantry_items")
    .select("id, name, brand, quantity, location, expires_on, barcode")
    .eq("household_id", householdId)
    .order("expires_on", { ascending: true, nullsFirst: false })
    .order("name")
    .limit(500);
  if (error) throw new Error("Impossible de charger le frigo.");
  return (data ?? []) as PantryItem[];
}

/** Produits datés à surveiller (pour l'accueil) : seulement la date, la RLS limite au foyer. */
export async function getPantryExpiryDates(householdId: string): Promise<{ expires_on: string | null }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pantry_items")
    .select("expires_on")
    .eq("household_id", householdId)
    .not("expires_on", "is", null)
    .limit(500);
  // L'accueil ne doit pas tomber si la migration du frigo n'est pas encore appliquée.
  if (error) return [];
  return data ?? [];
}
