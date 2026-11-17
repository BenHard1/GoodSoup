import { expect, test } from "@playwright/test";
import { fillRecipe, signUpAndOnboard } from "./helpers";

test.describe("Parcours F — bibliothèque publique", () => {
  test("publier avec droits, un autre membre trouve, copie et modifie sans toucher l'original", async ({
    page,
    browser,
  }) => {
    page.on("dialog", (d) => d.accept());
    await signUpAndOnboard(page, { name: "Zoe", household: "Chez Zoé" });
    const title = `Tarte fine aux pommes ${Date.now().toString(36)}`;

    await page.goto("/recettes/nouvelle");
    await fillRecipe(page, {
      title,
      prep: "20",
      cook: "30",
      ingredients: [
        { quantity: "1", unit: "piece", name: "pâte feuilletée" },
        { quantity: "4", unit: "piece", name: "pomme" },
      ],
      steps: ["Étaler la pâte, disposer les pommes, cuire 30 min à 200 °C."],
    });
    await page.getByText("Dessert", { exact: true }).click();
    await page.getByText("Publique", { exact: true }).click();
    // Sans confirmation des droits, la publication est refusée.
    await page.getByRole("button", { name: "Créer la recette" }).click();
    await expect(page.getByText("Confirme que tu as le droit de publier cette recette.").first()).toBeVisible();
    await page.getByLabel(/Je confirme que cette recette est la mienne/).check();
    await page.getByRole("button", { name: "Créer la recette" }).click();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByText("Publique").first()).toBeVisible();
    const originalUrl = page.url().split("?")[0];

    // Un autre membre, dans un autre foyer
    const ctx = await browser.newContext();
    const other = await ctx.newPage();
    other.on("dialog", (d) => d.accept());
    await signUpAndOnboard(other, { name: "Yann", household: "Chez Yann" });
    await other.goto(`/decouvrir?q=${encodeURIComponent(title)}`);
    await other.getByRole("link", { name: title }).click();
    await expect(other.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(other.getByText("Zoe")).toBeVisible();
    await expect(other.getByRole("link", { name: "Modifier" })).toHaveCount(0);

    // Copie personnelle
    await other.getByRole("button", { name: "Copier dans mes recettes" }).click();
    await expect(other.getByText(/Copie ajoutée à tes recettes/)).toBeVisible();
    await expect(other.getByText("D'après une recette partagée par Zoe")).toBeVisible();
    await expect(other.getByText("Privée", { exact: true })).toBeVisible();
    await other.getByRole("link", { name: "Modifier" }).click();
    // La copie d'une recette d'un autre auteur ne peut pas être republiée.
    await expect(other.getByRole("radio", { name: /Publique/ })).toBeDisabled();
    await other.getByLabel("Titre", { exact: true }).fill("Ma tarte aux pommes (moins sucrée)");
    await other.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(other.getByRole("heading", { level: 1, name: "Ma tarte aux pommes (moins sucrée)" })).toBeVisible();

    // L'original n'a pas changé
    await other.getByRole("link", { name: "Voir la recette d'origine" }).click();
    await expect(other.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await page.goto(originalUrl);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

    // Signalement par l'autre membre
    await other.getByRole("button", { name: "Signaler" }).click();
    await other.getByLabel("Publicité ou spam").check();
    await other.getByRole("button", { name: "Envoyer" }).click();
    await expect(other.getByText("Merci, la modération va examiner cette recette.")).toBeVisible();
    await ctx.close();
  });
});
