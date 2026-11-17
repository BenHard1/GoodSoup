import { describe, expect, it } from "vitest";
import { recipeFieldErrors, recipePayloadSchema, slugify } from "@/features/recipes/schemas";

const valid = {
  title: "  Soupe de potiron ",
  servings: "4",
  prep_minutes: 10,
  cook_minutes: null,
  ingredients: [{ name: "Potiron", quantity: 1, quantity_max: null, unit_code: "kg", note: "", is_optional: false }],
  steps: [{ instruction: "Cuire.", duration_minutes: null }],
};

describe("validation d'une recette", () => {
  it("accepte une recette minimale et nettoie les champs", () => {
    const r = recipePayloadSchema.parse(valid);
    expect(r.title).toBe("Soupe de potiron");
    expect(r.servings).toBe(4);
    expect(r.visibility).toBe("private");
    expect(r.ingredients[0].note).toBeNull();
    expect(r.source_url).toBeNull();
  });

  it("exige un titre et des portions valides", () => {
    const res = recipePayloadSchema.safeParse({ ...valid, title: " ", servings: 0 });
    expect(res.success).toBe(false);
    const errors = recipeFieldErrors(res.error!);
    expect(errors.title).toBeDefined();
    expect(errors.servings).toBeDefined();
  });

  it("refuse une fourchette inversée et nomme l'ingrédient fautif", () => {
    const res = recipePayloadSchema.safeParse({
      ...valid,
      ingredients: [valid.ingredients[0], { name: "Sel", quantity: 3, quantity_max: 2, unit_code: null }],
    });
    expect(res.success).toBe(false);
    expect(recipeFieldErrors(res.error!).ingredients?.[0]).toMatch(/^Ingrédient 2/);
  });

  it("une recette publique exige la confirmation des droits", () => {
    const res = recipePayloadSchema.safeParse({ ...valid, visibility: "public" });
    expect(res.success).toBe(false);
    expect(recipeFieldErrors(res.error!).rights_confirmed).toBeDefined();
    expect(recipePayloadSchema.safeParse({ ...valid, visibility: "public", rights_confirmed: true }).success).toBe(
      true,
    );
  });

  it("une recette du foyer exige un foyer", () => {
    expect(recipePayloadSchema.safeParse({ ...valid, visibility: "household" }).success).toBe(false);
  });

  it("refuse une source qui n'est pas une adresse web", () => {
    expect(recipePayloadSchema.safeParse({ ...valid, source_url: "javascript:alert(1)" }).success).toBe(false);
    expect(recipePayloadSchema.parse({ ...valid, source_url: "https://exemple.fr/soupe" }).source_url).toBe(
      "https://exemple.fr/soupe",
    );
  });

  it("refuse un régime inconnu", () => {
    expect(recipePayloadSchema.safeParse({ ...valid, diets: ["carnivore"] }).success).toBe(false);
  });
});

describe("slugify", () => {
  it("produit un identifiant lisible", () => {
    expect(slugify("Plats du soir")).toBe("plats-du-soir");
    expect(slugify("Œufs & Crêpes !")).toBe("oeufs-crepes");
    expect(slugify("!!!")).toBe("categorie");
  });
});
