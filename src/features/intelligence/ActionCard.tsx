import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import type { ProposedAction } from '@/domain/capture/actions';
import { useTimeZone } from '@/features/habits/useToday';
import { applyAction, describeAction } from './apply';

export function ActionCard({ action }: { action: ProposedAction }) {
  const tz = useTimeZone();
  const [state, setState] = useState<'preview' | 'saving' | 'done' | 'dismissed'>('preview');
  const [error, setError] = useState('');
  return <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing[4], gap: spacing[3] }}>
    <Text>{describeAction(action)}</Text>
    {state === 'done' ? <Text tone="success">Aplicado.</Text> : state === 'dismissed' ? <Text tone="secondary">Descartado.</Text> : <>
      <Button label="Confirmar y aplicar" loading={state === 'saving'} onPress={async () => {
        if (state !== 'preview') return;
        setState('saving'); setError('');
        try { await applyAction(action, tz); setState('done'); }
        catch (e) { setError(e instanceof Error ? e.message : 'No se pudo aplicar.'); setState('preview'); }
      }} />
      <Button label="Descartar" variant="ghost" disabled={state === 'saving'} onPress={() => setState('dismissed')} />
    </>}
    {error ? <Text tone="danger" accessibilityLiveRegion="polite">{error}</Text> : null}
  </View>;
}
