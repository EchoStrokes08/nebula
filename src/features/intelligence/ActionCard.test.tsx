import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ActionCard } from './ActionCard';
import { applyAction } from './apply';
jest.mock('./apply', () => ({ applyAction: jest.fn(), describeAction: () => 'Tarea propuesta: Leer' }));
jest.mock('@/features/habits/useToday', () => ({ useTimeZone: () => 'America/Bogota' }));
jest.mock('./PlanCard', () => ({ PlanCard: () => null }));
jest.mock('@/platform/haptics', () => ({ platformHaptics: { tap: jest.fn() } }));
const action = { type: 'create_task', title: 'Leer', day: null, time: null, minutes: 20, priority: 1, recurrence: null } as const;
beforeEach(() => jest.resetAllMocks());
it('no escribe hasta confirmar y no permite repetir una acción aplicada', async () => {
  jest.mocked(applyAction).mockResolvedValue();
  const view = await render(<ActionCard action={action} />);
  expect(applyAction).not.toHaveBeenCalled();
  await fireEvent.press(view.getByRole('button', { name: 'Confirmar y aplicar' }));
  await waitFor(() => expect(view.getByText('Aplicado.')).toBeTruthy());
  expect(applyAction).toHaveBeenCalledTimes(1);
  expect(view.queryByRole('button', { name: 'Confirmar y aplicar' })).toBeNull();
});
it('descartar no ejecuta ninguna escritura', async () => {
  const view = await render(<ActionCard action={action} />);
  await fireEvent.press(view.getByRole('button', { name: 'Descartar' }));
  await waitFor(() => expect(view.getByText('Descartado.')).toBeTruthy());
  expect(applyAction).not.toHaveBeenCalled();
});
it('conserva la propuesta tras fallo y permite reintentar', async () => {
  jest.mocked(applyAction).mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValueOnce();
  const view = await render(<ActionCard action={action} />);
  await fireEvent.press(view.getByRole('button', { name: 'Confirmar y aplicar' }));
  await waitFor(() => expect(view.getByText('Sin conexión')).toBeTruthy());
  await fireEvent.press(view.getByRole('button', { name: 'Confirmar y aplicar' }));
  await waitFor(() => expect(view.getByText('Aplicado.')).toBeTruthy());
});
it('con aplicar automáticamente crea lo nuevo sin pulsar, una sola vez', async () => {
  jest.mocked(applyAction).mockResolvedValue();
  const view = await render(<ActionCard action={action} autoApply />);
  await waitFor(() => expect(view.getByText('Aplicado.')).toBeTruthy());
  expect(applyAction).toHaveBeenCalledTimes(1);
});
it('nunca aplica sin confirmar cambios sobre tareas existentes', async () => {
  const move = { type: 'prioritize_task', id: '7d1f6c1e-3d2a-4e5b-9f00-0123456789ab', priority: 3 } as const;
  const view = await render(<ActionCard action={move} autoApply />);
  await new Promise((r) => setTimeout(r, 20));
  expect(applyAction).not.toHaveBeenCalled();
  expect(view.getByRole('button', { name: 'Confirmar y aplicar' })).toBeTruthy();
});
