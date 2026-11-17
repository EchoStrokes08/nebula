/// <reference types="node" />
// Los tipos de Node solo se cargan en las pruebas de BD, no en el código de la app.
/**
 * Arnés de pruebas de base de datos (ADR-005).
 * Ejecuta las migraciones reales en PGlite sobre un esquema `auth` mínimo compatible con
 * Supabase (`auth.users`, `auth.uid()`) y los roles `anon`, `authenticated` y `service_role`.
 */
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS = join(__dirname, '..', 'migrations');

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    raw_user_meta_data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    try {
      await db.exec(readFileSync(join(MIGRATIONS, file), 'utf8'));
    } catch (e) {
      throw new Error(`Error aplicando ${file}: ${(e as Error).message}`);
    }
  }
  return db;
}

/** Crea un usuario en auth.users (como hace Supabase Auth) y devuelve su id. */
export async function createUser(db: PGlite, meta: Record<string, unknown> = {}): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    'insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id',
    [`${Math.random().toString(36).slice(2)}@example.test`, JSON.stringify(meta)],
  );
  return rows[0]!.id;
}

/**
 * Ejecuta `fn` como un usuario autenticado (RLS activo) dentro de una transacción
 * que se revierte al final, para que cada comprobación quede aislada.
 */
export async function asUser<T>(db: PGlite, userId: string | null, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(userId ? 'set local role authenticated' : 'set local role anon');
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId ?? '']);
    const result = await fn(tx);
    await tx.rollback(); // aislamiento: nada de lo hecho como usuario persiste entre comprobaciones
    return result;
  });
}

type Tx = Parameters<Parameters<PGlite['transaction']>[0]>[0];

/** Ejecuta una sentencia que debe fallar sin abortar la transacción en curso. */
export async function expectFailure(tx: Tx, sql: string, params: unknown[], pattern: RegExp): Promise<void> {
  await tx.query('savepoint expect_failure');
  let error: unknown = null;
  try {
    await tx.query(sql, params);
  } catch (e) {
    error = e;
  }
  await tx.query('rollback to savepoint expect_failure');
  if (!error) throw new Error(`Se esperaba un error ${pattern} y la sentencia tuvo éxito`);
  if (!pattern.test(String((error as Error).message))) throw error;
}
