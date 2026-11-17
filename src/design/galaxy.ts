/**
 * Galaxia espiral determinista para el fondo. Las coordenadas son relativas al centro de la
 * galaxia, en unidades de su radio (-1..1), antes de inclinarla y rotarla al dibujar.
 */
import { palette } from '@/design/tokens';

export interface GalaxyStar {
  x: number;
  y: number;
  r: number; // radio relativo (se multiplica por la escala de dibujo)
  o: number; // opacidad
  c: string; // color
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Normal aproximada (suma de uniformes) para dispersar las estrellas alrededor de los brazos. */
const gauss = (rand: () => number) => (rand() + rand() + rand() - 1.5) / 1.5;

const STAR_COLORS = [palette.white, palette.lavender300, '#FFE7C2', palette.cyan400, '#F3B6E6'];

export function generateGalaxy(count: number, { arms = 3, twist = 3.4, seed = 21 } = {}) {
  const rand = mulberry32(seed);
  const stars: GalaxyStar[] = [];
  const dust: GalaxyStar[] = [];
  for (let i = 0; i < count; i++) {
    // Más densidad cerca del núcleo.
    const d = Math.pow(rand(), 0.75);
    const arm = i % arms;
    const spread = 0.05 + d * 0.16;
    const angle = (arm / arms) * Math.PI * 2 + d * twist + gauss(rand) * spread * 2.2;
    const radius = d + gauss(rand) * spread * 0.5;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    const bright = rand() > 0.93;
    // Núcleo cálido, brazos fríos: sigue la coloración de las galaxias reales.
    const c = d < 0.22 ? (rand() > 0.5 ? '#FFE7C2' : palette.white) : STAR_COLORS[Math.floor(rand() * STAR_COLORS.length)]!;
    stars.push({ x, y, r: bright ? 1.3 + rand() * 0.9 : 0.35 + rand() * 0.6, o: bright ? 0.75 + rand() * 0.25 : 0.25 + rand() * 0.5 * (1 - d * 0.4), c });
    // Nubes de polvo a lo largo de los brazos.
    if (i % 6 === 0 && d > 0.12) {
      dust.push({ x, y, r: 0.05 + rand() * 0.07, o: 0.05 + rand() * 0.08, c: rand() > 0.45 ? palette.violet400 : rand() > 0.5 ? '#E58FD0' : palette.cyan400 });
    }
  }
  return { stars, dust };
}
