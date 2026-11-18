import { render } from '@testing-library/react-native';

import { useRecentMessages } from './recent';
import { MotivationLine } from './MotivationLine';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/features/habits/useToday', () => ({ useToday: () => '2026-11-17' }));
jest.mock('./useMotivationContext', () => ({
  useMotivationContext: (moment: string) => ({ intensity: 'intense', moment, hour: 23 }),
}));

describe('MotivationLine', () => {
  beforeEach(() => useRecentMessages.setState({ recent: [], picks: {} }));

  it('dos líneas a la vez (Hoy detrás de Enfoque) no entran en bucle y mantienen su mensaje', async () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    const screen = await render(<><MotivationLine moment="cierre" /><MotivationLine moment="enfoque" /></>);
    const { picks } = useRecentMessages.getState();
    expect(Object.keys(picks).sort()).toEqual(['2026-11-17:cierre', '2026-11-17:enfoque']);
    // Volver a renderizar no cambia lo elegido.
    await screen.rerender(<><MotivationLine moment="cierre" /><MotivationLine moment="enfoque" /></>);
    expect(useRecentMessages.getState().picks).toEqual(picks);
    expect(errors).not.toHaveBeenCalledWith(expect.stringContaining('Maximum update depth'));
    errors.mockRestore();
  });

  it('al volver a la pantalla el mismo día muestra el mismo mensaje', async () => {
    const first = await render(<MotivationLine moment="enfoque" />);
    const text = first.toJSON();
    await first.unmount();
    useRecentMessages.getState().remember('otro-id');
    expect((await render(<MotivationLine moment="enfoque" />)).toJSON()).toEqual(text);
  });
});
