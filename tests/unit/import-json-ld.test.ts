import { describe, expect, it } from "vitest";
import { extractJsonLdBlocks, findRecipe, recipeFromJsonLd } from "@/features/import/json-ld";

const page = (jsonLd: unknown, extraHead = "") => `<!doctype html><html><head>
<meta property="og:site_name" content="Cuisine &amp; Co">
${extraHead}
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head><body><h1>Titre</h1></body></html>`;

describe("import par lien : schema.org Recipe", () => {
  it("lit une recette complète dans un @graph", () => {
    const html = page({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebSite", name: "Cuisine & Co" },
        {
          "@type": ["Recipe"],
          name: "Gratin dauphinois",
          description: "<p>Le classique &eacute;ternel.</p>",
          recipeYield: ["6", "6 personnes"],
          prepTime: "PT20M",
          cookTime: "PT1H",
          totalTime: "PT1H40M",
          author: { "@type": "Person", name: "Julie" },
          image: [{ url: "https://exemple.fr/gratin.jpg" }],
          keywords: "gratin, pommes de terre, Gratin",
          recipeCategory: "Plat principal",
          recipeIngredient: ["1 kg de pommes de terre", "50 cl de crème", "1 gousse d'ail"],
          recipeInstructions: [
            {
              "@type": "HowToSection",
              name: "Préparation",
              itemListElement: [
                { "@type": "HowToStep", text: "Éplucher les pommes de terre." },
                { "@type": "HowToStep", text: "Les couper en rondelles." },
              ],
            },
            { "@type": "HowToStep", text: "Enfourner 1 h à 160 °C." },
          ],
        },
      ],
    });
    const r = recipeFromJsonLd(html, "https://exemple.fr/gratin")!;
    expect(r).toMatchObject({
      origin: "import_url",
      method: "structured",
      title: "Gratin dauphinois",
      description: "Le classique éternel.",
      servings: 6,
      prepMinutes: 20,
      cookMinutes: 60,
      restMinutes: 20,
      sourceUrl: "https://exemple.fr/gratin",
      sourceName: "Cuisine & Co",
      attribution: "Recette de Julie",
      imageUrl: "https://exemple.fr/gratin.jpg",
      tags: ["Plat principal", "gratin", "pommes de terre"],
    });
    expect(r.ingredients.map((i) => [i.quantity, i.unit_code, i.name])).toEqual([
      ["1", "kg", "Pommes de terre"],
      ["50", "cl", "Crème"],
      ["1", "gousse", "Ail"],
    ]);
    expect(r.steps).toEqual([
      { section: "Préparation", instruction: "Éplucher les pommes de terre." },
      { section: "Préparation", instruction: "Les couper en rondelles." },
      { section: null, instruction: "Enfourner 1 h à 160 °C." },
    ]);
    expect(r.warnings).toEqual([]);
  });

  it("instructions en un seul bloc de texte, temps total seul", () => {
    const r = recipeFromJsonLd(
      page({
        "@type": "Recipe",
        name: "Crêpes",
        totalTime: "PT30M",
        recipeIngredient: ["250 g de farine"],
        recipeInstructions: "1. Mélanger.<br>2. Cuire.",
      }),
      "https://exemple.fr/crepes",
    )!;
    expect(r.steps.map((s) => s.instruction)).toEqual(["Mélanger.", "Cuire."]);
    expect(r.prepMinutes).toBe(30);
    expect(r.warnings).toHaveLength(1);
  });

  it("ignore les blocs invalides et les pages sans recette", () => {
    const html = `<script type="application/ld+json">{ invalide </script>
      <script type="application/ld+json">{"@type":"Article","name":"x",}</script>`;
    expect(extractJsonLdBlocks(html)).toHaveLength(1);
    expect(findRecipe(extractJsonLdBlocks(html))).toBeNull();
    expect(recipeFromJsonLd(html, "https://exemple.fr")).toBeNull();
  });
});
