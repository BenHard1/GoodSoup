import { NextResponse } from "next/server";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

/**
 * Export RGPD (droit à la portabilité) : toutes les données personnelles de l'utilisateur, au format JSON.
 * Lecture via le client utilisateur : la RLS garantit qu'aucune donnée d'un autre membre n'est incluse
 * au-delà de ce qu'il voit déjà (nom du foyer).
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const supabase = await createClient();

  const [profile, memberships, foodProfiles, recipes, favorites, notes, ratings, reports] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, locale, timezone, preferences, onboarded_at, created_at")
      .eq("id", user.id)
      .single(),
    supabase.from("household_members").select("role, joined_at, households(name)").eq("user_id", user.id),
    supabase
      .from("food_profiles")
      .select("display_name, allergies, exclusions, likes, dislikes, diets, goals, portion_factor, created_at")
      .eq("user_id", user.id),
    supabase
      .from("recipes")
      .select(
        `id, title, description, servings, prep_minutes, cook_minutes, rest_minutes, difficulty, tips, tags, diets,
         visibility, origin, source_url, source_name, attribution, published_at, created_at, updated_at,
         recipe_ingredients(position, section, name, quantity, quantity_max, unit_code, note, is_optional),
         recipe_steps(position, section, instruction, duration_minutes),
         recipe_images(storage_path, position, alt_text),
         recipe_categories(categories(name))`,
      )
      .eq("owner_id", user.id)
      .order("created_at"),
    supabase.from("favorites").select("created_at, recipes(id, title)").eq("user_id", user.id),
    supabase.from("recipe_notes").select("body, updated_at, recipes(id, title)").eq("user_id", user.id),
    supabase.from("recipe_ratings").select("rating, comment, updated_at, recipes(id, title)").eq("user_id", user.id),
    supabase.from("reports").select("reason, details, status, created_at, recipe_id").eq("reporter_id", user.id),
  ]);

  const failed = [profile, memberships, foodProfiles, recipes, favorites, notes, ratings, reports].find((r) => r.error);
  if (failed) {
    return NextResponse.json({ error: "L'export a échoué, réessaie dans un instant." }, { status: 500 });
  }

  const body = {
    format: "good-soup-export",
    version: 1,
    exported_at: new Date().toISOString(),
    account: { email: user.email },
    profile: profile.data,
    households: memberships.data,
    food_profiles: foodProfiles.data,
    recipes: recipes.data,
    favorites: favorites.data,
    personal_notes: notes.data,
    ratings: ratings.data,
    reports: reports.data,
    note: "Les photos sont désignées par leur chemin de stockage ; elles restent téléchargeables depuis chaque recette.",
  };
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="good-soup-export-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
