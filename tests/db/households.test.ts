import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAnon, cleanupUsers, createUser, deleteUser, pool, queryAs } from "./helpers";

/**
 * A et B partagent un foyer ; C vit dans un autre foyer.
 */
let a: string, b: string, c: string;
let foyerAB: string, foyerC: string;

beforeAll(async () => {
  a = await createUser("Alice");
  b = await createUser("Bruno");
  c = await createUser("Chloé");

  foyerAB = (await queryAs<{ id: string }>(a, "select public.create_household('Chez A') as id"))[0].id;
  foyerC = (await queryAs<{ id: string }>(c, "select public.create_household('Chez C') as id"))[0].id;

  const token = (await queryAs<{ t: string }>(a, "select public.create_household_invitation($1) as t", [foyerAB]))[0].t;
  await queryAs(b, "select public.accept_household_invitation($1)", [token]);
});

afterAll(async () => {
  await cleanupUsers();
  await pool.end();
});

describe("profils", () => {
  it("un profil est créé à l'inscription avec le pseudonyme", async () => {
    const rows = await queryAs(a, "select display_name from public.profiles where id = $1", [a]);
    expect(rows).toEqual([{ display_name: "Alice" }]);
  });

  it("les membres d'un même foyer voient leur pseudonyme, pas les autres", async () => {
    const rows = await queryAs<{ id: string }>(a, "select id from public.profiles");
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(a);
    expect(ids).toContain(b);
    expect(ids).not.toContain(c);
  });

  it("on ne peut pas modifier le profil d'un autre", async () => {
    const rows = await queryAs(a, "update public.profiles set display_name = 'Pirate' where id = $1 returning id", [b]);
    expect(rows).toHaveLength(0);
  });

  it("on ne peut pas se déclarer administrateur", async () => {
    await expect(queryAs(a, "insert into public.app_admins (user_id) values ($1)", [a])).rejects.toThrow();
    const admin = await queryAs<{ v: boolean }>(a, "select public.is_app_admin() as v");
    expect(admin[0].v).toBe(false);
  });

  it("un visiteur anonyme ne lit aucun profil", async () => {
    await expect(asAnon((cl) => cl.query("select * from public.profiles"))).rejects.toThrow();
  });
});

describe("foyers", () => {
  it("le créateur est propriétaire, l'invité est membre", async () => {
    const rows = await queryAs<{ user_id: string; role: string }>(
      a,
      "select user_id, role from public.household_members where household_id = $1 order by joined_at",
      [foyerAB],
    );
    expect(rows).toEqual([
      { user_id: a, role: "owner" },
      { user_id: b, role: "member" },
    ]);
  });

  it("un utilisateur d'un autre foyer ne voit ni le foyer ni ses membres", async () => {
    expect(await queryAs(c, "select * from public.households where id = $1", [foyerAB])).toHaveLength(0);
    expect(await queryAs(c, "select * from public.household_members where household_id = $1", [foyerAB])).toHaveLength(
      0,
    );
  });

  it("on ne peut pas s'ajouter soi-même à un foyer sans invitation", async () => {
    await expect(
      queryAs(c, "insert into public.household_members (household_id, user_id) values ($1, $2)", [foyerAB, c]),
    ).rejects.toThrow();
  });

  it("seul le propriétaire peut inviter et voir les invitations", async () => {
    await expect(queryAs(b, "select public.create_household_invitation($1)", [foyerAB])).rejects.toThrow(
      /propriétaire/,
    );
    await expect(queryAs(c, "select public.create_household_invitation($1)", [foyerAB])).rejects.toThrow();
    expect(await queryAs(b, "select * from public.household_invitations")).toHaveLength(0);
    expect((await queryAs(a, "select * from public.household_invitations")).length).toBeGreaterThan(0);
  });

  it("le jeton n'est jamais stocké en clair", async () => {
    const token = (await queryAs<{ t: string }>(a, "select public.create_household_invitation($1) as t", [foyerAB]))[0]
      .t;
    const rows = await queryAs<{ token_hash: string }>(a, "select token_hash from public.household_invitations");
    expect(rows.some((r) => r.token_hash === token)).toBe(false);
  });

  it("une invitation révoquée ou inconnue est refusée", async () => {
    const token = (await queryAs<{ t: string }>(a, "select public.create_household_invitation($1) as t", [foyerAB]))[0]
      .t;
    const invId = (
      await pool.query<{ id: string }>(
        "select id from public.household_invitations where token_hash = encode(extensions.digest($1, 'sha256'), 'hex')",
        [token],
      )
    ).rows[0].id;
    await queryAs(a, "select public.revoke_household_invitation($1)", [invId]);
    await expect(queryAs(c, "select public.accept_household_invitation($1)", [token])).rejects.toThrow(
      /invalide ou expirée/,
    );
    await expect(queryAs(c, "select public.accept_household_invitation('faux')")).rejects.toThrow(
      /invalide ou expirée/,
    );
  });

  it("une invitation expirée est refusée", async () => {
    const token = (await queryAs<{ t: string }>(a, "select public.create_household_invitation($1) as t", [foyerAB]))[0]
      .t;
    await pool.query(
      "update public.household_invitations set expires_at = now() - interval '1 minute' where token_hash = encode(extensions.digest($1, 'sha256'), 'hex')",
      [token],
    );
    await expect(queryAs(c, "select public.accept_household_invitation($1)", [token])).rejects.toThrow(
      /invalide ou expirée/,
    );
  });

  it("l'aperçu d'invitation donne le nom du foyer", async () => {
    const token = (await queryAs<{ t: string }>(a, "select public.create_household_invitation($1) as t", [foyerAB]))[0]
      .t;
    const rows = await queryAs(c, "select * from public.get_invitation_preview($1)", [token]);
    expect(rows).toEqual([{ household_name: "Chez A", is_valid: true, already_member: false }]);
  });

  it("un membre ne peut pas renommer le foyer, le propriétaire si", async () => {
    expect(
      await queryAs(b, "update public.households set name = 'Hack' where id = $1 returning id", [foyerAB]),
    ).toHaveLength(0);
    expect(
      await queryAs(a, "update public.households set name = 'Chez A et B' where id = $1 returning id", [foyerAB]),
    ).toHaveLength(1);
  });

  it("un membre ne peut pas retirer le propriétaire", async () => {
    await expect(queryAs(b, "select public.remove_household_member($1, $2)", [foyerAB, a])).rejects.toThrow();
  });
});

describe("profils alimentaires", () => {
  it("visibles par le foyer uniquement", async () => {
    await queryAs(
      a,
      "insert into public.food_profiles (household_id, user_id, display_name, allergies) values ($1, $2, 'Alice', '{arachide}')",
      [foyerAB, a],
    );
    expect(await queryAs(b, "select allergies from public.food_profiles where household_id = $1", [foyerAB])).toEqual([
      { allergies: ["arachide"] },
    ]);
    expect(await queryAs(c, "select * from public.food_profiles where household_id = $1", [foyerAB])).toHaveLength(0);
  });

  it("impossible d'écrire dans le foyer d'un autre ou au nom d'un autre utilisateur", async () => {
    await expect(
      queryAs(c, "insert into public.food_profiles (household_id, display_name) values ($1, 'Intrus')", [foyerAB]),
    ).rejects.toThrow();
    await expect(
      queryAs(b, "insert into public.food_profiles (household_id, user_id, display_name) values ($1, $2, 'X')", [
        foyerAB,
        c,
      ]),
    ).rejects.toThrow();
  });

  it("profil d'une personne sans compte (enfant) possible", async () => {
    const rows = await queryAs(
      b,
      "insert into public.food_profiles (household_id, display_name, portion_factor) values ($1, 'Léo', 0.5) returning display_name",
      [foyerAB],
    );
    expect(rows).toEqual([{ display_name: "Léo" }]);
  });
});

describe("départs et suppression de compte", () => {
  it("quand le propriétaire part, le membre le plus ancien devient propriétaire", async () => {
    const x = await createUser("X");
    const y = await createUser("Y");
    const h = (await queryAs<{ id: string }>(x, "select public.create_household('Temp') as id"))[0].id;
    const t = (await queryAs<{ t: string }>(x, "select public.create_household_invitation($1) as t", [h]))[0].t;
    await queryAs(y, "select public.accept_household_invitation($1)", [t]);

    await queryAs(x, "select public.leave_household($1)", [h]);
    expect(await queryAs(y, "select user_id, role from public.household_members where household_id = $1", [h])).toEqual(
      [{ user_id: y, role: "owner" }],
    );

    // Le dernier membre supprime son compte : le foyer disparaît.
    await deleteUser(y);
    expect((await pool.query("select 1 from public.households where id = $1", [h])).rowCount).toBe(0);
  });

  it("le foyer de C est intact", async () => {
    expect(await queryAs(c, "select name from public.households where id = $1", [foyerC])).toEqual([
      { name: "Chez C" },
    ]);
  });
});
