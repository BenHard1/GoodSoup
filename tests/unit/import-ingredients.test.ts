import { describe, expect, it } from "vitest";
import { parseHumanDuration, parseIsoDuration } from "@/features/import/duration";
import { looksLikeIngredient, parseIngredientLine } from "@/features/import/ingredient-line";

const p = (s: string) => {
  const r = parseIngredientLine(s);
  return r && { q: r.quantity, u: r.unit_code, n: r.name, note: r.note, opt: r.is_optional };
};

describe("lignes d'ingrédients", () => {
  it.each([
    ["200 g de farine", { q: "200", u: "g", n: "Farine", note: null, opt: false }],
    ["100g de beurre mou", { q: "100", u: "g", n: "Beurre mou", note: null, opt: false }],
    ["2 c. à soupe d'huile d'olive", { q: "2", u: "cs", n: "Huile d'olive", note: null, opt: false }],
    ["1 cuillère à café de sel", { q: "1", u: "cc", n: "Sel", note: null, opt: false }],
    ["3 œufs", { q: "3", u: null, n: "Œufs", note: null, opt: false }],
    ["½ citron", { q: "0,5", u: null, n: "Citron", note: null, opt: false }],
    ["1 1/2 cup sugar", { q: "1,5", u: "tasse", n: "Sugar", note: null, opt: false }],
    ["2 à 3 carottes", { q: "2-3", u: null, n: "Carottes", note: null, opt: false }],
    [
      "1 boîte (400 g) de tomates concassées",
      { q: "1", u: "boite", n: "Tomates concassées", note: "400 g", opt: false },
    ],
    ["1 oignon, émincé", { q: "1", u: null, n: "Oignon", note: "émincé", opt: false }],
    ["Sel, poivre", { q: "", u: null, n: "Sel, poivre", note: null, opt: false }],
    ["une pincée de muscade", { q: "1", u: "pincee", n: "Muscade", note: null, opt: false }],
    ["- 2 gousses d'ail", { q: "2", u: "gousse", n: "Ail", note: null, opt: false }],
    ["3 noix", { q: "3", u: null, n: "Noix", note: null, opt: false }],
    ["1 noix de beurre", { q: "1", u: "noix", n: "Beurre", note: null, opt: false }],
    ["50 cl de lait", { q: "50", u: "cl", n: "Lait", note: null, opt: false }],
    ["1 gingembre frais", { q: "1", u: null, n: "Gingembre frais", note: null, opt: false }],
    ["Coriandre (facultatif)", { q: "", u: null, n: "Coriandre", note: null, opt: true }],
    ["QS de sel", { q: "", u: "qs", n: "Sel", note: null, opt: false }],
    ["1,5 kg de pommes de terre", { q: "1,5", u: "kg", n: "Pommes de terre", note: null, opt: false }],
  ])("%s", (line, expected) => {
    expect(p(line)).toEqual(expected);
  });

  it("ignore les lignes vides", () => {
    expect(parseIngredientLine("   ")).toBeNull();
  });

  it("reconnaît une ligne d'ingrédient", () => {
    expect(looksLikeIngredient("200 g de farine")).toBe(true);
    expect(looksLikeIngredient("• Sel")).toBe(true);
    expect(looksLikeIngredient("180 °C")).toBe(false);
    expect(looksLikeIngredient("20 minutes")).toBe(false);
    expect(looksLikeIngredient("Faire revenir les oignons dans le beurre pendant dix minutes.")).toBe(false);
  });
});

describe("durées", () => {
  it.each([
    ["PT1H30M", 90],
    ["PT45M", 45],
    ["P0DT0H20M", 20],
    ["PT0S", null],
    ["1 h 30", 90],
    ["1h30", 90],
    ["2 heures 30", 150],
    ["20 min", 20],
    ["1 h 20 min", 80],
    ["1 heure et 15 minutes", 75],
    ["45 minutes", 45],
    ["n'importe quoi", null],
  ])("%s → %s", (input, expected) => {
    expect(parseIsoDuration(input)).toBe(expected);
  });

  it("texte libre", () => {
    expect(parseHumanDuration("Cuisson : 25 mn")).toBe(25);
  });
});
