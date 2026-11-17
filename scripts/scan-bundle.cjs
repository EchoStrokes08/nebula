// Busca secretos en el build web (base de Android web y del escritorio). Uso: node scripts/scan-bundle.cjs [carpeta]
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(process.argv[2] || 'dist');
const PATTERNS = [
  [/gsk_[A-Za-z0-9]{20,}/, 'clave de Groq'],
  [/sk-[A-Za-z0-9]{32,}/, 'clave de API tipo sk-'],
  [/postgres(?:ql)?:\/\/[^\s"']+:[^\s"'@]+@/, 'cadena de conexión de Postgres con contraseña'],
  [/AI_API_KEY|SUPABASE_DB_URL|SUPABASE_ACCESS_TOKEN/, 'nombre de variable de servidor'],
];
if (!fs.existsSync(root)) { console.error(`No existe ${root}`); process.exit(1); }
const hits = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(js|html|json|map)$/.test(e.name)) {
      const text = fs.readFileSync(p, 'utf8');
      for (const [re, what] of PATTERNS) if (re.test(text)) hits.push(`${path.relative(root, p)}: ${what}`);
      // JWT de Supabase: la clave pública (anon) es aceptable; una con rol service_role, no.
      for (const jwt of text.match(/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g) ?? []) {
        try { if (JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()).role === 'service_role') hits.push(`${path.relative(root, p)}: JWT con rol service_role`); } catch { /* no es JSON */ }
      }
      if (/sb_secret_[A-Za-z0-9_-]{10,}/.test(text)) hits.push(`${path.relative(root, p)}: clave secreta de Supabase (sb_secret_)`);
    }
  }
})(root);
if (hits.length) { console.error(`Posibles secretos en el bundle:\n${hits.join('\n')}`); process.exit(1); }
console.log(`Sin secretos en ${path.relative(process.cwd(), root) || root}.`);
