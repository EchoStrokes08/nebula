import { LIBRARY, type Intensity } from './library';
import { QUOTES } from './quotes';

/** Una frase de la sección Motivación: cita célebre, frase de Nebula o frase propia. */
export interface Phrase {
  /** Referencia guardada como frase principal: «cita:<id>», «frase:<id>» o «propia:<uuid>». */
  ref: string;
  kind: 'cita' | 'frase' | 'propia';
  text: string;
  author?: string;
  source?: string;
  intensity?: Intensity;
}

export interface OwnPhrase { id: string; text: string; author: string | null }

export const INTENSITY_LABEL: Record<Intensity, string> = { balanced: 'Equilibrado', demanding: 'Exigente', intense: 'Intenso' };

/** Citas célebres de un nivel de exigencia. */
export const quotePhrases = (intensity: Intensity): Phrase[] =>
  QUOTES.filter((x) => x.intensity === intensity).map((x) => ({ ref: `cita:${x.id}`, kind: 'cita', text: x.text, author: x.author, source: x.source, intensity: x.intensity }));

/** Frases originales de Nebula de un nivel (solo las que no dependen de datos del usuario). */
export const libraryPhrases = (intensity: Intensity): Phrase[] => {
  const seen = new Set<string>();
  return LIBRARY.filter((m) => m.intensity === intensity && !m.text.includes('{'))
    .filter((m) => (seen.has(m.text) ? false : (seen.add(m.text), true)))
    .map((m) => ({ ref: `frase:${m.id}`, kind: 'frase', text: m.text, intensity: m.intensity }));
};

export const ownPhrases = (own: OwnPhrase[]): Phrase[] =>
  own.map((p) => ({ ref: `propia:${p.id}`, kind: 'propia', text: p.text, author: p.author ?? undefined }));

/** Resuelve la frase principal guardada; null si ya no existe (p. ej. una propia borrada). */
export function resolvePhrase(ref: string | null | undefined, own: OwnPhrase[]): Phrase | null {
  if (!ref) return null;
  const [kind, id] = [ref.slice(0, ref.indexOf(':')), ref.slice(ref.indexOf(':') + 1)];
  if (kind === 'propia') return ownPhrases(own).find((p) => p.ref === ref) ?? null;
  if (kind === 'cita') {
    const x = QUOTES.find((c) => c.id === id);
    return x ? { ref, kind: 'cita', text: x.text, author: x.author, source: x.source, intensity: x.intensity } : null;
  }
  if (kind === 'frase') {
    const m = LIBRARY.find((l) => l.id === id && !l.text.includes('{'));
    return m ? { ref, kind: 'frase', text: m.text, intensity: m.intensity } : null;
  }
  return null;
}
