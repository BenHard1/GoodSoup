import "server-only";
import { z } from "zod";

/** Variables secrètes : jamais importées par un composant client (garanti par `server-only`). */
const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(20),
  AI_PROVIDER: z.enum(["none"]).default("none"),
});

export const serverEnv = serverSchema.parse({
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  AI_PROVIDER: process.env.AI_PROVIDER,
});
