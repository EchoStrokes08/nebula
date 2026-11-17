import type { PGlite } from '@electric-sql/pglite';

import { asUser, createTestDb, createUser, expectFailure } from './harness';

let db: PGlite;
let ana: string;
let ben: string;
let cris: string;
let priv: string;

beforeAll(async () => {
  db = await createTestDb();
  ana = await createUser(db, { handle: 'ana', display_name: 'Ana' });
  ben = await createUser(db, { handle: 'ben', display_name: 'Ben' });
  cris = await createUser(db, { handle: 'cris', display_name: 'Cris' });
  await db.query(`update public.profiles set visibility = 'friends' where id in ($1, $2, $3)`, [ana, ben, cris]);
  priv = await createUser(db, { handle: 'privado', display_name: 'Privado' });
  await db.query(`update public.profiles set visibility = 'private' where id = $1`, [priv]);
});
afterAll(async () => {
  await db.close();
});

/** Ejecuta como usuario y confirma (para encadenar pasos entre usuarios). */
/** Primera fila (falla si no hay ninguna). */
async function one<T>(user: string, sql: string, params: unknown[] = []): Promise<T> {
  const rows = await as<T>(user, sql, params);
  if (!rows[0]) throw new Error('Sin filas');
  return rows[0];
}

async function as<T>(user: string, sql: string, params: unknown[] = []): Promise<T[]> {
  return db.transaction(async (tx) => {
    await tx.exec('set local role authenticated');
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [user]);
    return (await tx.query<T>(sql, params)).rows;
  });
}

describe('amistades (F08-001…006)', () => {
  it('búsqueda: sin email, respeta privacidad y bloqueos', async () => {
    const r = await as<{ handle: string }>(ana, `select * from public.search_profiles('b')`);
    expect(r).toHaveLength(0); // menos de 2 caracteres
    const found = await as<Record<string, unknown>>(ana, `select * from public.search_profiles('be')`);
    expect(found.map((x) => x.handle)).toEqual(['ben']);
    expect(Object.keys(found[0]!)).not.toContain('email');
    // Perfil privado: solo con el @usuario exacto
    expect(await as(ana, `select * from public.search_profiles('priv')`)).toHaveLength(0);
    expect(await as(ana, `select * from public.search_profiles('@privado')`)).toHaveLength(1);
  });

  it('solicitud → aceptación crea amistad y notifica', async () => {
    const { id } = await one<{ id: string }>(ana, `select public.send_friend_request($1) as id`, [ben]);
    await expect(as(ana, `select public.send_friend_request($1)`, [ben])).rejects.toThrow(/pendiente/);
    // Ana no puede aceptar su propia solicitud
    await expect(as(ana, `select public.respond_friend_request($1, true)`, [id])).rejects.toThrow(/no autorizado/);
    await as(ben, `select public.respond_friend_request($1, true)`, [id]);
    expect((await as<{ handle: string }>(ana, `select * from public.my_friends()`)).map((f) => f.handle)).toEqual(['ben']);
    const notes = await as<{ kind: string }>(ben, `select kind from public.notifications`);
    expect(notes.map((n) => n.kind)).toContain('friend_request');
    expect((await as<{ kind: string }>(ana, `select kind from public.notifications`)).map((n) => n.kind)).toContain('friend_accepted');
  });

  it('solicitud cruzada se acepta sola', async () => {
    await as(cris, `select public.send_friend_request($1)`, [ana]);
    await as(ana, `select public.send_friend_request($1)`, [cris]);
    expect((await as<{ handle: string }>(ana, `select handle from public.my_friends()`)).map((f) => f.handle).sort()).toEqual(['ben', 'cris']);
  });

  it('bloquear elimina la amistad e impide solicitudes y búsqueda', async () => {
    await as(ben, `select public.block_user($1)`, [ana]);
    expect(await as(ana, `select * from public.my_friends() where handle = 'ben'`)).toHaveLength(0);
    await expect(as(ana, `select public.send_friend_request($1)`, [ben])).rejects.toThrow(/no disponible/);
    expect(await as(ana, `select * from public.search_profiles('ben')`)).toHaveLength(0);
    await as(ben, `select public.unblock_user($1)`, [ana]);
  });

  it('no se puede escribir directamente en las tablas sociales ni leer lo ajeno', async () => {
    await asUser(db, cris, async (tx) => {
      await expectFailure(tx, `insert into public.friendships (user_a, user_b) values ($1, $2)`, [ana < ben ? ana : ben, ana < ben ? ben : ana], /permission denied/);
      await expectFailure(tx, `insert into public.notifications (user_id, kind, title) values ($1, 'spam', 'x')`, [ana], /permission denied/);
      expect((await tx.query(`select * from public.notifications where user_id = $1`, [ana])).rows).toHaveLength(0);
    });
    // Solo se puede marcar como leída, no reescribir el contenido
    await asUser(db, ana, async (tx) => {
      await tx.query(`update public.notifications set read_at = now()`);
      await expectFailure(tx, `update public.notifications set title = 'falso'`, [], /permission denied/);
    });
  });
});

describe('círculos (F08-008)', () => {
  it('solo se invita a amigos; roles y salida con traspaso de propiedad', async () => {
    const { id: circle } = await one<{ id: string }>(ana, `select public.create_circle('Estudio') as id`);
    await expect(as(ana, `select public.invite_to_circle($1, $2)`, [circle, priv])).rejects.toThrow(/amigos/);
    const { id: inv } = await one<{ id: string }>(ana, `select public.invite_to_circle($1, $2) as id`, [circle, cris]);
    // Antes de aceptar, Cris ve el círculo (para decidir) pero no a sus miembros
    expect(await as(cris, `select * from public.circles where id = $1`, [circle])).toHaveLength(1);
    expect(await as(cris, `select * from public.circle_members_of($1)`, [circle])).toHaveLength(0);
    await as(cris, `select public.respond_circle_invite($1, true)`, [inv]);
    expect(await as(cris, `select * from public.circle_members_of($1)`, [circle])).toHaveLength(2);
    await expect(as(cris, `select public.remove_circle_member($1, $2)`, [circle, ana])).rejects.toThrow(/no autorizado/);
    await as(ana, `select public.leave_circle($1)`, [circle]);
    const members = await as<{ handle: string; role: string }>(cris, `select handle, role from public.circle_members_of($1)`, [circle]);
    expect(members).toEqual([{ handle: 'cris', role: 'owner' }]);
  });
});
