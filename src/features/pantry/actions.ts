"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { publicEnv } from "@/lib/env";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { offProductUrl, parseOffResponse, type OffProduct } from "./openfoodfacts";
import { normalizeBarcode, parsePantryItemForm, type PantryItemInput } from "./schemas";

const uuid = z.uuid();

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  return user;
}

const toRow = (item: PantryItemInput) => ({
  name: item.name,
  brand: item.brand,
  quantity: item.quantity,
  location: item.location,
  expires_on: item.expiresOn,
  barcode: item.barcode,
});

function dbMessage(error: { message?: string; code?: string } | null, fallback: string) {
  if (error?.code === "P0001") return error.message ?? fallback;
  return fallback;
}

function refresh() {
  revalidatePath("/frigo");
  revalidatePath("/accueil");
}

export async function addPantryItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const householdId = uuid.safeParse(formData.get("householdId"));
  if (!householdId.success) return fail("Foyer invalide.");
  const parsed = parsePantryItemForm(formData);
  if (!parsed.success) return fail("Vérifie les champs en rouge.", z.flattenError(parsed.error).fieldErrors);
  const supabase = await createClient();
  const { error } = await supabase
    .from("pantry_items")
    .insert({ ...toRow(parsed.data), household_id: householdId.data, added_by: user.id });
  if (error) return fail(dbMessage(error, "Impossible d'ajouter ce produit."));
  refresh();
  return ok(`${parsed.data.name} ajouté.`);
}

export async function updatePantryItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const id = uuid.safeParse(formData.get("itemId"));
  if (!id.success) return fail("Produit invalide.");
  const parsed = parsePantryItemForm(formData);
  if (!parsed.success) return fail("Vérifie les champs en rouge.", z.flattenError(parsed.error).fieldErrors);
  const supabase = await createClient();
  const { data, error } = await supabase.from("pantry_items").update(toRow(parsed.data)).eq("id", id.data).select("id");
  if (error || !data?.length) return fail(dbMessage(error, "Impossible de modifier ce produit."));
  refresh();
  return ok("Modifications enregistrées.");
}

export async function deletePantryItem(formData: FormData) {
  await requireUser();
  const id = uuid.safeParse(formData.get("itemId"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from("pantry_items").delete().eq("id", id.data);
  refresh();
}

export type BarcodeLookup =
  | { status: "found"; barcode: string; product: OffProduct }
  | { status: "not_found"; barcode: string }
  | { status: "error"; message: string };

/** Cherche un code-barres dans Open Food Facts (depuis le serveur : aucune donnée du navigateur n'est transmise). */
export async function lookupBarcode(input: string): Promise<BarcodeLookup> {
  await requireUser();
  const barcode = normalizeBarcode(input);
  if (!barcode) return { status: "error", message: "Ce code-barres n'est pas valide." };

  const supabase = await createClient();
  const { error: quotaError } = await supabase.rpc("check_rate_limit", {
    p_action: "barcode_lookup",
    p_max: 300,
    p_window: "1 day",
  });
  if (quotaError) return { status: "error", message: dbMessage(quotaError, "Recherche indisponible pour le moment.") };

  try {
    const response = await fetch(offProductUrl(barcode), {
      headers: { "User-Agent": `GoodSoup/0.1 (${publicEnv.NEXT_PUBLIC_SITE_URL})`, Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 86_400 },
    });
    if (response.status === 404) return { status: "not_found", barcode };
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const product = parseOffResponse(await response.json());
    return product ? { status: "found", barcode, product } : { status: "not_found", barcode };
  } catch {
    return {
      status: "error",
      message: "Open Food Facts ne répond pas. Saisis le produit à la main, le code-barres sera gardé.",
    };
  }
}
