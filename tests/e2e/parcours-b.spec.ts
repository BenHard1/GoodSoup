import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import path from "node:path";
import { fillRecipe, signIn, signOut, signUpAndOnboard } from "./helpers";

const PHOTO = path.resolve("tests/e2e/fixtures/soupe.png");

test.describe("Parcours B — ma bibliothèque de recettes", () => {
  test("créer avec photo, retrouver après reconnexion, modifier, ajuster les portions, filtrer", async ({ page }) => {
    page.on("dialog", (d) => d.accept());
    const email = await signUpAndOnboard(page, { name: "Bea", household: "Chez Béa" });

    // Création manuelle
    await page.goto("/recettes/nouvelle");
    await expect(page.getByText("Depuis une photo")).toBeVisible(); // mode futur, signalé comme tel
    await fillRecipe(page, {
      title: "Velouté de potiron",
      servings: "4",
      prep: "15",
      cook: "25",
      ingredients: [
        { quantity: "800", unit: "g", name: "potiron" },
        { quantity: "1/2", unit: "l", name: "lait" },
        { quantity: "2", unit: "gousse", name: "ail" },
      ],
      steps: ["Éplucher et couper le potiron.", "Cuire 25 minutes puis mixer avec le lait."],
    });
    await page.getByText("Dîner", { exact: true }).click();
    await page.getByText("Végétarien", { exact: true }).click();
    await page.locator('input[type="file"]').setInputFiles(PHOTO);
    await expect(page.getByAltText("Photo 1 sélectionnée")).toBeVisible();
    await page.getByRole("button", { name: "Créer la recette" }).click();

    await expect(page).toHaveURL(/\/recettes\/[0-9a-f-]{36}\?enregistree=1/);
    await expect(page.getByRole("heading", { level: 1, name: "Velouté de potiron" })).toBeVisible();
    await expect(page.getByAltText("Photo de Velouté de potiron")).toBeVisible();
    await expect(page.getByText("800 g")).toBeVisible();
    await expect(page.getByText("40 min")).toBeVisible();
    const recipeUrl = page.url().split("?")[0];

    // Ajustement des portions : affichage seulement
    await page.getByRole("button", { name: "Une portion de plus" }).click();
    await page.getByRole("button", { name: "Une portion de plus" }).click();
    await expect(page.getByText("6 portions")).toBeVisible();
    await expect(page.getByText(/^1\s200 g$/)).toBeVisible();
    await expect(page.getByText("3 gousses")).toBeVisible();
    await page.reload();
    await expect(page.getByText("4 portions")).toBeVisible();
    await expect(page.getByText("800 g")).toBeVisible();

    // Persistance après déconnexion / reconnexion
    await signOut(page);
    await signIn(page, email);
    await expect(page).toHaveURL(/\/accueil/);
    await expect(page.getByRole("link", { name: "Velouté de potiron" })).toBeVisible();

    // Modification
    await page.goto(recipeUrl);
    await page.getByRole("link", { name: "Modifier" }).click();
    await expect(page.getByLabel("Titre", { exact: true })).toHaveValue("Velouté de potiron");
    await expect(page.getByAltText("Photo 1")).toBeVisible();
    await page.getByLabel("Titre", { exact: true }).fill("Velouté de potiron au cumin");
    await page.getByRole("button", { name: "Ajouter un ingrédient" }).click();
    await page.getByLabel("Quantité de l'ingrédient 4", { exact: true }).fill("1");
    await page.getByLabel("Unité de l'ingrédient 4", { exact: true }).selectOption("cc");
    await page.getByLabel("Nom de l'ingrédient 4", { exact: true }).fill("cumin");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Velouté de potiron au cumin" })).toBeVisible();
    await expect(page.getByText("1 c. à café")).toBeVisible();

    // Favori
    await page.getByRole("button", { name: "Ajouter aux favoris" }).click();
    await expect(page.getByRole("button", { name: "Dans mes favoris" })).toBeVisible();

    // Une seconde recette pour vérifier la recherche et les filtres
    await page.goto("/recettes/nouvelle");
    await fillRecipe(page, {
      title: "Omelette express",
      prep: "5",
      cook: "5",
      ingredients: [{ quantity: "3", unit: "piece", name: "œuf" }],
      steps: ["Battre les œufs et cuire."],
    });
    await page.getByRole("button", { name: "Créer la recette" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Omelette express" })).toBeVisible();

    await page.goto("/recettes?q=potiron");
    await expect(page.getByRole("link", { name: "Velouté de potiron au cumin" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Omelette express" })).toHaveCount(0);

    await page.goto("/recettes?q=cumin"); // par ingrédient
    await expect(page.getByRole("link", { name: "Velouté de potiron au cumin" })).toBeVisible();

    await page.goto("/recettes?duree=15");
    await expect(page.getByRole("link", { name: "Omelette express" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Velouté de potiron au cumin" })).toHaveCount(0);

    await page.goto("/recettes?regime=vegetarien");
    await expect(page.getByRole("link", { name: "Velouté de potiron au cumin" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Omelette express" })).toHaveCount(0);

    await page.goto("/recettes?vue=favoris");
    await expect(page.getByRole("link", { name: "Velouté de potiron au cumin" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Omelette express" })).toHaveCount(0);

    // Accessibilité automatique de la liste et de la fiche
    for (const url of ["/recettes", recipeUrl]) {
      await page.goto(url);
      const a11y = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
      expect(
        a11y.violations.map((v) => `${url} ${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
      ).toEqual([]);
    }

    // Suppression
    await page.goto(recipeUrl);
    await page.getByRole("button", { name: "Supprimer la recette" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Supprimer" }).click();
    await expect(page).toHaveURL(/\/recettes\?supprimee=1/);
    await expect(page.getByRole("link", { name: "Velouté de potiron au cumin" })).toHaveCount(0);
  });

  test("coupure réseau : rien n'est perdu, le brouillon est repris", async ({ page, context }) => {
    page.on("dialog", (d) => d.accept());
    await signUpAndOnboard(page, { name: "Hugo", household: "Chez Hugo" });
    await page.goto("/recettes/nouvelle");
    await fillRecipe(page, {
      title: "Gratin hors ligne",
      ingredients: [{ quantity: "1", unit: "kg", name: "pomme de terre" }],
      steps: ["Trancher, napper de crème, cuire 1 h."],
    });
    await expect(page.getByText("Brouillon gardé sur cet appareil")).toBeVisible();

    await context.setOffline(true);
    await page.getByRole("button", { name: "Créer la recette" }).click();
    await expect(page.getByText(/Connexion perdue/)).toBeVisible();
    await expect(page.getByLabel("Titre", { exact: true })).toHaveValue("Gratin hors ligne");
    await context.setOffline(false);

    // Même après rechargement, le brouillon est proposé.
    await page.reload();
    await expect(page.getByText("Un brouillon non enregistré")).toBeVisible();
    await page.getByRole("button", { name: "Reprendre le brouillon" }).click();
    await expect(page.getByLabel("Titre", { exact: true })).toHaveValue("Gratin hors ligne");
    await page.getByRole("button", { name: "Créer la recette" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Gratin hors ligne" })).toBeVisible();

    // Une fois enregistré, le brouillon disparaît.
    await page.goto("/recettes/nouvelle");
    await expect(page.getByLabel("Titre", { exact: true })).toBeVisible();
    await expect(page.getByText("Un brouillon non enregistré")).toHaveCount(0);
  });
});
