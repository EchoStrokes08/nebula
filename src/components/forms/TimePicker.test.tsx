import { fireEvent, render, screen } from '@testing-library/react-native';

import { DAY_PARTS, minuteOptions, nudgeMinutes, parseHourInput, parseMinuteInput, partOfDay, TimePicker, withHour } from './TimePicker';

jest.mock('@/platform/haptics', () => ({ platformHaptics: { tap: jest.fn(), success: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

describe('utilidades del selector de hora', () => {
  it('las franjas cubren las 24 horas una sola vez', () => {
    expect(DAY_PARTS.flatMap((p) => p.hours)).toEqual(Array.from({ length: 24 }, (_, h) => h));
  });
  it('lee la franja del día en palabras', () => {
    expect(partOfDay(7)).toBe('de la mañana');
    expect(partOfDay(22)).toBe('de la noche');
    expect(partOfDay(3)).toBe('de madrugada');
  });
  it('ofrece los minutos según el paso', () => {
    expect(minuteOptions(5)).toHaveLength(12);
    expect(minuteOptions(15)).toEqual([0, 15, 30, 45]);
  });
  it('al cambiar de hora conserva el minuto o usa el primero válido', () => {
    expect(withHour(9, 30, 5, 0, 1439)).toBe(570);
    expect(withHour(0, 0, 5, 5, 1439)).toBe(5);
    expect(withHour(23, 59, 5, 0, 1439)).toBe(23 * 60 + 59);
    expect(withHour(3, 0, 5, 600, 1439)).toBeNull();
  });
});

describe('escribir y afinar la hora', () => {
  it('la hora acepta solo la hora o la hora completa', () => {
    expect(parseHourInput('7', 20)).toBe(7 * 60 + 20);
    expect(parseHourInput('7:37', 20)).toBe(7 * 60 + 37);
    expect(parseHourInput('19.05', 0)).toBe(19 * 60 + 5);
    expect(parseHourInput('737', 0)).toBe(7 * 60 + 37);
    expect(parseHourInput('24', 0)).toBeNull();
    expect(parseHourInput('7:', 0)).toBeNull();
    expect(parseHourInput('', 0)).toBeNull();
  });
  it('los minutos aceptan cualquier minuto de 0 a 59', () => {
    expect(parseMinuteInput('37')).toBe(37);
    expect(parseMinuteInput('3')).toBe(3);
    expect(parseMinuteInput('60')).toBeNull();
    expect(parseMinuteInput('a')).toBeNull();
  });
  it('− y + mueven de minuto en minuto sin salirse del rango', () => {
    expect(nudgeMinutes(7 * 60 + 59, 1, 0, 1439)).toBe(8 * 60);
    expect(nudgeMinutes(0, -1, 0, 1439)).toBe(0);
    expect(nudgeMinutes(1439, 1, 0, 1439)).toBe(1439);
  });
});

describe('TimePicker', () => {
  it('se escribe «7:37» en la hora grande, o solo los minutos', async () => {
    const onChange = jest.fn();
    await render(<TimePicker label="Hora" value="08:20" onChange={onChange} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Hora: 08:20' }));
    await fireEvent.changeText(screen.getByLabelText(/^Hora, escríbela/), '7:37');
    await fireEvent.press(screen.getByRole('button', { name: 'Usar las 07:37' }));
    expect(onChange).toHaveBeenLastCalledWith('07:37');
    await fireEvent.press(screen.getByRole('button', { name: 'Hora: 08:20' }));
    await fireEvent.changeText(screen.getByLabelText(/^Minutos, escríbelos/), '37');
    await fireEvent.press(screen.getByRole('button', { name: 'Usar las 08:37' }));
    expect(onChange).toHaveBeenLastCalledWith('08:37');
  });
  it('− y + afinan minuto a minuto', async () => {
    const onChange = jest.fn();
    await render(<TimePicker label="Hora" value="08:59" onChange={onChange} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Hora: 08:59' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Un minuto después' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Usar las 09:00' }));
    expect(onChange).toHaveBeenLastCalledWith('09:00');
    await fireEvent.press(screen.getByRole('button', { name: 'Hora: 08:59' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Un minuto antes' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Un minuto antes' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Usar las 08:57' }));
    expect(onChange).toHaveBeenLastCalledWith('08:57');
  });
  it('sin valor muestra el texto de ayuda y despliega todas las horas', async () => {
    const onChange = jest.fn();
    await render(<TimePicker label="Hora personalizada" value="" onChange={onChange} placeholder="Elegir cualquier hora" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Hora personalizada: Elegir cualquier hora' }));
    for (const h of ['00', '07', '13', '23']) expect(screen.getByRole('radio', { name: `${h} horas` })).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: '07 horas' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Minuto 35' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Usar las 07:35' }));
    expect(onChange).toHaveBeenLastCalledWith('07:35');
  });
  it('cambiar de hora conserva los minutos elegidos', async () => {
    const onChange = jest.fn();
    await render(<TimePicker label="Hora" value="08:20" onChange={onChange} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Hora: 08:20' }));
    await fireEvent.press(screen.getByRole('radio', { name: '21 horas' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Usar las 21:20' }));
    expect(onChange).toHaveBeenLastCalledWith('21:20');
  });
  it('deshabilitado no se abre', async () => {
    await render(<TimePicker label="Hora" value="08:00" onChange={jest.fn()} disabled />);
    await fireEvent.press(screen.getByRole('button', { name: 'Hora: 08:00' }));
    expect(screen.queryByRole('radio', { name: '09 horas' })).toBeNull();
  });
});
