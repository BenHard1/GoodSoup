import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

/** Client navigateur : uniquement la clé publique, soumis à la RLS. */
export function createClient() {
  return createBrowserClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
