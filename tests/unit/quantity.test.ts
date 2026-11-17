import { describe, expect, it } from "vitest";
import {
  formatIngredientQuantity,
  formatQuantity,
  parseQuantity,
  quantityToInput,
  scaleQuantity,
  type Unit,
} from "@/features/recipes/quantity";

const units = new Map<string, Unit>(
  [
    { code: "g", label: "g", plural: "g", kind: "mass" },
    { code: "cs", label: "c. à soupe", plural: "c. à soupe", kind: "volume" },
    { code: "piece", label: "pièce", plural: "pièces", kind: "count" },
    { code: "gousse", label: "gousse", plural: "gousses", kind: "count" },
    { code: "pincee", label: "pincée", plural: "pincées", kind: "other" },
  ].map((u) => [u.code, u]),
);

describe("parseQuantity", () => {
  it.each([
    ["", { quantity: null, quantityMax: null }],
    ["2", { quantity: 2, quantityMax: null }],
    ["1,5", { quantity: 1.5, quantityMax: null }],
    ["1.25", { quantity: 1.25, quantityMax: null }],
    ["1/2", { quantity: 0.5, quantityMax: null }],
    ["1 1/2", { quantity: 1.5, quantityMax: null }],
    ["½", { quantity: 0.5, quantityMax: null }],
    ["1½", { quantity: 1.5, quantityMax: null }],
    ["2-3", { quantity: 2, quantityMax: 3 }],
    ["2 à 3", { quantity: 2, quantityMax: 3 }],
    ["3-3", { quantity: 3, quantityMax: null }],
  ])("« %s »", (input, expected) => {
    expect(parseQuantity(input)).toEqual(expected);
  });

  it.each(["abc", "0", "-2", "3-2", "1/0", "1-2-3"])("refuse « %s »", (input) => {
    expect(parseQuantity(input)).toBeNull();
  });
});

describe("formatQuantity", () => {
  it.each([
    [0.5, "½"],
    [1.5, "1 ½"],
    [2.25, "2 ¼"],
    [1 / 3, "⅓"],
    [0.75, "¾"],
    [1.2, "1,2"],
    [12.34, "12,3"],
    [333.333, "333"],
    [4, "4"],
  ])("%s → « %s »", (n, expected) => {
    expect(formatQuantity(n)).toBe(expected);
  });
});

describe("ajustement des portions", () => {
  it("double et divise proportionnellement", () => {
    expect(scaleQuantity(200, 4, 8)).toBe(400);
    expect(scaleQuantity(3, 4, 2)).toBe(1.5);
    expect(scaleQuantity(null, 4, 8)).toBeNull();
  });

  it("affiche des quantités lisibles après mise à l'échelle", () => {
    const oeufs = { quantity: 3, quantity_max: null, unit_code: "piece" };
    expect(formatIngredientQuantity(oeufs, units, 2 / 4)).toBe("1 ½");
    const farine = { quantity: 250, quantity_max: null, unit_code: "g" };
    expect(formatIngredientQuantity(farine, units, 6 / 4)).toBe("375 g");
    const huile = { quantity: 1, quantity_max: 2, unit_code: "cs" };
    expect(formatIngredientQuantity(huile, units)).toBe("1 à 2 c. à soupe");
    const ail = { quantity: 2, quantity_max: null, unit_code: "gousse" };
    expect(formatIngredientQuantity(ail, units)).toBe("2 gousses");
    expect(formatIngredientQuantity({ quantity: 1, quantity_max: null, unit_code: "gousse" }, units)).toBe("1 gousse");
  });

  it("une quantité non chiffrée reste telle quelle", () => {
    expect(formatIngredientQuantity({ quantity: null, quantity_max: null, unit_code: "pincee" }, units, 3)).toBe(
      "pincée",
    );
    expect(formatIngredientQuantity({ quantity: null, quantity_max: null, unit_code: null }, units, 3)).toBe("");
  });

  it("restitue la saisie dans le formulaire", () => {
    expect(quantityToInput(1.5, null)).toBe("1,5");
    expect(quantityToInput(2, 3)).toBe("2-3");
    expect(quantityToInput(null, null)).toBe("");
  });
});
