import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";

/** Date « AAAA-MM-JJ » à `offset` jours d'aujourd'hui, dans le fuseau des tests (Europe/Paris). */
const dayFromToday = (offset: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(Date.now() + offset * 86_400_000));

test.describe("Parcours frigo", () => {
  test("ajouter, modifier, filtrer, retirer, alertes de péremption", async ({ page }) => {
    await signUpAndOnboard(page, { name: "Fanny", household: "Chez Fanny" });

    await page.goto("/frigo");
    await expect(page.getByRole("heading", { name: "Mon frigo", level: 1 })).toBeVisible();
    await expect(page.getByText("Le frigo est vide.")).toBeVisible();

    // Ajout d'un produit qui périme demain
    const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Ajouter", exact: true }) });
    await form.getByLabel("Produit", { exact: true }).fill("Yaourts nature");
    await form.getByLabel("Quantité (facultatif)").fill("4 pots");
    await form.getByLabel("À consommer avant (facultatif)").fill(dayFromToday(1));
    await form.getByRole("button", { name: "Ajouter", exact: true }).click();
    await expect(page.getByText("Yaourts nature ajouté.")).toBeVisible();
    await expect(form.getByLabel("Produit", { exact: true })).toHaveValue("");

    // Un second produit, déjà périmé, au congélateur
    await form.getByLabel("Produit", { exact: true }).fill("Petits pois");
    await form.getByLabel("Rangé dans").selectOption("freezer");
    await form.getByLabel("À consommer avant (facultatif)").fill(dayFromToday(-2));
    await form.getByRole("button", { name: "Ajouter", exact: true }).click();
    await expect(page.getByText("Petits pois ajouté.")).toBeVisible();

    const list = page.getByRole("listitem");
    const yaourts = list.filter({ hasText: "Yaourts nature" });
    await expect(yaourts.getByText("Périme demain")).toBeVisible();
    await expect(list.filter({ hasText: "Petits pois" }).getByText("Périmé depuis 2 jours")).toBeVisible();
    await expect(page.getByText(/1 produit périmé et 1 produit à consommer d'ici 3 jours/)).toBeVisible();

    // Modification
    await yaourts.getByRole("button", { name: "Modifier Yaourts nature" }).click();
    await yaourts.getByLabel("Quantité (facultatif)").fill("2 pots");
    await yaourts.getByRole("button", { name: "Enregistrer" }).click();
    await expect(yaourts.getByText("2 pots")).toBeVisible();

    // Filtre par emplacement
    await page.getByRole("link", { name: /Congélateur/ }).click();
    await expect(page).toHaveURL(/lieu=congelateur/);
    await expect(list.filter({ hasText: "Petits pois" })).toBeVisible();
    await expect(list.filter({ hasText: "Yaourts nature" })).toHaveCount(0);
    await page.getByRole("link", { name: /^Tout/ }).click();

    // Accessibilité automatique
    const a11y = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
    expect(
      a11y.violations.map((v) => `${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
    ).toEqual([]);

    // Rappel sur l'accueil
    await page.goto("/accueil");
    await expect(page.getByText(/Dans le frigo : 1 produit périmé/)).toBeVisible();
    await page.getByRole("link", { name: "Voir le frigo" }).click();

    // Retrait
    await page
      .getByRole("listitem")
      .filter({ hasText: "Petits pois" })
      .getByRole("button", { name: "Retirer Petits pois" })
      .click();
    await expect(list.filter({ hasText: "Petits pois" })).toHaveCount(0);
    await expect(page.getByText(/produit périmé/)).toHaveCount(0);
  });
});
