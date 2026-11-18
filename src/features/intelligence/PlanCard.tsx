import { router } from 'expo-router';
import { BookOpen, CheckSquare, Flag, Flame, Globe, Square, SquareCheck } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ExternalLink } from '@/components/content/LinkText';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import type { PlanAction, PlanResource } from '@/domain/capture/actions';
import { formatDay } from '@/components/forms/DateField';
import { useTimeZone, useToday } from '@/features/habits/useToday';
import type { DayKey } from '@/lib/dates';
import { pickAll, planSteps, refreshAfterPlan, type PlanPick } from './plan';

const DAY = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const daysLabel = (days: number[]) => (days.length === 0 || days.length === 7 ? 'todos los días' : [...days].sort().map((d) => DAY[d]).join(' '));

function Resources({ list }: { list: PlanResource[] }) {
  if (!list.length) return null;
  return <View style={styles.resources}>{list.map((r) => (
    <View key={r.url}>
      <ExternalLink url={r.url} label={r.title} />
      {r.note ? <Text variant="caption" tone="tertiary" style={styles.indent}>{r.note}</Text> : null}
    </View>
  ))}</View>;
}

function Toggle({ on, disabled, onPress, children, label }: { on: boolean; disabled: boolean; onPress: () => void; children: React.ReactNode; label: string }) {
  const Icon = on ? SquareCheck : Square;
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled }} accessibilityLabel={label} style={[styles.item, !on && styles.off]}>
      <Icon size={20} color={on ? colors.accentSoft : colors.textTertiary} />
      <View style={styles.flex}>{children}</View>
    </Pressable>
  );
}

export function PlanCard({ plan, autoApply = false }: { plan: PlanAction; autoApply?: boolean }) {
  const tz = useTimeZone();
  const today = useToday();
  const day = (d: string) => formatDay(d as DayKey, today);
  const [pick, setPick] = useState<PlanPick>(() => pickAll(plan));
  const [state, setState] = useState<'preview' | 'saving' | 'done' | 'dismissed'>('preview');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [goalId, setGoalId] = useState<string | null>(null);
  // Recuerda lo ya creado entre reintentos para no duplicar.
  const done = useRef(new Set<string>());
  const goal = useRef<{ goalId: string | null }>({ goalId: null });
  const locked = state !== 'preview';
  const toggle = (kind: 'tasks' | 'habits', i: number) => setPick((p) => ({ ...p, [kind]: p[kind].includes(i) ? p[kind].filter((x) => x !== i) : [...p[kind], i].sort((a, b) => a - b) }));
  const count = 1 + pick.tasks.length + pick.habits.length;

  const running = useRef(false);
  const apply = async () => {
    if (running.current) return;
    running.current = true;
    setState('saving'); setError('');
    try {
      for (const step of planSteps(plan, pick, tz)) {
        if (done.current.has(step.key)) continue;
        setProgress(step.label);
        await step.run(goal.current);
        done.current.add(step.key);
      }
      await refreshAfterPlan();
      setGoalId(goal.current.goalId);
      setState('done');
    } catch (e) {
      setError(`${e instanceof Error ? e.message : 'No se pudo aplicar.'} Lo ya creado se conserva; reintenta para completar el resto.`);
      setState('preview');
    } finally { setProgress(''); running.current = false; }
  };
  // Con «Aplicar automáticamente» se crea todo el plan al aparecer la tarjeta.
  useEffect(() => { if (!autoApply) return; const t = setTimeout(() => void apply(), 0); return () => clearTimeout(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Flag size={18} color={colors.success} />
        <Text variant="overline" tone="success">{plan.goalId ? 'PLAN PARA TU META' : 'PLAN PARA UNA META NUEVA'}</Text>
      </View>
      <Text variant="title3">{plan.goal}</Text>
      {plan.day ? <Text variant="caption" tone="tertiary">Objetivo: {day(plan.day)}</Text> : null}
      {plan.why ? <Text variant="callout" tone="secondary">{plan.why}</Text> : null}

      {plan.milestones.length ? (
        <View style={styles.section}>
          <Toggle on={pick.milestones} disabled={locked} label="Incluir los hitos" onPress={() => setPick((p) => ({ ...p, milestones: !p.milestones }))}>
            <Text variant="bodyStrong">Hitos ({plan.milestones.length})</Text>
            {plan.milestones.map((m, i) => <Text key={i} variant="callout" tone="secondary">{i + 1}. {m}</Text>)}
          </Toggle>
        </View>
      ) : null}

      {plan.tasks.length ? (
        <View style={styles.section}>
          <View style={styles.head}><CheckSquare size={16} color={colors.info} /><Text variant="bodyStrong">Tareas</Text></View>
          {plan.tasks.map((t, i) => (
            <Toggle key={i} on={pick.tasks.includes(i)} disabled={locked} label={`Incluir tarea ${t.title}`} onPress={() => toggle('tasks', i)}>
              <Text variant="bodyStrong">{t.title}</Text>
              <Text variant="caption" tone="tertiary">{[t.day ? day(t.day) : null, t.minutes ? `${t.minutes} min` : null].filter(Boolean).join(' · ') || 'Sin fecha'}</Text>
              {t.study ? <Text variant="callout" tone="secondary">{t.study}</Text> : null}
              <Resources list={t.resources} />
            </Toggle>
          ))}
        </View>
      ) : null}

      {plan.habits.length ? (
        <View style={styles.section}>
          <View style={styles.head}><Flame size={16} color={colors.warning} /><Text variant="bodyStrong">Hábitos</Text></View>
          {plan.habits.map((h, i) => (
            <Toggle key={i} on={pick.habits.includes(i)} disabled={locked} label={`Incluir hábito ${h.title}`} onPress={() => toggle('habits', i)}>
              <Text variant="bodyStrong">{h.title}</Text>
              <Text variant="caption" tone="tertiary">{[h.minutes ? `${h.minutes} min` : 'una vez', daysLabel(h.days), h.time].filter(Boolean).join(' · ')}</Text>
              {h.study ? <Text variant="callout" tone="secondary">{h.study}</Text> : null}
              <Resources list={h.resources} />
            </Toggle>
          ))}
        </View>
      ) : null}

      {plan.resources.length ? (
        <View style={styles.section}>
          <View style={styles.head}><Globe size={16} color={colors.accentSoft} /><Text variant="bodyStrong">Dónde estudiar</Text></View>
          <Resources list={plan.resources} />
        </View>
      ) : null}
      <View style={styles.head}>
        <BookOpen size={14} color={colors.textTertiary} />
        <Text variant="caption" tone="tertiary" style={styles.flex}>Los enlaces se han comprobado al generarlos. Lo que estudiar y los recursos se guardan en las notas de cada tarea y hábito.</Text>
      </View>

      {state === 'done' ? (
        <>
          <Text tone="success">Plan aplicado.</Text>
          {goalId ? <Button label="Ver la meta" variant="secondary" onPress={() => router.push({ pathname: '/meta/[id]', params: { id: goalId } })} /> : null}
        </>
      ) : state === 'dismissed' ? <Text tone="secondary">Descartado.</Text> : (
        <>
          {progress ? <Text variant="caption" tone="secondary" accessibilityLiveRegion="polite">{progress}…</Text> : null}
          <Button label={`Confirmar y aplicar (${count})`} loading={state === 'saving'} onPress={() => void apply()} />
          <Button label="Descartar" variant="ghost" disabled={state === 'saving'} onPress={() => setState('dismissed')} />
        </>
      )}
      {error ? <Text tone="danger" accessibilityLiveRegion="polite">{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing[4], gap: spacing[3], borderWidth: 1, borderColor: colors.border },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  section: { gap: spacing[2] },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3], padding: spacing[3], borderRadius: radius.md, backgroundColor: colors.card },
  off: { opacity: 0.5 },
  flex: { flex: 1, gap: spacing[1] },
  resources: { gap: spacing[2], marginTop: spacing[1] },
  indent: { marginLeft: 22 },
});
