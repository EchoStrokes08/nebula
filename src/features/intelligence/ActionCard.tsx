import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import type { ProposedAction } from '@/domain/capture/actions';
import { useTimeZone } from '@/features/habits/useToday';
import { applyAction, describeAction } from './apply';
import { PlanCard } from './PlanCard';

/** Solo las acciones que crean algo nuevo pueden aplicarse sin confirmación; mover o cambiar tareas existentes siempre se confirma. */
export const AUTO_APPLICABLE: ProposedAction['type'][] = ['create_task', 'create_habit', 'create_goal', 'create_event', 'create_plan'];

export function ActionCard({ action, autoApply = false }: { action: ProposedAction; autoApply?: boolean }) {
  const auto = autoApply && AUTO_APPLICABLE.includes(action.type);
  return action.type === 'create_plan' ? <PlanCard plan={action} autoApply={auto} /> : <SimpleActionCard action={action} autoApply={auto} />;
}

function SimpleActionCard({ action, autoApply }: { action: ProposedAction; autoApply: boolean }) {
  const tz = useTimeZone();
  const [state, setState] = useState<'preview' | 'saving' | 'done' | 'dismissed'>('preview');
  const [error, setError] = useState('');
  const started = useRef(false);
  const run = async () => {
    if (started.current) return;
    started.current = true;
    setState('saving'); setError('');
    try { await applyAction(action, tz); setState('done'); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo aplicar.'); setState('preview'); started.current = false; }
  };
  // Con «Aplicar automáticamente» se ejecuta una sola vez al aparecer la tarjeta.
  useEffect(() => { if (!autoApply) return; const t = setTimeout(() => void run(), 0); return () => clearTimeout(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing[4], gap: spacing[3] }}>
    <Text>{describeAction(action)}</Text>
    {state === 'done' ? <Text tone="success">Aplicado.</Text> : state === 'dismissed' ? <Text tone="secondary">Descartado.</Text> : <>
      <Button label="Confirmar y aplicar" loading={state === 'saving'} onPress={() => void run()} />
      <Button label="Descartar" variant="ghost" disabled={state === 'saving'} onPress={() => setState('dismissed')} />
    </>}
    {error ? <Text tone="danger" accessibilityLiveRegion="polite">{error}</Text> : null}
  </View>;
}
