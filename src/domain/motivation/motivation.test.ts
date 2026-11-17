import { allowedIntensities, categoriesFor, chooseMessage } from './engine';
import { FORBIDDEN, LIBRARY, type Category } from './library';

const CATEGORIES: Category[] = ['inicio', 'enfoque', 'disciplina', 'procrastinacion', 'habitos', 'metas', 'competencia', 'colaboracion', 'recuperacion', 'resultados', 'constancia', 'cierre'];

describe('biblioteca de mensajes (F09-001)', () => {
  it('tiene al menos 80 mensajes, ids únicos y las 12 categorías con las 3 intensidades', () => {
    expect(LIBRARY.length).toBeGreaterThanOrEqual(80);
    expect(new Set(LIBRARY.map((m) => m.id)).size).toBe(LIBRARY.length);
    for (const c of CATEGORIES) {
      for (const i of ['balanced', 'demanding', 'intense'] as const) {
        expect(LIBRARY.some((m) => m.category === c && m.intensity === i)).toBe(true);
      }
    }
  });

  it('cumple las reglas editoriales: sin insultos ni vergüenza, sin textos repetidos', () => {
    for (const msg of LIBRARY) {
      const t = msg.text.toLowerCase();
      for (const w of FORBIDDEN) expect(t).not.toContain(w);
      expect(msg.text.length).toBeLessThanOrEqual(140);
    }
    expect(new Set(LIBRARY.map((m) => m.text)).size).toBe(LIBRARY.length);
  });
});

describe('motor contextual (F09-002)', () => {
  const base = { intensity: 'demanding' as const, moment: 'inicio' as const, hour: 9 };

  it('nunca supera la intensidad elegida', () => {
    expect(allowedIntensities('balanced')).toEqual(['balanced']);
    for (let seed = 0; seed < 30; seed++) {
      const c = chooseMessage({ ...base, intensity: 'balanced' }, seed)!;
      expect(LIBRARY.find((m) => m.id === c.id)!.intensity).toBe('balanced');
    }
  });

  it('no inventa datos: sin contexto no usa mensajes con variables', () => {
    for (let seed = 0; seed < 30; seed++) expect(chooseMessage(base, seed)!.text).not.toMatch(/\{|\}/);
  });

  it('elige por acontecimientos reales y rellena con datos verdaderos', () => {
    const ctx = { ...base, tareaAplazada: { titulo: 'Informe', aplazamientos: 4 } };
    expect(categoriesFor(ctx)[0]).toBe('procrastinacion');
    const texts = new Set(Array.from({ length: 10 }, (_, s) => chooseMessage(ctx, s)!.text));
    expect([...texts].some((t) => t.includes('Informe') || t.includes('4'))).toBe(true);
    const rec = chooseMessage({ ...base, intensity: 'balanced', recuperacion: { habito: 'inglés', dias: 4, minimo: '10 minutos' } }, 2)!;
    expect(rec.category).toBe('recuperacion');
  });

  it('evita repetir los mensajes recientes', () => {
    const first = chooseMessage(base, 0)!;
    const second = chooseMessage({ ...base, recent: [first.id] }, 0)!;
    expect(second.id).not.toBe(first.id);
  });

  it('antes de una sesión de enfoque habla de empezar', () => {
    expect(chooseMessage({ ...base, moment: 'enfoque' }, 1)!.category).toBe('enfoque');
  });
});
