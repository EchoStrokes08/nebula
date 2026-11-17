import type { PGlite } from '@electric-sql/pglite';

import { asUser, createTestDb, createUser } from './harness';

let db: PGlite;
beforeAll(async () => {
  db = await createTestDb();
});
afterAll(async () => {
  await db.close();
});

describe('perfiles y preferencias (F01-009)', () => {
  it('el alta crea perfil y preferencias con el handle solicitado', async () => {
    const id = await createUser(db, { handle: 'Camila_R', display_name: 'Camila', timezone: 'America/Bogota' });
    const { rows } = await db.query<{ handle: string; display_name: string; timezone: string }>(
      'select handle, display_name, timezone from public.profiles where id = $1',
      [id],
    );
    expect(rows[0]).toEqual({ handle: 'camila_r', display_name: 'Camila', timezone: 'America/Bogota' });
    const prefs = await db.query('select 1 from public.user_preferences where user_id = $1', [id]);
    expect(prefs.rows).toHaveLength(1);
  });

  it('genera un handle válido si el solicitado está ocupado o es inválido', async () => {
    await createUser(db, { handle: 'andres' });
    const dup = await createUser(db, { handle: 'andres' });
    const bad = await createUser(db, { handle: 'x!' });
    const { rows } = await db.query<{ handle: string }>('select handle from public.profiles where id in ($1, $2)', [dup, bad]);
    for (const r of rows) expect(r.handle).toMatch(/^usuario_[a-f0-9]{8}$/);
  });

  it('un usuario no puede leer ni modificar el perfil o las preferencias de otro', async () => {
    const a = await createUser(db, { handle: 'usuario_a' });
    const b = await createUser(db, { handle: 'usuario_b' });
    await asUser(db, a, async (tx) => {
      const own = await tx.query('select id from public.profiles');
      expect(own.rows).toEqual([{ id: a }]);
      const other = await tx.query('select * from public.user_preferences where user_id = $1', [b]);
      expect(other.rows).toHaveLength(0);
      const upd = await tx.query(`update public.profiles set display_name = 'hack' where id = $1`, [b]);
      expect(upd.affectedRows).toBe(0);
    });
    const { rows } = await db.query<{ display_name: string }>('select display_name from public.profiles where id = $1', [b]);
    expect(rows[0]!.display_name).not.toBe('hack');
  });

  it('un usuario puede editar su propio perfil, respetando las restricciones', async () => {
    const a = await createUser(db, { handle: 'editora' });
    await asUser(db, a, async (tx) => {
      const ok = await tx.query(`update public.profiles set display_name = 'Laura' where id = $1`, [a]);
      expect(ok.affectedRows).toBe(1);
    });
    await expect(
      asUser(db, a, (tx) => tx.query(`update public.profiles set handle = 'NO VALIDO' where id = $1`, [a])),
    ).rejects.toThrow(/profiles_handle_format/);
  });

  it('nadie puede insertar perfiles directamente ni leer como anónimo', async () => {
    const a = await createUser(db);
    await expect(
      asUser(db, a, (tx) =>
        tx.query(`insert into public.profiles (id, handle, display_name) values (gen_random_uuid(), 'intruso', 'x')`),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(asUser(db, null, (tx) => tx.query('select * from public.profiles'))).rejects.toThrow(/permission denied/);
  });

  it('borrar el usuario de Auth elimina perfil y preferencias en cascada', async () => {
    const a = await createUser(db, { handle: 'temporal' });
    await db.query('delete from auth.users where id = $1', [a]);
    const p = await db.query('select 1 from public.profiles where id = $1', [a]);
    const q = await db.query('select 1 from public.user_preferences where user_id = $1', [a]);
    expect(p.rows.length + q.rows.length).toBe(0);
  });
});

describe('disponibilidad de @usuario (F03-009)', () => {
  it('informa sin dar acceso a los perfiles', async () => {
    await createUser(db, { handle: 'ocupado' });
    await asUser(db, null, async (tx) => {
      const q = async (h: string) =>
        (await tx.query<{ ok: boolean }>('select public.is_handle_available($1) as ok', [h])).rows[0]!.ok;
      expect(await q('ocupado')).toBe(false);
      expect(await q('OCUPADO')).toBe(false);
      expect(await q('libre_123')).toBe(true);
      expect(await q('no valido')).toBe(false);
    });
  });
});

describe('alta con Google (F03-005)', () => {
  it('usa el nombre de Google y genera un @usuario provisional', async () => {
    const id = await createUser(db, { full_name: 'Laura Gómez', name: 'Laura Gómez', avatar_url: 'https://x/y.png', email_verified: true });
    const { rows } = await db.query<{ handle: string; display_name: string }>('select handle, display_name from public.profiles where id = $1', [id]);
    expect(rows[0]!.display_name).toBe('Laura Gómez');
    expect(rows[0]!.handle).toMatch(/^usuario_[a-f0-9]{8}$/);
  });
});
