import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAnon, asUser, cleanupUsers, createUser, pool, queryAs } from "./helpers";

/**
 * Bibliothèque de recettes.
 * A et B partagent un foyer ; C vit dans un autre foyer ; D est administrateur.
 */
let a: string, b: string, c: string, d: string;
let foyerAB: string, foyerC: string;

type Row = Record<string, unknown>;
const one = async <R extends Row = Row>(user: string, sql: string, params: unknown[] = []) =>
  (await queryAs<R>(user, sql, params))[0];

const save = async (user: string, payload: Record<string, unknown>) =>
  (await one<{ id: string }>(user, "select public.save_recipe($1::jsonb) as id", [JSON.stringify(payload)])).id;

const baseRecipe = (title: string, extra: Record<string, unknown> = {}) => ({
  title,
  servings: 4,
  prep_minutes: 15,
  cook_minutes: 20,
  difficulty: "easy",
  ingredients: [
    { name: "Carottes", quantity: 500, unit_code: "g" },
    { name: "Oignon", quantity: 1, unit_code: "piece" },
    { name: "Sel", unit_code: "pincee", is_optional: true },
  ],
  steps: [{ instruction: "Éplucher les carottes." }, { instruction: "Cuire 20 minutes." }],
  ...extra,
});

const visibleIds = async (user: string) =>
  (await queryAs<{ id: string }>(user, "select id from public.recipes")).map((r) => r.id);

beforeAll(async () => {
  a = await createUser("Alice");
  b = await createUser("Bruno");
  c = await createUser("Chloé");
  d = await createUser("Modo");
  await pool.query("insert into public.app_admins (user_id) values ($1)", [d]);

  foyerAB = (await one<{ id: string }>(a, "select public.create_household('Chez A') as id")).id;
  foyerC = (await one<{ id: string }>(c, "select public.create_household('Chez C') as id")).id;
  const token = (await one<{ t: string }>(a, "select public.create_household_invitation($1) as t", [foyerAB])).t;
  await queryAs(b, "select public.accept_household_invitation($1)", [token]);
});

afterAll(async () => {
  await cleanupUsers();
  await pool.end();
});

describe("référentiels", () => {
  it("les 11 catégories système, les unités et les ingrédients sont lisibles", async () => {
    const cats = await queryAs(a, "select slug from public.categories where household_id is null");
    expect(cats).toHaveLength(11);
    const units = await queryAs(a, "select code from public.units");
    expect(units.length).toBeGreaterThan(10);
    const ing = await queryAs(a, "select name from public.ingredients where normalized_name = 'oeuf'");
    expect(ing).toEqual([{ name: "œuf" }]);
  });

  it("un utilisateur ne peut pas modifier les référentiels", async () => {
    await expect(
      queryAs(a, "insert into public.units (code, label, plural, kind) values ('x', 'x', 'x', 'other')"),
    ).rejects.toThrow();
    await expect(queryAs(a, "delete from public.ingredients")).rejects.toThrow();
    const rows = await queryAs(
      a,
      "update public.categories set name = 'Pirate' where household_id is null returning id",
    );
    expect(rows).toHaveLength(0);
  });

  it("les catégories d'un foyer ne sont visibles que par ses membres", async () => {
    const cat = await one<{ id: string }>(
      a,
      "insert into public.categories (household_id, slug, name, created_by) values ($1, 'soupes', 'Soupes', $2) returning id",
      [foyerAB, a],
    );
    expect((await queryAs(b, "select id from public.categories where id = $1", [cat.id])).length).toBe(1);
    expect((await queryAs(c, "select id from public.categories where id = $1", [cat.id])).length).toBe(0);
    await expect(
      queryAs(c, "insert into public.categories (household_id, slug, name, created_by) values ($1, 'x', 'X', $2)", [
        foyerAB,
        c,
      ]),
    ).rejects.toThrow();
  });

  it("un visiteur anonyme ne lit aucune recette", async () => {
    await expect(asAnon((cl) => cl.query("select * from public.recipes"))).rejects.toThrow();
  });
});

describe("création et lecture", () => {
  let privee: string;

  beforeAll(async () => {
    privee = await save(a, baseRecipe("Soupe de carottes"));
  });

  it("une recette créée est complète et persistante", async () => {
    const r = await one(a, "select owner_id, visibility, total_minutes, origin from public.recipes where id = $1", [
      privee,
    ]);
    expect(r).toEqual({ owner_id: a, visibility: "private", total_minutes: 35, origin: "manual" });
    const ing = await queryAs(
      a,
      "select name, quantity::float, unit_code, is_optional from public.recipe_ingredients where recipe_id = $1 order by position",
      [privee],
    );
    expect(ing).toEqual([
      { name: "Carottes", quantity: 500, unit_code: "g", is_optional: false },
      { name: "Oignon", quantity: 1, unit_code: "piece", is_optional: false },
      { name: "Sel", quantity: null, unit_code: "pincee", is_optional: true },
    ]);
    const steps = await queryAs(
      a,
      "select instruction from public.recipe_steps where recipe_id = $1 order by position",
      [privee],
    );
    expect(steps).toHaveLength(2);
  });

  it("les ingrédients connus sont reliés au référentiel", async () => {
    const rows = await queryAs<{ name: string; linked: boolean }>(
      a,
      "select name, ingredient_id is not null as linked from public.recipe_ingredients where recipe_id = $1 order by position",
      [privee],
    );
    expect(rows.find((r) => r.name === "Oignon")?.linked).toBe(true);
  });

  it("une recette privée est invisible pour le foyer et les autres", async () => {
    expect(await visibleIds(a)).toContain(privee);
    expect(await visibleIds(b)).not.toContain(privee);
    expect(await visibleIds(c)).not.toContain(privee);
    expect(await queryAs(b, "select * from public.recipe_ingredients where recipe_id = $1", [privee])).toHaveLength(0);
  });

  it("un administrateur ne lit pas les recettes privées", async () => {
    expect(await visibleIds(d)).not.toContain(privee);
  });

  it("on ne peut pas créer une recette au nom d'un autre", async () => {
    const r = await one<{ owner_id: string }>(
      c,
      "insert into public.recipes (owner_id, title) values ($1, 'Usurpation') returning owner_id",
      [a],
    ).catch(() => null);
    // soit refusé, soit réattribué à son vrai auteur
    if (r) expect(r.owner_id).toBe(c);
  });

  it("un étranger ne peut ni modifier ni supprimer la recette", async () => {
    await expect(save(c, { ...baseRecipe("Piratée"), id: privee })).rejects.toThrow(/introuvable|non modifiable/);
    expect(await queryAs(c, "delete from public.recipes where id = $1 returning id", [privee])).toHaveLength(0);
    expect(await queryAs(c, "update public.recipes set title = 'x' where id = $1 returning id", [privee])).toHaveLength(
      0,
    );
    await expect(
      queryAs(c, "insert into public.recipe_steps (recipe_id, position, instruction) values ($1, 99, 'x')", [privee]),
    ).rejects.toThrow();
  });

  it("une modification remplace ingrédients et étapes", async () => {
    await save(a, {
      ...baseRecipe("Soupe de carottes au cumin"),
      id: privee,
      ingredients: [{ name: "Cumin", quantity: 1, unit_code: "cc" }],
    });
    const ing = await queryAs(a, "select name from public.recipe_ingredients where recipe_id = $1", [privee]);
    expect(ing).toEqual([{ name: "Cumin" }]);
  });

  it("une modification concurrente est détectée", async () => {
    await expect(
      save(a, { ...baseRecipe("Conflit"), id: privee, expected_updated_at: "2000-01-01T00:00:00Z" }),
    ).rejects.toThrow(/modifiée entre-temps/);
  });

  it("les colonnes système ne sont pas modifiables", async () => {
    await expect(queryAs(a, "update public.recipes set owner_id = $2 where id = $1", [privee, b])).rejects.toThrow();
    await expect(
      queryAs(a, "update public.recipes set moderation_status = 'hidden' where id = $1", [privee]),
    ).rejects.toThrow();
    await queryAs(a, "update public.recipes set favorites_count = 999 where id = $1", [privee]);
    expect(
      (await one<{ n: number }>(a, "select favorites_count as n from public.recipes where id = $1", [privee])).n,
    ).toBe(0);
  });
});

describe("partage au foyer", () => {
  let foyer: string;

  beforeAll(async () => {
    foyer = await save(a, baseRecipe("Gratin du dimanche", { visibility: "household", household_id: foyerAB }));
  });

  it("les membres du foyer la voient, pas les autres", async () => {
    expect(await visibleIds(b)).toContain(foyer);
    expect(await visibleIds(c)).not.toContain(foyer);
  });

  it("un membre peut modifier le contenu mais pas le partage", async () => {
    await save(b, { ...baseRecipe("Gratin du dimanche (version B)"), id: foyer, visibility: "private" });
    const r = await one(a, "select title, visibility from public.recipes where id = $1", [foyer]);
    expect(r).toEqual({ title: "Gratin du dimanche (version B)", visibility: "household" });
    await expect(queryAs(b, "update public.recipes set visibility = 'private' where id = $1", [foyer])).rejects.toThrow(
      /auteur/,
    );
  });

  it("si l'auteur désactive la co-édition, le membre ne peut plus modifier", async () => {
    await save(a, {
      ...baseRecipe("Gratin du dimanche"),
      id: foyer,
      visibility: "household",
      household_id: foyerAB,
      household_can_edit: false,
    });
    await expect(save(b, { ...baseRecipe("x"), id: foyer })).rejects.toThrow();
  });

  it("seul l'auteur supprime", async () => {
    expect(await queryAs(b, "delete from public.recipes where id = $1 returning id", [foyer])).toHaveLength(0);
  });

  it("on ne peut pas partager dans un foyer dont on n'est pas membre", async () => {
    await expect(save(c, baseRecipe("Intrusion", { visibility: "household", household_id: foyerAB }))).rejects.toThrow(
      /Foyer invalide/,
    );
  });

  it("une catégorie d'un autre foyer ne peut pas être attachée", async () => {
    const catC = await one<{ id: string }>(
      c,
      "insert into public.categories (household_id, slug, name, created_by) values ($1, 'secret', 'Secret', $2) returning id",
      [foyerC, c],
    );
    const id = await save(a, baseRecipe("Catégories", { category_ids: [catC.id] }));
    // La catégorie invisible pour A est ignorée par la jointure (RLS) : aucun lien créé.
    expect(await queryAs(a, "select * from public.recipe_categories where recipe_id = $1", [id])).toHaveLength(0);
  });

  it("quitter le foyer rend ses recettes du foyer privées", async () => {
    const e = await createUser("Émile");
    const token = (await one<{ t: string }>(a, "select public.create_household_invitation($1) as t", [foyerAB])).t;
    await queryAs(e, "select public.accept_household_invitation($1)", [token]);
    const r = await save(e, baseRecipe("Recette d'Émile", { visibility: "household", household_id: foyerAB }));
    expect(await visibleIds(a)).toContain(r);
    await queryAs(e, "select public.leave_household($1)", [foyerAB]);
    expect(await visibleIds(a)).not.toContain(r);
    const after = await one(e, "select visibility, household_id from public.recipes where id = $1", [r]);
    expect(after).toEqual({ visibility: "private", household_id: null });
  });
});

describe("bibliothèque publique et copies", () => {
  let publique: string;

  it("publier exige de confirmer ses droits", async () => {
    await expect(save(a, baseRecipe("Tarte publique", { visibility: "public" }))).rejects.toThrow(/droit de publier/);
    publique = await save(a, baseRecipe("Tarte publique", { visibility: "public", rights_confirmed: true }));
    const r = await one<{ published_at: string | null }>(a, "select published_at from public.recipes where id = $1", [
      publique,
    ]);
    expect(r.published_at).not.toBeNull();
  });

  it("tout utilisateur connecté lit une recette publique et le pseudonyme de son auteur seulement", async () => {
    expect(await visibleIds(c)).toContain(publique);
    const names = await queryAs(c, "select * from public.get_display_names($1::uuid[])", [[a, b]]);
    expect(names).toEqual([{ id: a, display_name: "Alice" }]);
    // Le profil complet (préférences) reste privé.
    expect(await queryAs(c, "select * from public.profiles where id = $1", [a])).toHaveLength(0);
  });

  it("une copie est privée, attribuée et indépendante de l'original", async () => {
    const copie = (await one<{ id: string }>(c, "select public.copy_recipe($1) as id", [publique])).id;
    const r = await one(
      c,
      "select owner_id, visibility, origin, source_recipe_id, source_owner_id, attribution from public.recipes where id = $1",
      [copie],
    );
    expect(r).toEqual({
      owner_id: c,
      visibility: "private",
      origin: "copy",
      source_recipe_id: publique,
      source_owner_id: a,
      attribution: "D'après une recette partagée par Alice",
    });
    await save(c, { ...baseRecipe("Ma tarte modifiée"), id: copie, ingredients: [{ name: "Pommes", quantity: 6 }] });
    const original = await one(a, "select title from public.recipes where id = $1", [publique]);
    expect(original).toEqual({ title: "Tarte publique" });
    const ing = await queryAs(a, "select name from public.recipe_ingredients where recipe_id = $1 order by position", [
      publique,
    ]);
    expect(ing.map((x) => x.name)).toEqual(["Carottes", "Oignon", "Sel"]);
    const count = await one<{ n: number }>(a, "select copies_count as n from public.recipes where id = $1", [publique]);
    expect(count.n).toBe(1);
  });

  it("la copie d'une recette d'un autre auteur ne peut pas être republiée", async () => {
    const copie = (await one<{ id: string }>(c, "select public.copy_recipe($1) as id", [publique])).id;
    await expect(
      save(c, { ...baseRecipe("Plagiat"), id: copie, visibility: "public", rights_confirmed: true }),
    ).rejects.toThrow(/ne peut pas être publiée/);
  });

  it("on ne peut pas forger une fausse copie ni copier une recette invisible", async () => {
    const privee = await save(a, baseRecipe("Secret de famille"));
    await expect(queryAs(c, "select public.copy_recipe($1)", [privee])).rejects.toThrow(/introuvable/);
    await expect(
      queryAs(
        c,
        "insert into public.recipes (owner_id, title, origin, source_recipe_id, source_owner_id) values ($1, 'Faux', 'copy', $2, $1)",
        [c, privee],
      ),
    ).rejects.toThrow(/Copie invalide/);
  });

  it("favoris : uniquement sur une recette visible, compteur mis à jour", async () => {
    await queryAs(c, "insert into public.favorites (user_id, recipe_id) values ($1, $2)", [c, publique]);
    const n = await one<{ n: number }>(a, "select favorites_count as n from public.recipes where id = $1", [publique]);
    expect(n.n).toBe(1);
    const privee = await save(a, baseRecipe("Invisible"));
    await expect(
      queryAs(c, "insert into public.favorites (user_id, recipe_id) values ($1, $2)", [c, privee]),
    ).rejects.toThrow();
    expect(await queryAs(a, "select * from public.favorites where user_id = $1", [c])).toHaveLength(0);
  });

  it("recherche publique par nom, ingrédient, durée et difficulté", async () => {
    const pub2 = await save(b, {
      ...baseRecipe("Curry de lentilles", { visibility: "public", rights_confirmed: true, diets: ["vegetarien"] }),
      ingredients: [{ name: "Lentilles corail", quantity: 200, unit_code: "g" }],
      prep_minutes: 10,
      cook_minutes: 50,
      difficulty: "medium",
    });
    const search = (args: string, params: unknown[]) =>
      queryAs<{ id: string }>(c, `select id from public.search_recipes(${args})`, params).then((r) =>
        r.map((x) => x.id),
      );
    expect(await search("'public', 'curry'", [])).toContain(pub2);
    expect(await search("'public', 'lentille'", [])).toContain(pub2);
    expect(await search("'public', 'lentille'", [])).not.toContain(publique);
    expect(await search("'public', p_max_minutes => 30", [])).not.toContain(pub2);
    expect(await search("'public', p_difficulty => 'medium'", [])).toEqual([pub2]);
    expect(await search("'public', p_diets => array['vegetarien']", [])).toEqual([pub2]);
    // Le périmètre « mes recettes » de C ne contient pas les recettes d'Alice.
    expect(await search("'mine', 'tarte'", [])).not.toContain(publique);
  });

  it("signalements : pas sur sa propre recette, masquage auto à 3 signalements, modération admin", async () => {
    await expect(
      queryAs(a, "insert into public.reports (reporter_id, recipe_id, reason) values ($1, $2, 'spam')", [a, publique]),
    ).rejects.toThrow();
    for (const u of [b, c, d]) {
      await queryAs(u, "insert into public.reports (reporter_id, recipe_id, reason) values ($1, $2, 'spam')", [
        u,
        publique,
      ]);
    }
    expect(await visibleIds(c)).not.toContain(publique);
    expect(await visibleIds(a)).toContain(publique); // l'auteur la voit toujours
    expect(await visibleIds(d)).toContain(publique); // l'admin aussi
    // un signaleur ne lit pas les autres signalements
    expect(await queryAs(c, "select * from public.reports where recipe_id = $1", [publique])).toHaveLength(1);
    await expect(queryAs(c, "select public.moderate_recipe($1, 'visible')", [publique])).rejects.toThrow(/modération/);
    await queryAs(d, "select public.moderate_recipe($1, 'visible', 'dismissed')", [publique]);
    expect(await visibleIds(c)).toContain(publique);
  });
});

describe("photos (stockage)", () => {
  let recette: string;

  beforeAll(async () => {
    recette = await save(a, baseRecipe("Photogénique"));
  });

  const upload = (user: string, path: string) =>
    queryAs(user, "insert into storage.objects (bucket_id, name, owner) values ('recipe-images', $1, $2)", [
      path,
      user,
    ]);

  it("l'auteur envoie une photo dans le dossier de sa recette", async () => {
    await upload(a, `${recette}/photo-1.webp`);
    await queryAs(a, "insert into public.recipe_images (recipe_id, storage_path) values ($1, $2)", [
      recette,
      `${recette}/photo-1.webp`,
    ]);
    expect(
      await queryAs(a, "select name from storage.objects where name = $1", [`${recette}/photo-1.webp`]),
    ).toHaveLength(1);
  });

  it("un autre utilisateur ne peut ni envoyer, ni lire, ni supprimer", async () => {
    await expect(upload(c, `${recette}/intrus.webp`)).rejects.toThrow();
    await expect(upload(c, `pas-un-uuid/intrus.webp`)).rejects.toThrow();
    expect(await queryAs(c, "select name from storage.objects where name like $1", [`${recette}/%`])).toHaveLength(0);
    // Comme l'API Storage, on autorise la requête DELETE ; la RLS doit quand même la filtrer.
    const deleted = await asUser(c, async (cl) => {
      await cl.query("select set_config('storage.allow_delete_query', 'true', true)");
      return (await cl.query("delete from storage.objects where name like $1 returning name", [`${recette}/%`])).rows;
    });
    expect(deleted).toHaveLength(0);
  });

  it("une image doit être rangée dans le dossier de sa recette", async () => {
    const autre = await save(a, baseRecipe("Autre"));
    await expect(
      queryAs(a, "insert into public.recipe_images (recipe_id, storage_path) values ($1, $2)", [
        autre,
        `${recette}/photo-1.webp`,
      ]),
    ).rejects.toThrow();
  });

  it("8 photos maximum", async () => {
    for (let i = 2; i <= 8; i++) {
      await queryAs(a, "insert into public.recipe_images (recipe_id, storage_path) values ($1, $2)", [
        recette,
        `${recette}/p${i}.webp`,
      ]);
    }
    await expect(
      queryAs(a, "insert into public.recipe_images (recipe_id, storage_path) values ($1, $2)", [
        recette,
        `${recette}/p9.webp`,
      ]),
    ).rejects.toThrow(/8 photos/);
  });
});

describe("notes personnelles", () => {
  it("une note n'est visible que par son auteur", async () => {
    const r = await save(a, baseRecipe("Notée", { visibility: "household", household_id: foyerAB }));
    await queryAs(b, "insert into public.recipe_notes (user_id, recipe_id, body) values ($1, $2, 'Moins de sel')", [
      b,
      r,
    ]);
    await queryAs(b, "insert into public.recipe_ratings (user_id, recipe_id, rating) values ($1, $2, 5)", [b, r]);
    expect(await queryAs(a, "select * from public.recipe_notes where recipe_id = $1", [r])).toHaveLength(0);
    expect(await queryAs(b, "select body from public.recipe_notes where recipe_id = $1", [r])).toEqual([
      { body: "Moins de sel" },
    ]);
    await expect(
      queryAs(c, "insert into public.recipe_notes (user_id, recipe_id, body) values ($1, $2, 'x')", [c, r]),
    ).rejects.toThrow();
  });
});
