import { randomUUID } from "node:crypto";
import pg from "pg";

/**
 * Tests de sécurité exécutés directement contre PostgreSQL.
 * - En CI : la base du Supabase local (`supabase start`).
 * - En local sans Docker : une base PostgreSQL nue + tests/db/local-shim.sql.
 * Chaque appel `asUser` simule une requête de l'API avec le jeton de l'utilisateur :
 * rôle `authenticated` + claims JWT, exactement comme PostgREST.
 */
export const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL ?? "postgresql://postgres@127.0.0.1:54329/goodsoup_test",
  max: 4,
});

const createdUsers: string[] = [];

export async function createUser(displayName = "Testeur"): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `insert into auth.users (id, email, raw_user_meta_data, aud, role)
     values ($1, $2, $3, 'authenticated', 'authenticated')`,
    [id, `test-${id}@example.test`, JSON.stringify({ display_name: displayName })],
  );
  createdUsers.push(id);
  return id;
}

export async function deleteUser(id: string) {
  await pool.query("delete from auth.users where id = $1", [id]);
}

export async function cleanupUsers() {
  if (createdUsers.length === 0) return;
  await pool.query("delete from auth.users where id = any($1::uuid[])", [createdUsers]);
  createdUsers.length = 0;
}

type Role = "authenticated" | "anon";

async function runAs<T>(role: Role, userId: string | null, fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const claims = userId ? { sub: userId, role } : { role };
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    await client.query(`set local role ${role}`);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export const asUser = <T>(userId: string, fn: (client: pg.PoolClient) => Promise<T>) =>
  runAs("authenticated", userId, fn);

export const asAnon = <T>(fn: (client: pg.PoolClient) => Promise<T>) => runAs("anon", null, fn);

/** Exécute une requête en tant qu'utilisateur et renvoie les lignes. */
export const queryAs = async <R extends pg.QueryResultRow = pg.QueryResultRow>(
  userId: string,
  sql: string,
  params: unknown[] = [],
) => asUser(userId, async (c) => (await c.query<R>(sql, params)).rows);
