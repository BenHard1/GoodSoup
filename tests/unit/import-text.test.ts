import { describe, expect, it } from "vitest";
import { recipeFromText } from "@/features/import/text-recipe";

const SOUPE = `
Velouté de potimarron
Une soupe douce et réconfortante pour l'automne.
Pour 4 personnes
Préparation : 15 min   Cuisson : 35 min

Ingrédients
1 kg de potimarron
2 oignons, émincés
50 cl de bouillon de légumes
20 cl de crème liquide
Sel, poivre

Préparation
1. Éplucher le potimarron et le couper en
cubes.
2. Faire revenir les oignons dans un peu
d'huile.
3. Ajouter le potimarron et le bouillon, cuire
30 minutes puis mixer avec la crème.

Astuce
Ajoutez des graines de courge grillées.
3
`;

describe("analyse d'un texte de recette", () => {
  it("reconnaît titre, portions, durées, ingrédients, étapes et astuce", () => {
    const r = recipeFromText(SOUPE, "import_pdf");
    expect(r.title).toBe("Velouté de potimarron");
    expect(r.description).toBe("Une soupe douce et réconfortante pour l'automne.");
    expect(r.servings).toBe(4);
    expect(r.prepMinutes).toBe(15);
    expect(r.cookMinutes).toBe(35);
    expect(r.ingredients.map((i) => [i.quantity, i.unit_code, i.name])).toEqual([
      ["1", "kg", "Potimarron"],
      ["2", null, "Oignons"],
      ["50", "cl", "Bouillon de légumes"],
      ["20", "cl", "Crème liquide"],
      ["", null, "Sel, poivre"],
    ]);
    expect(r.steps.map((s) => s.instruction)).toEqual([
      "Éplucher le potimarron et le couper en cubes.",
      "Faire revenir les oignons dans un peu d'huile.",
      "Ajouter le potimarron et le bouillon, cuire 30 minutes puis mixer avec la crème.",
    ]);
    expect(r.tips).toBe("Ajoutez des graines de courge grillées.");
    expect(r.origin).toBe("import_pdf");
  });

  it("gère les sous-parties et les étapes non numérotées", () => {
    const r = recipeFromText(
      `Tarte aux pommes
Ingrédients :
Pour la pâte :
250 g de farine
125 g de beurre
Pour la garniture :
4 pommes
Étapes
Préparer la pâte et la laisser reposer.
Disposer les pommes en rosace sur la pâte et
enfourner 35 minutes à 180 °C.`,
      "import_photo",
    );
    expect(r.ingredients.map((i) => [i.section, i.name])).toEqual([
      ["Pour la pâte", "Farine"],
      ["Pour la pâte", "Beurre"],
      ["Pour la garniture", "Pommes"],
    ]);
    expect(r.steps.map((s) => s.instruction)).toEqual([
      "Préparer la pâte et la laisser reposer.",
      "Disposer les pommes en rosace sur la pâte et enfourner 35 minutes à 180 °C.",
    ]);
  });

  it("sans titres de section, devine ingrédients puis étapes", () => {
    const r = recipeFromText(
      `Pâtes au pesto
200 g de pâtes
2 c. à soupe de pesto
Faire cuire les pâtes dans une grande casserole d'eau bouillante salée.
Égoutter et mélanger avec le pesto.`,
      "import_photo",
    );
    expect(r.title).toBe("Pâtes au pesto");
    expect(r.ingredients).toHaveLength(2);
    expect(r.steps).toHaveLength(2);
  });

  it("signale ce qui manque", () => {
    const r = recipeFromText("", "import_photo");
    expect(r.title).toBe("Recette importée");
    expect(r.warnings.length).toBeGreaterThanOrEqual(3);
  });
});
