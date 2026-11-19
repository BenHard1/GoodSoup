import { describe, expect, it } from "vitest";
import { countAlerts, daysUntil, expiryLabel, expiryStatus, sortByExpiry, todayIn } from "@/features/pantry/expiry";
import { parseOffResponse } from "@/features/pantry/openfoodfacts";
import { locationFromSlug, normalizeBarcode, pantryItemSchema } from "@/features/pantry/schemas";

describe("péremption", () => {
  const today = "2026-11-19";

  it("calcule les jours restants, changement d'année compris", () => {
    expect(daysUntil("2026-11-19", today)).toBe(0);
    expect(daysUntil("2026-11-17", today)).toBe(-2);
    expect(daysUntil("2027-01-01", "2026-12-31")).toBe(1);
    expect(daysUntil("2026-03-30", "2026-03-28")).toBe(2); // passage à l'heure d'été
  });

  it("classe les produits", () => {
    expect(expiryStatus(null, today)).toBe("none");
    expect(expiryStatus("2026-11-18", today)).toBe("expired");
    expect(expiryStatus("2026-11-19", today)).toBe("today");
    expect(expiryStatus("2026-11-22", today)).toBe("soon");
    expect(expiryStatus("2026-11-23", today)).toBe("ok");
  });

  it("écrit des libellés lisibles", () => {
    expect(expiryLabel(null, today)).toBeNull();
    expect(expiryLabel("2026-11-15", today)).toBe("Périmé depuis 4 jours");
    expect(expiryLabel("2026-11-18", today)).toBe("Périmé depuis hier");
    expect(expiryLabel("2026-11-19", today)).toBe("Périme aujourd'hui");
    expect(expiryLabel("2026-11-20", today)).toBe("Périme demain");
    expect(expiryLabel("2026-11-21", today)).toBe("Périme dans 2 jours");
    expect(expiryLabel("2026-12-05", today)).toBe("À consommer avant le 5 déc.");
    expect(expiryLabel("2027-02-01", today)).toBe("À consommer avant le 1 févr. 2027");
  });

  it("compte les alertes", () => {
    const items = [
      { expires_on: "2026-11-01" },
      { expires_on: "2026-11-19" },
      { expires_on: "2026-11-21" },
      { expires_on: "2026-12-30" },
      { expires_on: null },
    ];
    expect(countAlerts(items, today)).toEqual({ expired: 1, soon: 2 });
  });

  it("trie par date, sans date à la fin", () => {
    const sorted = sortByExpiry([
      { name: "Sans date", expires_on: null },
      { name: "Beurre", expires_on: "2026-12-01" },
      { name: "Yaourt", expires_on: "2026-11-20" },
      { name: "Crème", expires_on: "2026-11-20" },
    ]);
    expect(sorted.map((i) => i.name)).toEqual(["Crème", "Yaourt", "Beurre", "Sans date"]);
  });

  it("donne la date du jour dans le fuseau de l'utilisateur", () => {
    const lateEvening = new Date("2026-11-19T23:30:00Z");
    expect(todayIn("Europe/Paris", lateEvening)).toBe("2026-11-20");
    expect(todayIn("America/Montreal", lateEvening)).toBe("2026-11-19");
    expect(todayIn("Fuseau/Inconnu", lateEvening)).toBe("2026-11-19");
  });
});

describe("codes-barres", () => {
  it("accepte les EAN valides et refuse les clés de contrôle fausses", () => {
    expect(normalizeBarcode("3017620422003")).toBe("3017620422003");
    expect(normalizeBarcode(" 3017 6204-22003 ")).toBe("3017620422003");
    expect(normalizeBarcode("96385074")).toBe("96385074");
    expect(normalizeBarcode("036000291452")).toBe("036000291452");
    expect(normalizeBarcode("3017620422004")).toBeNull();
    expect(normalizeBarcode("abc")).toBeNull();
    expect(normalizeBarcode("12345")).toBeNull();
  });

  it("lit une réponse Open Food Facts, nom français en priorité", () => {
    expect(
      parseOffResponse({
        status: 1,
        product: {
          product_name: "Hazelnut spread",
          product_name_fr: " Pâte à  tartiner ",
          brands: "Marque A, Marque B",
          quantity: "400 g",
        },
      }),
    ).toEqual({ name: "Pâte à tartiner", brand: "Marque A", quantity: "400 g" });
    expect(parseOffResponse({ status: 1, product: { product_name: "Lait" } })).toEqual({
      name: "Lait",
      brand: null,
      quantity: null,
    });
    expect(parseOffResponse({ status: 0, status_verbose: "product not found" })).toBeNull();
    expect(parseOffResponse({ status: 1, product: { brands: "Sans nom" } })).toBeNull();
    expect(parseOffResponse("oops")).toBeNull();
  });
});

describe("formulaire du frigo", () => {
  const base = { name: "Yaourts", brand: "", quantity: "4 pots", location: "fridge", expiresOn: "", barcode: "" };

  it("normalise les champs facultatifs", () => {
    expect(pantryItemSchema.parse(base)).toEqual({
      name: "Yaourts",
      brand: null,
      quantity: "4 pots",
      location: "fridge",
      expiresOn: null,
      barcode: null,
    });
  });

  it("refuse un nom vide, un emplacement inconnu ou une date invalide", () => {
    expect(pantryItemSchema.safeParse({ ...base, name: "  " }).success).toBe(false);
    expect(pantryItemSchema.safeParse({ ...base, location: "cave" }).success).toBe(false);
    expect(pantryItemSchema.safeParse({ ...base, expiresOn: "demain" }).success).toBe(false);
    expect(pantryItemSchema.parse({ ...base, expiresOn: "2026-12-01" }).expiresOn).toBe("2026-12-01");
  });

  it("ignore un code-barres invalide plutôt que de bloquer l'ajout", () => {
    expect(pantryItemSchema.parse({ ...base, barcode: "123" }).barcode).toBeNull();
  });

  it("lit l'emplacement dans l'adresse", () => {
    expect(locationFromSlug("congelateur")).toBe("freezer");
    expect(locationFromSlug("cave")).toBeNull();
    expect(locationFromSlug(undefined)).toBeNull();
  });
});
