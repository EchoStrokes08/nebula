import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/forms/Chip';
import { TextField } from '@/components/forms/TextField';
import { Sheet } from '@/components/overlays/Sheet';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { spacing } from '@/design/tokens';
import type { HabitKind } from '@/domain/habits/types';

import { unitLabel } from './format';

const PRESETS: Partial<Record<HabitKind, number[]>> = {
  duration: [5, 10, 15, 25, 30, 45, 60],
  quantity: [1, 2, 5, 10],
  cumulative: [1, 2, 5, 10],
  flexible: [10, 20, 30, 45, 60],
  reduction: [0, 1, 2, 3],
};

export interface LogSheetProps {
  visible: boolean;
  onClose(): void;
  habitName: string;
  kind: HabitKind;
  unit: string | null;
  onSubmit(value: number, note: string | null): void;
}

/** Registro de una cantidad (duración, cantidad, acumulativo, flexible, reducción) con nota opcional. */
export function LogSheet({ visible, onClose, habitName, kind, unit, onSubmit }: LogSheetProps) {
  const [raw, setRaw] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const u = kind === 'flexible' ? 'min' : unitLabel(kind, unit);

  const submit = () => {
    const value = Number(raw.replace(',', '.'));
    if (raw.trim() === '' || !Number.isFinite(value) || value < 0 || value > 100000) {
      setError('Introduce un número válido.');
      return;
    }
    if (value === 0 && kind !== 'reduction') {
      setError('Registra una cantidad mayor que 0.');
      return;
    }
    onSubmit(value, note.trim() || null);
    setRaw('');
    setNote('');
    setError(null);
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={habitName}>
      <Text variant="callout" tone="secondary">
        {kind === 'reduction' ? `¿Cuánto llevas hoy? Registrar 0 también cuenta.` : `Añade lo que has hecho (${u}).`}
      </Text>
      <View style={styles.presets}>
        {(PRESETS[kind] ?? []).map((p) => (
          <Chip key={p} role="radio" label={`${p} ${u}`} selected={raw === String(p)} onToggle={() => setRaw(String(p))} />
        ))}
      </View>
      <TextField label={`Cantidad (${u})`} value={raw} onChangeText={setRaw} keyboardType="decimal-pad" inputMode="decimal" error={error} onSubmitEditing={submit} />
      <TextField label="Nota (opcional)" value={note} onChangeText={setNote} maxLength={500} />
      <View style={styles.actions}>
        <Button label="Cancelar" variant="ghost" onPress={onClose} />
        <Button label="Registrar" onPress={submit} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[2] },
});
