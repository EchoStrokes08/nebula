import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/forms/Chip';
import { DateField } from '@/components/forms/DateField';
import { TextField } from '@/components/forms/TextField';
import { useToast } from '@/components/overlays/UndoToast';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import { FormMessage } from '@/features/auth/FormMessage';
import { createChallenge, type ChallengeKind, type ChallengeMetric, type NewChallenge } from '@/features/challenges/api';
import { KIND_LABEL, METRIC_LABEL, rankingNote } from '@/features/challenges/labels';
import { unitLabel } from '@/features/habits/format';
import { useHabitsData } from '@/features/habits/hooks';
import { useTimeZone, useToday } from '@/features/habits/useToday';
import { circleMembers } from '@/features/social/api';
import { socialError, useFriends, useSocialMutation } from '@/features/social/hooks';
import { addDays, type DayKey } from '@/lib/dates';

const KINDS: ChallengeKind[] = ['duel', 'group', 'team', 'cooperative', 'pact'];
const METRICS_FOR: Record<ChallengeKind, ChallengeMetric[]> = {
  duel: ['percent', 'consistency', 'sessions', 'quantity', 'relative'],
  group: ['percent', 'consistency', 'sessions', 'quantity', 'relative'],
  team: ['percent', 'consistency', 'sessions', 'quantity'],
  cooperative: ['quantity', 'sessions', 'consistency'],
  pact: ['consistency'],
};
const DURATIONS = [7, 14, 30];
const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')));

export default function NuevoReto() {
  const params = useLocalSearchParams<{ tipo?: string; amigo?: string; circulo?: string }>();
  const today = useToday();
  const tz = useTimeZone();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const friends = useFriends();
  const { habits } = useHabitsData();
  const toast = useToast((t) => t.show);
  const circle = useQuery({ queryKey: ['circle_members', params.circulo], queryFn: () => circleMembers(params.circulo!), enabled: !!params.circulo });

  const initialKind: ChallengeKind = params.tipo === 'equipo' ? 'cooperative' : params.tipo === 'pactos' ? 'pact' : params.amigo ? 'duel' : 'group';
  const [kind, setKind] = useState<ChallengeKind>(initialKind);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [source, setSource] = useState<'focus' | 'habit'>('focus');
  const [metric, setMetric] = useState<ChallengeMetric>(initialKind === 'cooperative' ? 'quantity' : initialKind === 'pact' ? 'consistency' : 'percent');
  const [startsOn, setStartsOn] = useState<DayKey | null>(today);
  const [days, setDays] = useState(7);
  const [myTarget, setMyTarget] = useState('');
  const [myHabit, setMyHabit] = useState<string | null>(null);
  const [tie, setTie] = useState<'consistency' | 'shared'>('consistency');
  const [coopMode, setCoopMode] = useState<'collective' | 'distributed'>('collective');
  const [coopTarget, setCoopTarget] = useState('');
  const [coopMin, setCoopMin] = useState('');
  const [support, setSupport] = useState('');
  const [celebration, setCelebration] = useState('');
  const [invitees, setInvitees] = useState<Record<string, number | null>>(params.amigo ? { [params.amigo]: null } : {});
  const [myTeam, setMyTeam] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const create = useSocialMutation(createChallenge);

  const habitList = (habits.data ?? []).filter((h) => !h.archived);
  const habit = habitList.find((h) => h.id === myHabit);
  const unit = source === 'focus' ? 'min' : habit ? (metric === 'consistency' ? 'días' : unitLabel(habit.kind, habit.unit) || 'veces') : 'veces';
  const needsTarget = metric === 'percent' || kind === 'pact';
  const circleIds = new Set((circle.data ?? []).map((m) => m.userId));
  const pickable = (friends.data ?? []).filter((f) => !params.circulo || circleIds.has(f.id));
  const close = () => (router.canGoBack() ? router.back() : router.replace('/retos'));

  const pickKind = (k: ChallengeKind) => {
    setKind(k);
    if (!METRICS_FOR[k].includes(metric)) setMetric(METRICS_FOR[k][0]!);
    if (k === 'duel') setInvitees((x) => Object.fromEntries(Object.entries(x).slice(0, 1)));
  };
  const toggleInvitee = (id: string) =>
    setInvitees((x) => {
      if (id in x) {
        const { [id]: _, ...rest } = x;
        return rest;
      }
      return kind === 'duel' ? { [id]: null } : { ...x, [id]: kind === 'team' ? 2 : null };
    });

  const submit = () => {
    setError(null);
    const ids = Object.keys(invitees);
    if (!title.trim()) return setError('Ponle un nombre al reto.');
    if (!startsOn) return setError('Elige cuándo empieza.');
    if (ids.length === 0) return setError('Invita al menos a un amigo.');
    if (kind === 'duel' && ids.length !== 1) return setError('Un duelo es entre dos personas.');
    if (source === 'habit' && !myHabit) return setError('Elige el hábito con el que participas.');
    const target = num(myTarget);
    if (needsTarget && (!target || target <= 0)) return setError(kind === 'pact' ? 'Indica cuántos días te comprometes a cumplir.' : 'Define tu objetivo personal.');
    if (kind === 'pact' && target! > days) return setError('No puedes comprometerte a más días de los que dura el pacto.');
    const ct = num(coopTarget);
    const cm = num(coopMin);
    if (kind === 'cooperative' && (!ct || ct <= 0)) return setError('Indica el objetivo común.');
    if (kind === 'cooperative' && coopMode === 'distributed' && (!cm || cm <= 0)) return setError('Indica el mínimo por persona.');
    if (kind === 'team' && !ids.some((i) => invitees[i] === (myTeam === 1 ? 2 : 1))) return setError('El equipo rival necesita al menos una persona.');
    const payload: NewChallenge = {
      kind,
      title: title.trim(),
      description: description.trim() || undefined,
      metric,
      source,
      unit,
      starts_on: startsOn,
      ends_on: addDays(startsOn, days - 1),
      tz,
      tie_rule: tie,
      coop_mode: kind === 'cooperative' ? coopMode : null,
      coop_target: kind === 'cooperative' ? ct : null,
      coop_min_each: kind === 'cooperative' && coopMode === 'distributed' ? cm : null,
      pact_support: kind === 'pact' ? support.trim() || null : null,
      pact_celebration: kind === 'pact' ? celebration.trim() || null : null,
      circle_id: params.circulo ?? null,
      invitees: ids.map((user_id) => ({ user_id, team: kind === 'team' ? invitees[user_id] : null })),
      my_target: needsTarget ? target : null,
      my_habit_id: source === 'habit' ? myHabit : null,
      my_team: kind === 'team' ? myTeam : null,
    };
    create.mutate(payload, {
      onSuccess: (id) => {
        toast('Reto creado. Tus amigos recibirán la invitación.');
        router.replace({ pathname: '/reto/[id]', params: { id } });
      },
      onError: (e) => setError(socialError(e)),
    });
  };

  return (
    <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing[4], paddingBottom: insets.bottom + spacing[10] }, width >= 900 && styles.wide]} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text variant="title1" accessibilityRole="header">Nuevo reto</Text>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={10}><X size={22} color={colors.textSecondary} /></Pressable>
      </View>

      <Section title="Tipo">
        <View style={styles.wrap}>
          {KINDS.map((k) => <Chip key={k} role="radio" label={KIND_LABEL[k]} selected={kind === k} onToggle={() => pickKind(k)} />)}
        </View>
      </Section>

      <TextField label="Nombre" value={title} onChangeText={setTitle} maxLength={80} placeholder={kind === 'cooperative' ? '30 sesiones de estudio' : kind === 'pact' ? 'Leer cada noche' : '7 días de enfoque'} />
      <TextField label="Descripción (opcional)" value={description} onChangeText={setDescription} maxLength={500} />

      <Section title="Qué cuenta">
        <View style={styles.wrap}>
          <Chip role="radio" label="Minutos de enfoque" selected={source === 'focus'} onToggle={() => setSource('focus')} />
          <Chip role="radio" label="Un hábito" selected={source === 'habit'} onToggle={() => setSource('habit')} />
        </View>
        <Text variant="callout" tone="secondary">
          {source === 'focus' ? 'Cuentan las sesiones completadas con el temporizador de Nebula.' : 'Cada participante elige su propio hábito al aceptar. Los registros manuales se marcan como autodeclarados.'}
        </Text>
        {source === 'habit' ? (
          <View style={styles.wrap}>
            {habitList.length === 0 ? <Text tone="warning">Crea antes un hábito.</Text> : null}
            {habitList.map((h) => <Chip key={h.id} role="radio" label={h.name} selected={myHabit === h.id} onToggle={() => setMyHabit(h.id)} />)}
          </View>
        ) : null}
      </Section>

      {kind !== 'pact' ? (
        <Section title="Cómo se gana">
          <View style={styles.wrap}>
            {METRICS_FOR[kind].map((m) => <Chip key={m} role="radio" label={METRIC_LABEL[m].title} selected={metric === m} onToggle={() => setMetric(m)} />)}
          </View>
          <Text variant="callout" tone="secondary">{METRIC_LABEL[metric].help}</Text>
        </Section>
      ) : null}

      {kind === 'cooperative' ? (
        <Section title="Objetivo común">
          <View style={styles.wrap}>
            <Chip role="radio" label="Colectivo" selected={coopMode === 'collective'} onToggle={() => setCoopMode('collective')} />
            <Chip role="radio" label="Distribuido" selected={coopMode === 'distributed'} onToggle={() => setCoopMode('distributed')} />
          </View>
          <Text variant="callout" tone="secondary">{coopMode === 'collective' ? 'Basta con alcanzar el total entre todos.' : 'Además del total, cada persona debe aportar un mínimo.'}</Text>
          <View style={styles.row}>
            <View style={styles.flex}><TextField label={`Total (${metric === 'sessions' ? 'sesiones' : metric === 'consistency' ? 'días' : unit})`} value={coopTarget} onChangeText={setCoopTarget} inputMode="decimal" /></View>
            {coopMode === 'distributed' ? <View style={styles.flex}><TextField label="Mínimo por persona" value={coopMin} onChangeText={setCoopMin} inputMode="decimal" /></View> : null}
          </View>
        </Section>
      ) : null}

      {needsTarget ? (
        <Section title={kind === 'pact' ? 'Tu compromiso' : 'Tu objetivo personal'}>
          <TextField label={kind === 'pact' ? 'Días que te comprometes a cumplir' : `Objetivo (${unit})`} value={myTarget} onChangeText={setMyTarget} inputMode="decimal" />
          <Text variant="caption" tone="tertiary">Cada participante fija el suyo al aceptar. Queda bloqueado cuando empieza el reto.</Text>
        </Section>
      ) : null}

      {kind === 'pact' ? (
        <Section title="Acuerdo">
          <TextField label="Si ambos cumplís, celebraréis con…" value={celebration} onChangeText={setCelebration} maxLength={200} placeholder="Una cena juntos" />
          <TextField label="Si alguien no cumple, la acción de apoyo será…" value={support} onChangeText={setSupport} maxLength={200} placeholder="Estudiar juntos el domingo" />
        </Section>
      ) : null}

      <Section title="Cuándo">
        <DateField label="Empieza" value={startsOn} onChange={setStartsOn} today={today} allowEmpty={false} />
        <View style={styles.wrap}>
          {DURATIONS.map((d) => <Chip key={d} role="radio" label={`${d} días`} selected={days === d} onToggle={() => setDays(d)} />)}
        </View>
        {startsOn ? <Text variant="caption" tone="tertiary">Termina el {addDays(startsOn, days - 1).split('-').reverse().join('/')}. Los registros cuentan hasta 24 h después del final.</Text> : null}
      </Section>

      <Section title={kind === 'team' ? 'Equipos' : 'Invitados'}>
        {pickable.length === 0 ? <Text tone="secondary">{params.circulo ? 'No hay amigos en este círculo.' : 'Aún no tienes amigos.'}</Text> : null}
        {kind === 'team' ? (
          <View style={styles.wrap}>
            <Text variant="callout">Tú estás en el equipo</Text>
            {[1, 2].map((t) => <Chip key={t} role="radio" label={`Equipo ${t}`} selected={myTeam === t} onToggle={() => setMyTeam(t)} />)}
          </View>
        ) : null}
        <View style={styles.col}>
          {pickable.map((f) => {
            const sel = f.id in invitees;
            return (
              <View key={f.id} style={styles.row}>
                <Chip label={f.displayName} selected={sel} role={kind === 'duel' ? 'radio' : 'checkbox'} onToggle={() => toggleInvitee(f.id)} />
                {kind === 'team' && sel ? (
                  [1, 2].map((t) => <Chip key={t} role="radio" label={`Eq. ${t}`} selected={invitees[f.id] === t} onToggle={() => setInvitees((x) => ({ ...x, [f.id]: t }))} />)
                ) : null}
              </View>
            );
          })}
        </View>
      </Section>

      {kind !== 'cooperative' && kind !== 'pact' ? (
        <Section title="Empates">
          <View style={styles.wrap}>
            <Chip role="radio" label="Desempata la constancia" selected={tie === 'consistency'} onToggle={() => setTie('consistency')} />
            <Chip role="radio" label="Compartir puesto" selected={tie === 'shared'} onToggle={() => setTie('shared')} />
          </View>
        </Section>
      ) : null}

      <View style={styles.summary}>
        <Text variant="overline" tone="accent">REGLAS</Text>
        <Text variant="callout">{rankingNote({ metric, unit, tieRule: tie, percentCap: 100 })}</Text>
        <Text variant="callout" tone="secondary">Las reglas no pueden cambiarse después de enviar las invitaciones. Todos las aceptan antes de empezar.</Text>
      </View>

      {error ? <FormMessage tone="danger">{error}</FormMessage> : null}
      <Button label="Crear y enviar invitaciones" onPress={submit} loading={create.isPending} fullWidth />
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="overline" tone="accent">{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing[5], gap: spacing[5] },
  wide: { maxWidth: 680, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  section: { gap: spacing[3] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], alignItems: 'center' },
  row: { flexDirection: 'row', gap: spacing[2], alignItems: 'center', flexWrap: 'wrap' },
  col: { gap: spacing[2] },
  flex: { flex: 1 },
  summary: { gap: spacing[2], padding: spacing[4], borderRadius: radius.lg, backgroundColor: colors.accentMuted },
});
