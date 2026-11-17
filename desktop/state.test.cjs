const { test } = require('node:test');
const assert = require('node:assert/strict');
const { safeBounds } = require('./state.cjs');
test('recupera el tamaño y descarta posiciones de monitores desconectados', () => {
  assert.deepEqual(safeBounds({ x: 4000, y: 100, width: 900, height: 700 }, [{ x: 0, y: 0, width: 1920, height: 1080 }]), { width: 900, height: 700 });
  assert.deepEqual(safeBounds({ x: 50, y: 50, width: 900, height: 700 }, [{ x: 0, y: 0, width: 1920, height: 1080 }]), { x: 50, y: 50, width: 900, height: 700 });
});
test('limita dimensiones corruptas', () => { assert.deepEqual(safeBounds({ width: -1, height: 9000 }, []), { width: 400, height: 2160 }); });
