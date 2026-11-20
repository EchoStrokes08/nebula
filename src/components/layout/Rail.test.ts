import { railWraps } from './Rail';

jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }));

describe('Rail', () => {
  it('en escritorio y web ancha reparte en líneas; en móvil se desliza', () => {
    expect(railWraps(1280, 'web')).toBe(true);
    expect(railWraps(600, 'web')).toBe(true);
    expect(railWraps(390, 'web')).toBe(false);
    expect(railWraps(1280, 'android')).toBe(false);
  });
});
