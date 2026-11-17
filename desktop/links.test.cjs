const test = require('node:test');
const assert = require('node:assert');
const { deepLinkToRoute, findDeepLink, autostartEntry, normalizeShortcut } = require('./links.cjs');

test('enlaces nebula:// permitidos', () => {
  assert.strictEqual(deepLinkToRoute('nebula://captura'), '/captura');
  assert.strictEqual(deepLinkToRoute('nebula://auth/callback?code=abc&next=recovery'), '/auth/callback?code=abc&next=recovery');
  assert.strictEqual(deepLinkToRoute('nebula:///enfoque'), '/enfoque');
  assert.strictEqual(deepLinkToRoute('nebula://reto/123e4567-e89b-12d3-a456-426614174000'), '/reto/123e4567-e89b-12d3-a456-426614174000');
});
test('rechaza enlaces ajenos o rutas no previstas', () => {
  assert.strictEqual(deepLinkToRoute('https://evil.example/captura'), null);
  assert.strictEqual(deepLinkToRoute('nebula://../../etc/passwd'), null);
  assert.strictEqual(deepLinkToRoute('nebula://configuracion'), null);
  assert.strictEqual(deepLinkToRoute('no es url'), null);
});
test('encuentra el enlace en argv', () => {
  assert.strictEqual(findDeepLink(['/opt/Nebula', '--flag', 'nebula://hoy']), 'nebula://hoy');
  assert.strictEqual(findDeepLink(['/opt/Nebula']), null);
});
test('entrada de autoinicio con ruta entrecomillada', () => {
  const e = autostartEntry('/home/u/Apps/Nebula "beta".AppImage');
  assert.match(e, /^\[Desktop Entry\]/);
  assert.match(e, /Exec="\/home\/u\/Apps\/Nebula \\"beta\\".AppImage" --hidden/);
});
test('valida atajos globales', () => {
  assert.strictEqual(normalizeShortcut(undefined), 'CommandOrControl+Alt+N');
  assert.strictEqual(normalizeShortcut(''), '');
  assert.throws(() => normalizeShortcut('rm -rf'));
});
test('rutas de notificación permitidas', () => {
  const { isAllowedRoute } = require('./links.cjs');
  assert.ok(isAllowedRoute('/revision'));
  assert.ok(isAllowedRoute('/tarea/123e4567-e89b-12d3-a456-426614174000'));
  assert.ok(!isAllowedRoute('/configuracion'));
  assert.ok(!isAllowedRoute('javascript:alert(1)'));
});
