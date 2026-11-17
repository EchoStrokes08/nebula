import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DateField } from '@/components/forms/DateField';
import { Chip } from '@/components/forms/Chip';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Select } from '@/components/forms/Select';
import { Switch } from '@/components/forms/Switch';
import { TextArea } from '@/components/forms/TextArea';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Text } from '@/components/primitives/Text';
import { db, unwrap } from '@/data/db';
import { spacing } from '@/design/tokens';
import { journalPatterns } from '@/domain/journal/patterns';
import { useGoals } from '@/features/goals/hooks';
import { useHabitsData } from '@/features/habits/hooks';
import { useTimeZone, useToday } from '@/features/habits/useToday';
import { weeklySummary } from '@/features/intelligence/insights';
import { useJournal, useSaveJournal } from '@/features/journal/api';
import { usePreferences, useUpdatePreferences } from '@/features/profile/usePreferences';
import { confirmAction } from '@/lib/confirm';
import { addDays, isDayKey, type DayKey } from '@/lib/dates';

/** Consentimiento para analizar el diario. Se guarda en el dispositivo: el análisis también es local. */
const useJournalConsent = create<{ insights: boolean; set(v: boolean): void }>()(
  persist((set) => ({ insights: false, set: (insights) => set({ insights }) }), { name: 'nebula-journal-consent', storage: createJSONStorage(() => AsyncStorage) }),
);

type Fields = { achievements: string; difficulties: string; learnings: string; next_step: string; goal_id: string | null };
const EMPTY: Fields = { achievements: '', difficulties: '', learnings: '', next_step: '', goal_id: null };

export default function Diario() {
  const today = useToday();
  const tz = useTimeZone();
  const journal = useJournal();
  const save = useSaveJournal();
  const goals = useGoals();
  const { logs } = useHabitsData();
  const prefs = usePreferences();
  const update = useUpdatePreferences();
  const qc = useQueryClient();
  const consent = useJournalConsent();
  const [day, setDay] = useState<DayKey>(today);
  const [kind, setKind] = useState<'daily' | 'weekly'>('daily');
  const [drafts, setDrafts] = useState<Record<string, Fields>>({});
  const [message, setMessage] = useState('');
  const entry = journal.data?.find((e) => e.day_key === day && e.kind === kind);
  const key = `${day}:${kind}`;
  const fields: Fields = drafts[key] ?? (entry ? { ...EMPTY, ...entry } : EMPTY);
  const edit = <K extends keyof Fields>(field: K, value: Fields[K]) => setDrafts((old) => ({ ...old, [key]: { ...fields, [field]: value } }));
  const summary = weeklySummary([], logs.data ?? [], today, tz);
  const hasText = !!(fields.achievements.trim() || fields.difficulties.trim() || fields.learnings.trim() || fields.next_step.trim());

  const patterns = useMemo(() => {
    if (!consent.insights || !journal.data) return null;
    const range = Array.from({ length: 56 }, (_, i) => addDays(today, -i));
    const active = new Set((logs.data ?? []).filter((l) => l.value > 0).map((l) => l.dayKey));
    return journalPatterns(journal.data, active, range);
  }, [consent.insights, journal.data, logs.data, today]);

  return (
    <Screen title="Diario" back={{ fallback: '/perfil' }}>
      <Text tone="secondary">Un espacio privado para aprender de tu semana. Estas reflexiones no se envían al asistente ni las ven tus amigos.</Text>
      {journal.isError ? <ErrorState title="No se pudo cargar el diario" onRetry={() => void journal.refetch()} /> : null}
      <SegmentedControl label="Tipo de reflexión" value={kind} onChange={setKind} segments={[{ value: 'daily', label: 'Reflexión diaria' }, { value: 'weekly', label: 'Revisión semanal' }]} />
      <DateField label="Fecha" value={day} onChange={(d) => d && setDay(d > today ? today : d)} today={today} allowEmpty={false} />
      {kind === 'weekly' ? (
        <Card>
          <Text variant="title3">Últimos siete días</Text>
          <Text>{logs.isSuccess ? `${summary.habitRecords} registros de hábitos · ${summary.activeDays} días con actividad.` : 'Calculando…'}</Text>
          <Text tone="secondary">Revisa lo que funcionó, qué puedes reducir y elige un próximo paso concreto.</Text>
        </Card>
      ) : null}
      <TextArea label="¿Qué lograste?" value={fields.achievements} onChangeText={(v) => edit('achievements', v)} maxLength={5000} />
      <TextArea label="¿Qué te dificultó avanzar?" value={fields.difficulties} onChangeText={(v) => edit('difficulties', v)} maxLength={5000} />
      <TextArea label="¿Qué aprendiste?" value={fields.learnings} onChangeText={(v) => edit('learnings', v)} maxLength={5000} />
      <TextArea label="Tu próximo paso" numberOfLines={2} value={fields.next_step} onChangeText={(v) => edit('next_step', v)} maxLength={5000} />
      {goals.data?.length ? (
        <Select
          label="Meta relacionada (opcional)"
          value={fields.goal_id ?? 'none'}
          onChange={(v) => edit('goal_id', v === 'none' ? null : v)}
          options={[{ value: 'none', label: 'Ninguna' }, ...goals.data.filter((g) => g.status === 'active' || g.id === fields.goal_id).map((g) => ({ value: g.id, label: g.title }))]}
        />
      ) : null}
      <View style={styles.row}>
        {entry ? (
          <Button label="Eliminar" variant="danger" onPress={() => confirmAction('Eliminar reflexión', 'Esta acción no se puede deshacer.', 'Eliminar', () => { void (async () => { try { unwrap(await db().from('journal_entries').delete().eq('id', entry.id)); await qc.invalidateQueries({ queryKey: ['journal'] }); setMessage('Reflexión eliminada.'); } catch { setMessage('No se pudo eliminar.'); } })(); })} />
        ) : null}
        <Button
          label="Guardar reflexión"
          loading={save.isPending}
          disabled={!journal.isSuccess || !isDayKey(day) || day > today || !hasText}
          onPress={() => save.mutate({ day_key: day, kind, achievements: fields.achievements, difficulties: fields.difficulties, learnings: fields.learnings, next_step: fields.next_step, goal_id: fields.goal_id }, { onSuccess: () => setMessage('Reflexión guardada.'), onError: () => setMessage('No se pudo guardar. Tus cambios siguen en el formulario.') })}
        />
      </View>
      {message ? <Text accessibilityLiveRegion="polite">{message}</Text> : null}

      <Card>
        <Text variant="title3">Patrones del diario</Text>
        <Switch
          label="Analizar mis reflexiones"
          description="Busca temas que se repiten y los compara con tus registros. El análisis se hace en este dispositivo; no se envía nada."
          value={consent.insights}
          onChange={consent.set}
        />
        {patterns?.status === 'insufficient' ? <Text tone="secondary">Necesitas al menos {patterns.needed} reflexiones; llevas {patterns.have}.</Text> : null}
        {patterns?.status === 'ok' && !patterns.patterns.length ? <Text tone="secondary">Aún no se aprecian patrones claros.</Text> : null}
        {patterns?.status === 'ok' ? patterns.patterns.map((p) => <Text key={p.id}>• {p.text}</Text>) : null}
      </Card>

      <Text variant="title3">Día de revisión semanal</Text>
      <View style={styles.wrap}>{['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((d, i) => <Chip key={d} label={d} selected={prefs.data?.weeklyReviewDay === i} role="radio" onToggle={() => update.mutate({ weekly_review_day: i })} />)}</View>
      {update.isError ? <Text tone="danger">No se guardó el día de revisión.</Text> : null}
      <Text variant="title3">Historial</Text>
      {journal.data?.length ? (
        <View style={styles.wrap}>
          {journal.data.map((e) => <Chip key={e.id} role="radio" selected={e.day_key === day && e.kind === kind} label={`${e.day_key.split('-').reverse().join('/')} · ${e.kind === 'weekly' ? 'Semanal' : 'Diaria'}`} onToggle={() => { setDay(e.day_key); setKind(e.kind); }} />)}
        </View>
      ) : <Text tone="secondary">Todavía no hay reflexiones.</Text>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[2], flexWrap: 'wrap' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
});
