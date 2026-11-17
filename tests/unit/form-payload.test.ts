import { describe, expect, it } from "vitest";
import { emptyRecipeValues } from "@/features/recipes/form-values";
import { valuesToPayload } from "@/features/recipes/form-payload";
import { recipePayloadSchema } from "@/features/recipes/schemas";

describe("formulaire → données envoyées", () => {
  it("ignore les lignes vides et convertit les quantités", () => {
    const v = emptyRecipeValues();
    v.title = "Crêpes";
    v.ingredients[0] = { ...v.ingredients[0], name: "Farine", quantity: "250", unit_code: "g" };
    v.ingredients[1] = { ...v.ingredients[1], name: "Lait", quantity: "1/2", unit_code: "l" };
    v.steps[0] = { ...v.steps[0], instruction: "Mélanger." };
    v.tags = "goûter, Goûter, rapide";
    const { payload, errors } = valuesToPayload(v);
    expect(errors).toEqual([]);
    expect(payload.ingredients).toHaveLength(2);
    expect((payload.ingredients as { quantity: number }[])[1].quantity).toBe(0.5);
    expect(payload.steps).toHaveLength(1);
    expect(payload.tags).toEqual(["goûter", "rapide"]);
    expect(recipePayloadSchema.safeParse(payload).success).toBe(true);
  });

  it("signale une quantité incomprise au lieu de la perdre", () => {
    const v = emptyRecipeValues();
    v.title = "Test";
    v.ingredients[0] = { ...v.ingredients[0], name: "Sucre", quantity: "un peu" };
    const { errors } = valuesToPayload(v);
    expect(errors[0]).toMatch(/non comprise/);
  });

  it("ne partage avec le foyer que si la visibilité le demande", () => {
    const v = emptyRecipeValues("11111111-1111-4111-8111-111111111111");
    v.title = "Test";
    expect(valuesToPayload(v).payload.household_id).toBeNull();
    v.visibility = "household";
    expect(valuesToPayload(v).payload.household_id).toBe("11111111-1111-4111-8111-111111111111");
  });
});
