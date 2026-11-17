import { defaultAnswers, isProvisionalHandle, toPreferencesRow } from './options';

describe('onboarding → preferencias', () => {
  it('limpia objetivos vacíos y traduce franjas', () => {
    const row = toPreferencesRow({
      ...defaultAnswers,
      goals: [' Aprobar Cálculo ', '', 'Leer 12 libros'],
      focus: ['evening', 'morning'],
      activeDays: [5, 1, 3],
    });
    expect(row.onboarding_goals).toEqual(['Aprobar Cálculo', 'Leer 12 libros']);
    expect(row.focus_windows).toEqual([
      { start: '07:00', end: '12:00' },
      { start: '18:00', end: '23:00' },
    ]);
    expect(row.active_days).toEqual([1, 3, 5]);
  });
});


describe('isProvisionalHandle', () => {
  it('reconoce solo el @usuario generado en el alta', () => {
    expect(isProvisionalHandle('usuario_1a2b3c4d')).toBe(true);
    expect(isProvisionalHandle('laura')).toBe(false);
    expect(isProvisionalHandle(undefined)).toBe(false);
  });
});
