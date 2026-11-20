import { fireEvent, render, screen } from '@testing-library/react-native';

import { minutesFrom, snapMinutes, timeOf, TimeRangeSlider } from './TimeSlider';

jest.mock('@/platform/haptics', () => ({ platformHaptics: { tap: jest.fn(), success: jest.fn() } }));

describe('utilidades del deslizador de horas', () => {
  it('ajusta al paso y a los límites', () => {
    expect(snapMinutes(547, 15)).toBe(540);
    expect(snapMinutes(553, 15)).toBe(555);
    expect(snapMinutes(-30, 15)).toBe(0);
    expect(snapMinutes(2000, 15)).toBe(1440);
    expect(snapMinutes(600, 15, 0, 585)).toBe(585);
  });
  it('convierte entre minutos y HH:MM, con el fin del día como 23:59', () => {
    expect(timeOf(570)).toBe('09:30');
    expect(timeOf(1440)).toBe('23:59');
    expect(minutesFrom('7:05', 0)).toBe(425);
    expect(minutesFrom('', 600)).toBe(600);
  });
});

describe('TimeRangeSlider', () => {
  it('muestra la franja y su duración, y mueve cada extremo', async () => {
    const onChange = jest.fn();
    await render(<TimeRangeSlider label="Lunes" start="09:00" end="13:00" onChange={onChange} />);
    expect(screen.getByText('4 h')).toBeTruthy();
    await fireEvent(screen.getByRole('adjustable', { name: 'Lunes: hasta' }), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(onChange).toHaveBeenLastCalledWith({ start: '09:00', end: '13:15' });
    await fireEvent(screen.getByRole('adjustable', { name: 'Lunes: desde' }), 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(onChange).toHaveBeenLastCalledWith({ start: '08:45', end: '13:00' });
  });
  it('los extremos no se cruzan y el final llega a 24:00', async () => {
    const onChange = jest.fn();
    await render(<TimeRangeSlider label="Día" start="12:00" end="12:15" onChange={onChange} />);
    await fireEvent(screen.getByRole('adjustable', { name: 'Día: desde' }), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(onChange).not.toHaveBeenCalled();
    await render(<TimeRangeSlider label="Noche" start="20:00" end="23:59" onChange={onChange} />);
    expect(screen.getByRole('adjustable', { name: 'Noche: hasta' }).props.accessibilityValue).toMatchObject({ now: 1440, text: '24:00' });
  });
});
