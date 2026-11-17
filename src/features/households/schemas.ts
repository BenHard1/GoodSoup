import { z } from "zod";
import { ALLERGEN_VALUES, DIET_VALUES, parseList } from "./food-options";

export const householdNameSchema = z
  .string()
  .trim()
  .min(1, { error: "Donne un nom à ton foyer." })
  .max(60, { error: "60 caractères maximum." });

/** Accepte le lien complet d'invitation ou le jeton seul. */
export function extractInvitationToken(input: string): string | null {
  const trimmed = input.trim();
  const match = trimmed.match(/([a-f0-9]{48})\/?$/i);
  return match ? match[1].toLowerCase() : null;
}

export function parseFoodProfileForm(formData: FormData) {
  const allergiesChecked = formData
    .getAll("allergies")
    .map(String)
    .filter((v) => ALLERGEN_VALUES.includes(v));
  const allergiesOther = parseList(formData.get("allergiesOther"), 20);
  return z
    .object({
      displayName: z.string().trim().min(1, { error: "Indique un prénom." }).max(60),
      allergies: z.array(z.string()).max(50),
      exclusions: z.array(z.string()).max(100),
      likes: z.array(z.string()).max(100),
      dislikes: z.array(z.string()).max(100),
      diets: z.array(z.enum(DIET_VALUES as [string, ...string[]])).max(20),
      goals: z.string().trim().max(500).optional(),
    })
    .safeParse({
      displayName: formData.get("displayName") ?? "",
      allergies: [...new Set([...allergiesChecked, ...allergiesOther])],
      exclusions: parseList(formData.get("exclusions"), 100),
      likes: parseList(formData.get("likes"), 100),
      dislikes: parseList(formData.get("dislikes"), 100),
      diets: formData.getAll("diets").map(String),
      goals: (formData.get("goals") as string | null) || undefined,
    });
}
