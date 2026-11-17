import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from './harness';
let db: PGlite;
beforeAll(async () => { db = await createTestDb(); });
afterAll(async () => { await db.close(); });
it('todas las tablas públicas tienen RLS', async () => {
  const rows = (await db.query<{ relname: string }>("select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity")).rows;
  expect(rows).toEqual([]);
});
it('solo la consulta de disponibilidad de handle es accesible antes del registro', async () => {
  const rows = (await db.query("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and p.proname <> 'is_handle_available' and has_function_privilege('anon',p.oid,'EXECUTE')")).rows;
  expect(rows).toEqual([]);
});
it('las funciones privilegiadas fijan search_path y los motores internos siguen cerrados', async () => {
  expect((await db.query("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and not coalesce(p.proconfig::text like '%search_path%',false)")).rows).toEqual([]);
  expect((await db.query<{ allowed: boolean }>("select has_function_privilege('authenticated','public.challenge_refresh(uuid,timestamptz)','EXECUTE') as allowed")).rows[0]?.allowed).toBe(false);
});
