import { contrastRatio } from './contrast';
import { colors, chartColors, userColors } from './tokens';

const surfaces = { bg: colors.bg, bgAlt: colors.bgAlt, surface: colors.surface, raised: colors.surfaceRaised };

describe('contraste de tokens (WCAG AA)', () => {
  it('calcula valores de referencia', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 0);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 1);
  });

  for (const [name, bg] of Object.entries(surfaces)) {
    it(`texto principal y secundario ≥ 4.5:1 sobre ${name}`, () => {
      expect(contrastRatio(colors.text, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(colors.textSecondary, bg)).toBeGreaterThanOrEqual(4.5);
    });

    it(`texto terciario y estados ≥ 3:1 (texto grande/iconos) sobre ${name}`, () => {
      for (const c of [colors.textTertiary, colors.info, colors.success, colors.warning, colors.danger, colors.accentBright]) {
        expect(contrastRatio(c, bg)).toBeGreaterThanOrEqual(3);
      }
    });

    it(`colores de gráficos y de usuario ≥ 3:1 sobre ${name}`, () => {
      for (const c of [...chartColors, ...Object.values(userColors)]) {
        expect(contrastRatio(c, bg)).toBeGreaterThanOrEqual(3);
      }
    });
  }

  it('texto sobre el botón primario ≥ 4.5:1', () => {
    expect(contrastRatio(colors.textOnAccent, colors.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it('texto de estado sobre su fondo atenuado ≥ 4.5:1', () => {
    for (const [fg, bg] of [
      [colors.success, colors.successMuted],
      [colors.warning, colors.warningMuted],
      [colors.danger, colors.dangerMuted],
      [colors.info, colors.infoMuted],
      [colors.accentSoft, colors.accentMuted],
    ] as const) {
      expect(contrastRatio(fg, bg, colors.surface)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
