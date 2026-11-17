import { rankingNote, scoreText } from './labels';

describe('textos de retos', () => {
  it('explica la métrica como la maqueta del PDF', () => {
    expect(rankingNote({ metric: 'percent', unit: 'min', tieRule: 'consistency', percentCap: 100 })).toMatch(/porcentaje de cumplimiento de cada participante/);
    expect(rankingNote({ metric: 'quantity', unit: 'km', tieRule: 'shared', percentCap: 100 })).toMatch(/empates se comparten/);
  });
  it('formatea puntuaciones', () => {
    expect(scoreText('percent', 92.4, 'min')).toBe('92 %');
    expect(scoreText('consistency', 5, 'días')).toBe('5 días');
    expect(scoreText('quantity', 42.25, 'km')).toBe('42.3 km');
  });
});
