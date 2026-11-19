import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import path from "node:path";
import { signUpAndOnboard } from "./helpers";

const PDF = path.resolve("tests/e2e/fixtures/recette.pdf");
const PHOTO = path.resolve("tests/e2e/fixtures/recette-photo.png");

test.describe("Parcours import — recette depuis un PDF ou une photo, sans IA", () => {
  test("PDF : relecture, correction, enregistrement en privé", async ({ page }) => {
    await signUpAndOnboard(page, { name: "Ines", household: "Chez Inès" });

    await page.goto("/recettes/nouvelle");
    await page.getByRole("link", { name: "Depuis un PDF" }).click();
    await expect(page).toHaveURL(/\/recettes\/importer\?depuis=pdf/);
    await expect(page.getByRole("tab", { name: "PDF" })).toHaveAttribute("aria-selected", "true");
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(axe.violations).toEqual([]);

    await page.locator('input[type="file"][accept="application/pdf"]').setInputFiles(PDF);
    await expect(page.getByText("Relis et corrige la recette")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel("Titre", { exact: true })).toHaveValue("Crumble aux pommes");
    await expect(page.getByLabel("Portions")).toHaveValue("6");
    await expect(page.getByText("Une recette importée est enregistrée en")).toBeVisible();

    // Correction avant enregistrement
    await page.getByLabel("Titre", { exact: true }).fill("Crumble de mamie");
    await page.getByRole("button", { name: "Créer la recette" }).click();

    await expect(page).toHaveURL(/\/recettes\/[0-9a-f-]{36}\?enregistree=1/);
    await expect(page.getByRole("heading", { level: 1, name: "Crumble de mamie" })).toBeVisible();
    await expect(page.getByText("150 g")).toBeVisible();
    await expect(page.getByText("Mélanger la farine, le beurre et le sucre du bout des doigts.")).toBeVisible();
    await expect(page.getByText("Privée").first()).toBeVisible();
  });

  test("photo : lecture dans le navigateur puis relecture", async ({ page }) => {
    test.setTimeout(180_000);
    await signUpAndOnboard(page, { name: "Oscar", household: "Chez Oscar" });

    await page.goto("/recettes/importer?depuis=photo");
    await page.locator('input[type="file"][accept^="image/"]').setInputFiles(PHOTO);
    await expect(page.getByAltText("Photo 1")).toBeVisible();
    await page.getByRole("button", { name: "Lire la recette" }).click();
    await expect(page.getByText("Relis et corrige la recette")).toBeVisible({ timeout: 150_000 });
    await expect(page.getByLabel("Titre", { exact: true })).toHaveValue(/Crumble/);
    await page.getByText("Voir le texte lu, pour comparer").click();
    await expect(page.getByText(/farine/).first()).toBeVisible();
  });
});
