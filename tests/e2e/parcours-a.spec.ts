import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { PASSWORD, getEmailLink, signIn, signOut, signUp, uniqueEmail } from "./helpers";

test.describe("Parcours A — première connexion", () => {
  test("inscription, profil, foyer, préférences, tableau de bord, persistance", async ({ page }) => {
    const email = uniqueEmail("alice");
    await signUp(page, { name: "Alice", email });

    // Étape 1 : profil
    await expect(page).toHaveURL(/\/bienvenue/);
    await expect(page.getByLabel("Prénom ou pseudonyme")).toHaveValue("Alice");
    await page.getByRole("button", { name: "Continuer" }).click();

    // Étape 2 : foyer
    await expect(page.getByRole("heading", { name: "Ton foyer" })).toBeVisible();
    await page.getByLabel("Nom du foyer").fill("Chez Alice");
    await page.getByRole("button", { name: "Créer", exact: true }).click();

    // Étape 3 : préférences
    await expect(page.getByRole("heading", { name: "Tes préférences" })).toBeVisible();
    await page.getByText("Arachides", { exact: true }).click();
    await page.getByText("Végétarien", { exact: true }).click();
    await page.getByLabel("Aliments exclus").fill("céleri rave, olives");
    await page.getByRole("button", { name: "Enregistrer mes préférences" }).click();
    await expect(page.getByText("Préférences enregistrées.")).toBeVisible();
    await page.getByRole("button", { name: /Terminer/ }).click();

    // Tableau de bord
    await expect(page).toHaveURL(/\/accueil/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Alice");
    await expect(page.getByText("Chez Alice").first()).toBeVisible();

    // Persistance après déconnexion / reconnexion
    await signOut(page);
    await signIn(page, email);
    await expect(page).toHaveURL(/\/accueil/);
    await page.goto("/profil");
    await expect(page.getByLabel("Aliments exclus")).toHaveValue("céleri rave, olives");
    await expect(page.locator('input[name="allergies"][value="arachides"]')).toBeChecked();

    // Accessibilité automatique de l'accueil
    await page.goto("/accueil");
    const a11y = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
    expect(
      a11y.violations.map((v) => `${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
    ).toEqual([]);
  });

  test("invitation : un second utilisateur rejoint le foyer par lien", async ({ page, browser }) => {
    const ownerEmail = uniqueEmail("owner");
    await signUp(page, { name: "Paul", email: ownerEmail });
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.getByLabel("Nom du foyer").fill("Les Gourmands");
    await page.getByRole("button", { name: "Créer", exact: true }).click();
    await page.getByRole("button", { name: /Terminer/ }).click();
    await expect(page).toHaveURL(/\/accueil/);

    await page.goto("/foyer");
    await page.getByRole("button", { name: /Créer un lien d'invitation/ }).click();
    const link = await page.getByLabel("Lien d'invitation").inputValue();
    expect(link).toMatch(/\/foyer\/rejoindre\/[a-f0-9]{48}$/);

    const ctx = await browser.newContext();
    const guest = await ctx.newPage();
    await guest.goto(link);
    await expect(guest).toHaveURL(/\/connexion\?next=/);
    await guest.getByRole("link", { name: "Inscris-toi" }).click();
    await expect(guest).toHaveURL(/\/inscription\?next=/);
    const guestEmail = uniqueEmail("camille");
    await signUp(guest, { name: "Camille", email: guestEmail, from: guest.url() });

    await expect(guest.getByText("Les Gourmands")).toBeVisible();
    await guest.getByRole("button", { name: "Rejoindre le foyer" }).click();
    await expect(guest.getByRole("heading", { name: "Tes préférences" })).toBeVisible();
    await guest.getByRole("button", { name: /Terminer/ }).click();
    await expect(guest).toHaveURL(/\/accueil/);
    await expect(guest.getByText("Les Gourmands").first()).toBeVisible();
    await ctx.close();

    await page.reload();
    await expect(page.getByText("Camille")).toBeVisible();
  });

  test("mot de passe oublié", async ({ page }) => {
    const email = uniqueEmail("oubli");
    await signUp(page, { name: "Oubli", email });
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.getByRole("button", { name: "Créer", exact: true }).click();
    await page.getByRole("button", { name: /Terminer/ }).click();
    await expect(page).toHaveURL(/\/accueil/);
    await signOut(page);

    await page.goto("/mot-de-passe-oublie");
    await page.getByLabel("E-mail").fill(email);
    await page.getByRole("button", { name: "Recevoir un lien" }).click();
    await expect(page.getByText(/un e-mail vient de t'être envoyé/)).toBeVisible();

    // Le dernier e-mail est celui de réinitialisation (Mailpit renvoie le plus récent en premier).
    await expect.poll(async () => (await getEmailLink(email)).includes("type=recovery")).toBe(true);
    await page.goto(await getEmailLink(email));
    await expect(page).toHaveURL(/\/reinitialiser/);
    const newPassword = `${PASSWORD}-nouveau`;
    await page.getByLabel("Nouveau mot de passe").fill(newPassword);
    await page.getByLabel("Confirme le mot de passe").fill(newPassword);
    await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
    await expect(page.getByText("Ton mot de passe a été modifié.")).toBeVisible();

    await page.goto("/accueil");
    await signOut(page);
    await signIn(page, email, newPassword);
    await expect(page).toHaveURL(/\/accueil/);
  });

  test("un visiteur non connecté est renvoyé vers la connexion", async ({ page }) => {
    for (const path of ["/accueil", "/foyer", "/profil", "/parametres", "/recettes"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/connexion\?next=/);
    }
  });

  test("suppression du compte", async ({ page }) => {
    const email = uniqueEmail("adieu");
    await signUp(page, { name: "Adieu", email });
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.getByRole("button", { name: "Créer", exact: true }).click();
    await page.getByRole("button", { name: /Terminer/ }).click();
    await expect(page).toHaveURL(/\/accueil/);

    await page.goto("/parametres");
    await page.getByRole("button", { name: "Supprimer mon compte" }).click();
    await page.getByLabel("Tape SUPPRIMER pour confirmer").fill("SUPPRIMER");
    await page.getByRole("button", { name: "Supprimer définitivement" }).click();
    await expect(page.getByText("Ton compte et tes données ont été supprimés.")).toBeVisible();

    await signIn(page, email);
    await expect(page.getByText("E-mail ou mot de passe incorrect.")).toBeVisible();
  });
});
