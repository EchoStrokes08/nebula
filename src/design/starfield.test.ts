import { generateStars } from './starfield';

describe('generateStars', () => {
  it('es determinista y queda dentro del lienzo', () => {
    const a = generateStars(50, 3);
    expect(generateStars(50, 3)).toEqual(a);
    expect(a.every((s) => s.x >= 0 && s.x < 1 && s.y >= 0 && s.y < 1 && s.o <= 0.85)).toBe(true);
  });
});
