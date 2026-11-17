import { fireEvent, render, screen } from '@testing-library/react-native';

import { ErrorState } from '@/components/feedback/ErrorState';
import { PermissionState } from '@/components/feedback/PermissionState';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Stepper } from '@/components/forms/Stepper';
import { Switch } from '@/components/forms/Switch';
import { Button } from '@/components/primitives/Button';
import { ContributionBar, ProgressBar } from '@/components/progress/ProgressBar';
import { AvatarStack } from '@/components/social/AvatarStack';
import { LeaderboardRow } from '@/components/social/LeaderboardRow';
import { ParticipantChip } from '@/components/social/ParticipantChip';

jest.mock('@/platform/haptics', () => ({ platformHaptics: { tap: jest.fn(), success: jest.fn() } }));

describe('Button', () => {
  it('expone rol y etiqueta y no responde deshabilitado', async () => {
    const onPress = jest.fn();
    await render(<Button label="Guardar" disabled onPress={onPress} />);
    const btn = screen.getByRole('button', { name: 'Guardar' });
    expect(btn.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(btn);
    expect(onPress).not.toHaveBeenCalled();
  });
  it('en carga queda ocupado y deshabilitado', async () => {
    await render(<Button label="Enviar" loading />);
    expect(screen.getByRole('button', { name: 'Enviar' }).props.accessibilityState).toMatchObject({ disabled: true, busy: true });
  });
});

describe('Switch', () => {
  it('alterna y anuncia su estado', async () => {
    const onChange = jest.fn();
    await render(<Switch label="Recordatorios" value={false} onChange={onChange} />);
    const sw = screen.getByRole('switch', { name: 'Recordatorios' });
    expect(sw.props.accessibilityState).toMatchObject({ checked: false });
    await fireEvent.press(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });
  it('deshabilitado no cambia', async () => {
    const onChange = jest.fn();
    await render(<Switch label="X" value onChange={onChange} disabled />);
    await fireEvent.press(screen.getByRole('switch', { name: 'X' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('SegmentedControl', () => {
  it('marca la pestaña seleccionada y cambia al pulsar', async () => {
    const onChange = jest.fn();
    await render(<SegmentedControl<"dia" | "mes"> label="Vista" value="dia" onChange={onChange} segments={[{ value: 'dia', label: 'Día' }, { value: 'mes', label: 'Mes' }]} />);
    expect(screen.getByRole('tab', { name: 'Día' }).props.accessibilityState).toMatchObject({ selected: true });
    await fireEvent.press(screen.getByRole('tab', { name: 'Mes' }));
    expect(onChange).toHaveBeenCalledWith('mes');
  });
});

describe('Stepper', () => {
  it('respeta los límites', async () => {
    const onChange = jest.fn();
    await render(<Stepper label="Vasos" value={0} min={0} max={2} onChange={onChange} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Restar 1' }));
    expect(onChange).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Sumar 1' }));
    expect(onChange).toHaveBeenCalledWith(1);
  });
  it('admite acciones de accesibilidad', async () => {
    const onChange = jest.fn();
    await render(<Stepper label="Vasos" value={1} onChange={onChange} />);
    const adj = screen.getByRole('adjustable');
    await fireEvent(adj, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(onChange).toHaveBeenCalledWith(0);
  });
});

describe('Progreso', () => {
  it('limita el valor a 0–100', async () => {
    await render(<ProgressBar progress={1.7} />);
    expect(screen.getByRole('progressbar').props.accessibilityValue).toMatchObject({ now: 100 });
  });
  it('la barra de contribuciones describe a cada persona', async () => {
    await render(<ContributionBar total={10} parts={[{ value: 4, color: '#fff', label: 'Ana' }, { value: 3, color: '#000', label: 'Leo' }]} />);
    const bar = screen.getByRole('progressbar');
    expect(bar.props.accessibilityLabel).toBe('Ana: 4, Leo: 3');
    expect(bar.props.accessibilityValue).toMatchObject({ now: 7, max: 10 });
  });
});

describe('Estados', () => {
  it('ErrorState ofrece reintentar', async () => {
    const onRetry = jest.fn();
    await render(<ErrorState onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalled();
  });
  it('PermissionState explica y ofrece alternativa', async () => {
    const onSkip = jest.fn();
    await render(<PermissionState title="Notificaciones" reason="Para tus recordatorios." denied onRequest={() => {}} onSkip={onSkip} />);
    expect(screen.getByText(/ajustes del sistema/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Abrir ajustes' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Ahora no' }));
    expect(onSkip).toHaveBeenCalled();
  });
});

describe('Social', () => {
  it('AvatarStack resume a quienes no caben', async () => {
    await render(<AvatarStack max={2} people={[{ name: 'A', seed: 'a' }, { name: 'B', seed: 'b' }, { name: 'C', seed: 'c' }]} />);
    expect(screen.getByText('+1')).toBeTruthy();
    expect(screen.getByLabelText('3 participantes: A, B, C')).toBeTruthy();
  });
  it('LeaderboardRow se anuncia como una frase', async () => {
    await render(<LeaderboardRow rank={2} name="Ana" handle="ana" score="80 %" progress={0.8} isMe />);
    expect(screen.getByLabelText('Posición 2: tú, 80 %')).toBeTruthy();
  });
  it('ParticipantChip permite quitar con etiqueta clara', async () => {
    const onRemove = jest.fn();
    await render(<ParticipantChip name="Leo" handle="leo" status="invited" onRemove={onRemove} />);
    expect(screen.getByText('Pendiente')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Quitar a Leo' }));
    expect(onRemove).toHaveBeenCalled();
  });
});
