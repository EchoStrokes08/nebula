import { generateGalaxy } from './galaxy';

describe('generateGalaxy', () => {
  it('es determinista y genera polvo a lo largo de los brazos', () => {
    const a = generateGalaxy(300);
    expect(generateGalaxy(300)).toEqual(a);
    expect(a.stars).toHaveLength(300);
    expect(a.dust.length).toBeGreaterThan(20);
  });
  it('mantiene las estrellas cerca del disco', () => {
    for (const s of generateGalaxy(500).stars) expect(Math.hypot(s.x, s.y)).toBeLessThan(1.6);
  });
});
