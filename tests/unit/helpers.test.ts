import { describe, expect, it } from "vitest";
import { parseList } from "@/features/households/food-options";
import { extractInvitationToken } from "@/features/households/schemas";
import { safeNextPath } from "@/lib/safe-redirect";

describe("safeNextPath", () => {
  it("accepte un chemin interne", () => {
    expect(safeNextPath("/foyer/rejoindre/abc")).toBe("/foyer/rejoindre/abc");
  });
  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", null, 42])(
    "refuse %s",
    (value) => {
      expect(safeNextPath(value)).toBe("/accueil");
    },
  );
});

describe("extractInvitationToken", () => {
  const token = "a".repeat(24) + "0123456789abcdef01234567";
  it("lit le jeton depuis le lien complet", () => {
    expect(extractInvitationToken(`https://goodsoup.example/foyer/rejoindre/${token}`)).toBe(token);
  });
  it("accepte le jeton seul, en majuscules ou avec une barre finale", () => {
    expect(extractInvitationToken(` ${token.toUpperCase()}/ `)).toBe(token);
  });
  it("refuse un texte quelconque", () => {
    expect(extractInvitationToken("bonjour")).toBeNull();
  });
});

describe("parseList", () => {
  it("découpe, nettoie et dédoublonne", () => {
    expect(parseList(" tomate, Coriandre ;olives\ncoriandre,, ")).toEqual(["tomate", "coriandre", "olives"]);
  });
  it("limite le nombre d'éléments", () => {
    expect(parseList("a,b,c,d", 2)).toEqual(["a", "b"]);
  });
});
