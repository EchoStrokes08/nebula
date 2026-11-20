import { fireEvent, render, screen } from '@testing-library/react-native';

import { minutesFrom, snapMinutes, timeOf, TimeRangeSlider, TimeSlider } from './TimeSlider';

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

describe('TimeSlider', () => {
  it('se anuncia ajustable y sube o baja un paso', async () => {
    const onChange = jest.fn();
    await render(<TimeSlider label="Hora límite" value="18:00" onChange={onChange} />);
    const s = screen.getByRole('adjustable', { name: 'Hora límite' });
    expect(s.props.accessibilityValue).toMatchObject({ now: 1080, text: '18:00' });
    await fireEvent(s, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(onChange).toHaveBeenLastCalledWith('18:15');
    await fireEvent(s, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(onChange).toHaveBeenLastCalledWith('17:45');
  });
  it('los botones − y + afinan un paso', async () => {
    const onChange = jest.fn();
    await render(<TimeSlider label="Empieza" value="09:00" step={5} onChange={onChange} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Empieza: 5 minutos después' }));
    expect(onChange).toHaveBeenLastCalledWith('09:05');
    await fireEvent.press(screen.getByRole('button', { name: 'Empieza: 5 minutos antes' }));
    expect(onChange).toHaveBeenLastCalledWith('08:55');
  });
  it('deshabilitado no cambia', async () => {
    const onChange = jest.fn();
    await render(<TimeSlider label="Hora" value="08:00" onChange={onChange} disabled />);
    await fireEvent(screen.getByRole('adjustable', { name: 'Hora' }), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(onChange).not.toHaveBeenCalled();
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
