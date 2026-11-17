import type { DayKey } from '@/lib/dates';

import * as api from './api';
import { applyRecommendation } from './Recommendations';

jest.mock('./api', () => ({ setTarget: jest.fn(), updateHabit: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock no admite import.
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const today = '2026-11-17' as DayKey;
const habit = { id: 'h', name: 'Leer', kind: 'duration', scheduleDays: [], startDay: '2026-01-01', targets: [{ validFrom: '2026-01-01', period: 'day', target: 60, minTarget: 40 }], pauses: [] } as never;

beforeEach(() => jest.clearAllMocks());
it('un cambio de objetivo crea una versión desde hoy y ajusta el mínimo', async () => {
  await applyRecommendation(habit, { id: 'x', kind: 'duration', title: '', reason: '', preview: '', change: { type: 'target', target: 30 } }, today);
  expect(api.setTarget).toHaveBeenCalledWith('h', today, { period: 'day', target: 30, sessionMin: null, minTarget: 30 });
});
it('días y horario se guardan en el hábito', async () => {
  await applyRecommendation(habit, { id: 'd', kind: 'days', title: '', reason: '', preview: '', change: { type: 'days', days: [1, 2] } }, today);
  await applyRecommendation(habit, { id: 't', kind: 'time', title: '', reason: '', preview: '', change: { type: 'time', time: '21:00' } }, today);
  expect(api.updateHabit).toHaveBeenNthCalledWith(1, 'h', { schedule_days: [1, 2] });
  expect(api.updateHabit).toHaveBeenNthCalledWith(2, 'h', { suggested_time: '21:00' });
});
it('las recomendaciones informativas no escriben nada', async () => {
  await applyRecommendation(habit, { id: 's', kind: 'split', title: '', reason: '', preview: '', change: { type: 'none' } }, today);
  expect(api.setTarget).not.toHaveBeenCalled();
  expect(api.updateHabit).not.toHaveBeenCalled();
});
