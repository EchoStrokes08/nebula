import { libraryPhrases, quotePhrases, resolvePhrase } from './catalog';
import { QUOTES } from './quotes';

describe('catálogo de frases de Motivación', () => {
  it('hay citas célebres con autor en los tres niveles, con ids únicos', () => {
    for (const level of ['balanced', 'demanding', 'intense'] as const) {
      const list = quotePhrases(level);
      expect(list.length).toBeGreaterThanOrEqual(5);
      expect(list.every((p) => p.author && p.intensity === level)).toBe(true);
    }
    expect(new Set(QUOTES.map((x) => x.id)).size).toBe(QUOTES.length);
  });
  it('las frases de Nebula no llevan variables sin rellenar ni se repiten', () => {
    const list = libraryPhrases('demanding');
    expect(list.length).toBeGreaterThan(10);
    expect(list.some((p) => p.text.includes('{'))).toBe(false);
    expect(new Set(list.map((p) => p.text)).size).toBe(list.length);
  });
  it('resuelve la frase principal y descarta referencias que ya no existen', () => {
    const cita = quotePhrases('balanced')[0]!;
    expect(resolvePhrase(cita.ref, [])).toMatchObject({ text: cita.text, author: cita.author });
    const own = [{ id: 'abc', text: 'Hecho es mejor que perfecto', author: null }];
    expect(resolvePhrase('propia:abc', own)).toMatchObject({ kind: 'propia', text: 'Hecho es mejor que perfecto' });
    expect(resolvePhrase('propia:zzz', own)).toBeNull();
    expect(resolvePhrase('frase:no-existe', [])).toBeNull();
    expect(resolvePhrase(null, [])).toBeNull();
  });
  it('las referencias cumplen el formato que admite la base de datos', () => {
    const refs = [...quotePhrases('intense'), ...libraryPhrases('balanced'), ...libraryPhrases('intense')].map((p) => p.ref);
    expect(refs.every((r) => /^(cita|frase|propia):[A-Za-z0-9_-]{1,64}$/.test(r))).toBe(true);
  });
});
