import { navLayoutFor, sections } from './sections';

describe('navegación principal', () => {
  it('tiene las cinco secciones del PDF en orden', () => {
    expect(sections.map((s) => s.label)).toEqual(['Hoy', 'Hábitos', 'Agenda', 'Retos', 'Perfil']);
  });

  it('usa barra inferior en Android/ventanas estrechas y lateral en escritorio', () => {
    expect(navLayoutFor(390)).toBe('bottom');
    expect(navLayoutFor(899)).toBe('bottom');
    expect(navLayoutFor(1280)).toBe('sidebar');
  });
});
