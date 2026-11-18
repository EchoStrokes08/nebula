const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { isNewer, parseUpdateInfo, isAllowedDownload, looksLikeAppImage } = require('./update.cjs');

test('compara versiones X.Y.Z numéricamente', () => {
  assert.equal(isNewer('1.2.0', '1.1.1'), true);
  assert.equal(isNewer('1.10.0', '1.9.9'), true);
  assert.equal(isNewer('1.1.1', '1.1.1'), false);
  assert.equal(isNewer('1.0.9', '1.1.0'), false);
});

test('valida version.json y solo acepta descargas del repositorio', () => {
  const linux = 'https://github.com/EchoStrokes08/nebula/releases/latest/download/Nebula-linux-x86_64.AppImage';
  const windows = 'https://echostrokes08.github.io/nebula/Nebula-Setup.exe';
  assert.deepEqual(parseUpdateInfo({ version: '1.2.0', notes: 'Planes', linux }), { version: '1.2.0', notes: 'Planes', linux, windows: null });
  assert.equal(parseUpdateInfo({ version: '1.2.0', linux, windows }).windows, windows);
  assert.equal(parseUpdateInfo({ version: '1.2.0', windows: 'https://evil.example.com/Setup.exe' }).windows, null);
  assert.equal(parseUpdateInfo({ version: 'latest' }), null);
  assert.equal(parseUpdateInfo(null), null);
  assert.equal(parseUpdateInfo({ version: '1.2.0', linux: 'https://evil.example.com/x.AppImage' }).linux, null);
  assert.equal(isAllowedDownload('https://github.com/EchoStrokes08/nebula/releases/../../otro/x'), false);
  assert.equal(isAllowedDownload('https://github.com/otro/nebula/releases/x'), false);
});

test('reconoce la cabecera de un AppImage', () => {
  const ok = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0, 0x41, 0x49, 0x02]);
  assert.equal(looksLikeAppImage(ok), true);
  assert.equal(looksLikeAppImage(Buffer.from('<html>Not Found</html>')), false);
  const installed = `${process.env.HOME}/.local/opt/nebula/Nebula.AppImage`;
  if (fs.existsSync(installed)) {
    const fd = fs.openSync(installed, 'r'); const head = Buffer.alloc(16); fs.readSync(fd, head, 0, 16, 0); fs.closeSync(fd);
    assert.equal(looksLikeAppImage(head), true);
  }
});
