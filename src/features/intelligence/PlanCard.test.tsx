import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { PlanCard } from './PlanCard';
import { planSteps } from './plan';
import { samplePlan } from '@/domain/capture/plan.fixture';
import type { PlanAction } from '@/domain/capture/actions';

jest.mock('./plan', () => ({ ...jest.requireActual('./plan'), planSteps: jest.fn(), refreshAfterPlan: jest.fn() }));
jest.mock('@/features/habits/useToday', () => ({ useTimeZone: () => 'Europe/Madrid', useToday: () => '2026-11-17' }));
jest.mock('@/platform/haptics', () => ({ platformHaptics: { tap: jest.fn() } }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
const plan = samplePlan as unknown as PlanAction;
beforeEach(() => jest.resetAllMocks());

it('muestra tareas, hábitos y enlaces y no escribe nada hasta confirmar', async () => {
  const view = await render(<PlanCard plan={plan} />);
  expect(view.getByText('Instalar Python y VS Code')).toBeTruthy();
  expect(view.getByText('Practicar Python')).toBeTruthy();
  expect(view.getByRole('link', { name: /Tutorial oficial/ })).toBeTruthy();
  expect(planSteps).not.toHaveBeenCalled();
});

it('aplica solo lo marcado y al reintentar no repite lo ya creado', async () => {
  const first = jest.fn().mockResolvedValue(undefined);
  const second = jest.fn().mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValueOnce(undefined);
  jest.mocked(planSteps).mockReturnValue([{ key: 'goal', label: 'Meta', run: first }, { key: 'habit-0', label: 'Hábito', run: second }]);
  const view = await render(<PlanCard plan={plan} />);
  await fireEvent.press(view.getByRole('checkbox', { name: 'Incluir tarea Instalar Python y VS Code' }));
  await fireEvent.press(view.getByRole('button', { name: 'Confirmar y aplicar (2)' }));
  await waitFor(() => expect(view.getByText(/Sin conexión/)).toBeTruthy());
  expect(jest.mocked(planSteps).mock.calls[0]![1]).toEqual({ milestones: true, tasks: [], habits: [0] });
  await fireEvent.press(view.getByRole('button', { name: 'Confirmar y aplicar (2)' }));
  await waitFor(() => expect(view.getByText('Plan aplicado.')).toBeTruthy());
  expect(first).toHaveBeenCalledTimes(1);
  expect(second).toHaveBeenCalledTimes(2);
});

it('con aplicar automáticamente crea el plan completo al aparecer', async () => {
  const step = jest.fn().mockResolvedValue(undefined);
  jest.mocked(planSteps).mockReturnValue([{ key: 'goal', label: 'Meta', run: step }]);
  const view = await render(<PlanCard plan={plan} autoApply />);
  await waitFor(() => expect(view.getByText('Plan aplicado.')).toBeTruthy());
  expect(step).toHaveBeenCalledTimes(1);
});
