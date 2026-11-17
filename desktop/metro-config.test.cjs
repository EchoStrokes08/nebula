// Regresión: el bundle de desarrollo no debe resolver secretos de servidor ni código Deno.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

test('Metro bloquea .env.server.local y supabase/', () => {
  const config = require('../metro.config.js');
  const list = [].concat(config.resolver.blockList);
  const blocked = (p) => list.some((re) => re.test(p));
  const root = path.resolve(__dirname, '..');
  assert.ok(blocked(path.join(root, '.env.server.local')));
  assert.ok(blocked(path.join(root, 'supabase', 'functions', 'ai-assist', 'index.ts')));
  assert.ok(!blocked(path.join(root, 'src', 'app', '_layout.tsx')));
  assert.ok(!blocked(path.join(root, '.env')));
});
