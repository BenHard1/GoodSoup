import { expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
export const PASSWORD = "Soupe-aux-potirons-42";

export const uniqueEmail = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8)}@example.test`;

/** Récupère le lien du dernier e-mail reçu par `to` (Mailpit). */
export async function getEmailLink(to: string, timeoutMs = 20_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    if (res.ok) {
      const body = (await res.json()) as { messages?: { ID: string }[] };
      const id = body.messages?.[0]?.ID;
      if (id) {
        const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json()) as { HTML: string };
        const href = msg.HTML.match(/href="([^"]+)"/)?.[1];
        if (href) return href.replaceAll("&amp;", "&");
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Aucun e-mail reçu pour ${to}`);
}

export async function signUp(
  page: Page,
  { name, email, from = "/inscription" }: { name: string; email: string; from?: string },
) {
  await page.goto(from);
  await page.getByLabel("Prénom ou pseudonyme").fill(name);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirme le mot de passe").fill(PASSWORD);
  await page.getByLabel(/J'ai lu la/).check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByRole("heading", { name: "Vérifie ta boîte mail" })).toBeVisible();
  const link = await getEmailLink(email);
  await page.goto(link);
}

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/connexion");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: /Menu du compte/ }).click();
  await page.getByRole("menuitem", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/connexion/);
}

/** Inscription complète + parcours de bienvenue avec création d'un foyer. */
export async function signUpAndOnboard(page: Page, { name, household }: { name: string; household: string }) {
  const email = uniqueEmail(name.toLowerCase());
  await signUp(page, { name, email });
  await expect(page).toHaveURL(/\/bienvenue/);
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByLabel("Nom du foyer").fill(household);
  await page.getByRole("button", { name: "Créer", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tes préférences" })).toBeVisible();
  await page.getByRole("button", { name: /Terminer/ }).click();
  await expect(page).toHaveURL(/\/accueil/);
  return email;
}

type IngredientInput = { quantity?: string; unit?: string; name: string };

/** Remplit le formulaire de recette (création ou modification). */
export async function fillRecipe(
  page: Page,
  r: {
    title: string;
    servings?: string;
    prep?: string;
    cook?: string;
    ingredients: IngredientInput[];
    steps: string[];
  },
) {
  await page.getByLabel("Titre", { exact: true }).fill(r.title);
  if (r.servings) await page.getByLabel("Portions", { exact: true }).fill(r.servings);
  if (r.prep) await page.getByLabel("Préparation (min)").fill(r.prep);
  if (r.cook) await page.getByLabel("Cuisson (min)").fill(r.cook);
  for (const [i, ing] of r.ingredients.entries()) {
    const n = i + 1;
    if ((await page.getByLabel(`Nom de l'ingrédient ${n}`, { exact: true }).count()) === 0) {
      await page.getByRole("button", { name: "Ajouter un ingrédient" }).click();
    }
    await page.getByLabel(`Quantité de l'ingrédient ${n}`, { exact: true }).fill(ing.quantity ?? "");
    if (ing.unit) await page.getByLabel(`Unité de l'ingrédient ${n}`, { exact: true }).selectOption(ing.unit);
    await page.getByLabel(`Nom de l'ingrédient ${n}`, { exact: true }).fill(ing.name);
  }
  for (const [i, step] of r.steps.entries()) {
    const n = i + 1;
    if ((await page.getByLabel(`Étape ${n}`, { exact: true }).count()) === 0) {
      await page.getByRole("button", { name: "Ajouter une étape" }).click();
    }
    await page.getByLabel(`Étape ${n}`, { exact: true }).fill(step);
  }
}
