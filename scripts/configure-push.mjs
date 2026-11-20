#!/usr/bin/env node
// Configura los avisos push (FCM) en el Supabase remoto, sin imprimir ningún secreto:
//   node scripts/configure-push.mjs
// 1) secretos de la función: PUSH_DISPATCH_SECRET (nuevo) y FIREBASE_SERVICE_ACCOUNT
// 2) el mismo PUSH_DISPATCH_SECRET en Vault (`nebula_push_secret`), que usa el trigger
// 3) despliega la función push-dispatch
// Requiere: ~/.config/nebula/firebase-service-account.json, SUPABASE_DB_URL en .env y `supabase login`.
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SA_PATH = process.env.NEBULA_FIREBASE_SA ?? join(homedir(), '.config/nebula/firebase-service-account.json');
const REF = process.env.NEBULA_SUPABASE_PROJECT_REF ?? 'oiioenwgphgrjpvqilnd';
const cli = join(root, 'node_modules/.bin/supabase');

const fail = (msg) => { console.error(`✗ ${msg}`); process.exit(1); };
const env = Object.fromEntries(readFileSync(join(root, '.env'), 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^["']|["']$/g, '')]));
if (!env.SUPABASE_DB_URL) fail('Falta SUPABASE_DB_URL en .env');

let sa;
try { sa = JSON.parse(readFileSync(SA_PATH, 'utf8')); } catch { fail(`No se pudo leer ${SA_PATH}`); }
if (!sa.project_id || !sa.client_email || !String(sa.private_key).includes('PRIVATE KEY')) fail('El JSON no parece una clave de cuenta de servicio de Firebase');
const secret = randomBytes(32).toString('hex');

// Los valores van como argumentos (sin shell) y la salida de la CLI no los repite.
const run = (args) => {
  const r = spawnSync(cli, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  if (r.status !== 0) fail(`supabase ${args[0]} ${args[1]} falló: ${(r.stderr || r.stdout).replaceAll(secret, '***').slice(0, 400)}`);
};

console.log(`▸ Secretos de la función (proyecto Firebase «${sa.project_id}»)`);
run(['secrets', 'set', '--project-ref', REF, `PUSH_DISPATCH_SECRET=${secret}`, `FIREBASE_SERVICE_ACCOUNT=${JSON.stringify(sa)}`]);

console.log('▸ Secreto del trigger en Vault');
const db = new pg.Client({ connectionString: env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
try {
  const url = await db.query(`select 1 from vault.secrets where name = 'nebula_project_url'`);
  if (url.rowCount === 0) await db.query(`select vault.create_secret($1, 'nebula_project_url')`, [`https://${REF}.supabase.co`]);
  const old = await db.query(`select id from vault.secrets where name = 'nebula_push_secret'`);
  if (old.rowCount) await db.query('select vault.update_secret($1, $2)', [old.rows[0].id, secret]);
  else await db.query(`select vault.create_secret($1, 'nebula_push_secret')`, [secret]);
} finally {
  await db.end();
}

console.log('▸ Despliegue de push-dispatch');
run(['functions', 'deploy', 'push-dispatch', '--project-ref', REF, '--no-verify-jwt']);
console.log('✓ Push configurado.');
