import { describe, expect, it } from "vitest";
import { filtersHref, parseFilters } from "@/features/recipes/search-params";

describe("filtres de recherche", () => {
  it("ignore les valeurs inattendues", () => {
    const f = parseFilters({
      q: "  soupe ",
      categorie: "pas-un-uuid",
      duree: "17",
      difficulte: "extreme",
      regime: "x",
      tri: "drop",
      page: "-3",
    });
    expect(f).toEqual({
      q: "soupe",
      categorie: null,
      duree: null,
      difficulte: null,
      regime: null,
      tri: "recent",
      page: 1,
    });
  });

  it("garde les valeurs valides", () => {
    const f = parseFilters({ duree: "30", difficulte: "easy", regime: "vegan", tri: "alpha", page: "2" }, "popular");
    expect(f).toMatchObject({ duree: 30, difficulte: "easy", regime: "vegan", tri: "alpha", page: 2 });
    expect(parseFilters({}, "popular").tri).toBe("popular");
  });

  it("construit une adresse propre", () => {
    expect(filtersHref("/recettes", { q: "tarte", page: 1, duree: null })).toBe("/recettes?q=tarte");
    expect(filtersHref("/recettes", {})).toBe("/recettes");
  });
});
