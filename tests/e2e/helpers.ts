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
