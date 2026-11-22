const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fingerprint, embedArgs } = require('./expo-embed.cjs');
const { useEmbedWrapper } = require('../plugins/withFastBundle.js');

test('conserva la caché de Metro solo si no cambió la configuración', () => {
  const args = ['export:embed', '--platform', 'android', '--reset-cache', '--minify', 'false'];
  assert.deepEqual(embedArgs(args, 'a', 'a'), ['export:embed', '--platform', 'android', '--minify', 'false']);
  assert.deepEqual(embedArgs(args, 'a', 'b'), args);
  assert.deepEqual(embedArgs(args, 'a', null), args);
});

test('la huella cambia con .env y con las variables EXPO_*', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nebula-embed-'));
  try {
    fs.writeFileSync(path.join(dir, '.env'), 'EXPO_PUBLIC_SUPABASE_URL=https://a.supabase.co\n');
    const base = fingerprint(dir, {});
    assert.equal(fingerprint(dir, { HOME: '/x' }), base);
    assert.notEqual(fingerprint(dir, { EXPO_PUBLIC_X: '1' }), base);
    fs.writeFileSync(path.join(dir, '.env'), 'EXPO_PUBLIC_SUPABASE_URL=https://b.supabase.co\n');
    assert.notEqual(fingerprint(dir, {}), base);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('el plugin cambia la CLI de empaquetado por el envoltorio', () => {
  const gradle = 'react {\n    cliFile = new File(["node", "--print", "require.resolve(\'@expo/cli\', { paths: [require.resolve(\'expo/package.json\')] })"].execute(null, rootDir).text.trim())\n}\n';
  const out = useEmbedWrapper(gradle);
  assert.match(out, /^ {4}cliFile = new File\(projectRoot, "scripts\/expo-embed.cjs"\)$/m);
  assert.match(out, /^ {4}hermesFlags = \["-O"\]$/m);
  assert.equal(useEmbedWrapper(out), out);
  assert.throws(() => useEmbedWrapper('react {}'), /cliFile/);
});
