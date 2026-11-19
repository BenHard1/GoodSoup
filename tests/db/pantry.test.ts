import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAnon, cleanupUsers, createUser, deleteUser, pool, queryAs } from "./helpers";

/**
 * Frigo : A et B partagent un foyer ; C vit dans un autre foyer.
 */
let a: string, b: string, c: string;
let foyerAB: string, foyerC: string;
let item: string;

const insertItem = (user: string, household: string, name = "Yaourts", addedBy = user) =>
  queryAs<{ id: string }>(
    user,
    `insert into public.pantry_items (household_id, name, quantity, expires_on, added_by)
     values ($1, $2, '4 pots', current_date + 2, $3) returning id`,
    [household, name, addedBy],
  );

beforeAll(async () => {
  a = await createUser("Alice");
  b = await createUser("Bruno");
  c = await createUser("Chloé");
  foyerAB = (await queryAs<{ id: string }>(a, "select public.create_household('Chez A') as id"))[0].id;
  foyerC = (await queryAs<{ id: string }>(c, "select public.create_household('Chez C') as id"))[0].id;
  const token = (await queryAs<{ t: string }>(a, "select public.create_household_invitation($1) as t", [foyerAB]))[0].t;
  await queryAs(b, "select public.accept_household_invitation($1)", [token]);
  item = (await insertItem(a, foyerAB))[0].id;
});

afterAll(async () => {
  await cleanupUsers();
  await pool.end();
});

describe("frigo", () => {
  it("les membres du foyer voient le produit, les autres non", async () => {
    expect(await queryAs(b, "select id from public.pantry_items where id = $1", [item])).toHaveLength(1);
    expect(await queryAs(c, "select id from public.pantry_items where id = $1", [item])).toHaveLength(0);
  });

  it("un membre modifie et retire un produit ajouté par un autre", async () => {
    const updated = await queryAs(b, "update public.pantry_items set quantity = '2 pots' where id = $1 returning id", [
      item,
    ]);
    expect(updated).toHaveLength(1);
    const extra = (await insertItem(a, foyerAB, "Beurre"))[0].id;
    expect(await queryAs(b, "delete from public.pantry_items where id = $1 returning id", [extra])).toHaveLength(1);
  });

  it("un autre foyer ne peut ni modifier ni supprimer", async () => {
    expect(
      await queryAs(c, "update public.pantry_items set name = 'Pirate' where id = $1 returning id", [item]),
    ).toHaveLength(0);
    expect(await queryAs(c, "delete from public.pantry_items where id = $1 returning id", [item])).toHaveLength(0);
  });

  it("on ne peut pas ajouter dans le frigo d'un autre foyer ni au nom d'un autre", async () => {
    await expect(insertItem(c, foyerAB)).rejects.toThrow();
    await expect(insertItem(a, foyerAB, "Lait", b)).rejects.toThrow();
  });

  it("on ne peut pas déplacer un produit vers un autre foyer", async () => {
    await expect(
      queryAs(a, "update public.pantry_items set household_id = $2 where id = $1", [item, foyerC]),
    ).rejects.toThrow();
  });

  it("le code-barres doit être numérique", async () => {
    await expect(
      queryAs(
        a,
        "insert into public.pantry_items (household_id, name, barcode, added_by) values ($1, 'X', 'abc', $2)",
        [foyerAB, a],
      ),
    ).rejects.toThrow();
  });

  it("le produit reste dans le foyer quand son auteur supprime son compte", async () => {
    const extra = (await insertItem(b, foyerAB, "Fromage"))[0].id;
    await deleteUser(b);
    const rows = await queryAs<{ added_by: string | null }>(
      a,
      "select added_by from public.pantry_items where id = $1",
      [extra],
    );
    expect(rows).toEqual([{ added_by: null }]);
  });

  it("un visiteur anonyme ne lit rien", async () => {
    await expect(asAnon((cl) => cl.query("select * from public.pantry_items"))).rejects.toThrow();
  });
});
