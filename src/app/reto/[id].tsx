import { router, useLocalSearchParams } from 'expo-router';
import { Check, LogOut, RotateCcw, Timer, Trophy, X } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/forms/Chip';
import { TextField } from '@/components/forms/TextField';
import { useToast } from '@/components/overlays/UndoToast';
import { ContributionBar, ProgressBar } from '@/components/progress/ProgressBar';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { Avatar, colorFor } from '@/components/social/Avatar';
import { LeaderboardRow } from '@/components/social/LeaderboardRow';
import { colors, radius, spacing } from '@/design/tokens';
import { useAuth } from '@/features/auth/session';
import * as api from '@/features/challenges/api';
import { statusText } from '@/features/challenges/ChallengeCard';
import { useChallengeMutation, useMyChallenges, usePactConfirmations, usePeople, useResults, useStandings } from '@/features/challenges/hooks';
import { KIND_LABEL, METRIC_LABEL, rankingNote, scoreText } from '@/features/challenges/labels';
import { formatNumber } from '@/features/habits/format';
import { useHabitsData } from '@/features/habits/hooks';
import { useToday } from '@/features/habits/useToday';
import { MotivationLine } from '@/features/motivation/MotivationLine';
import { BackLink } from '@/features/social/BackHeader';
import { socialError } from '@/features/social/hooks';
import { confirmAction } from '@/lib/confirm';
import { diffDays } from '@/lib/dates';
import { SkeletonList } from '@/components/feedback/Skeleton';

export default function RetoDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useAuth((s) => s.session?.user.id);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const today = useToday();
  const challenges = useMyChallenges();
  const c = challenges.data?.find((x) => x.id === id);
  const live = !!c && (c.status === 'active' || c.status === 'finished');
  const standings = useStandings(id, live);
  const people = usePeople(id);
  const results = useResults(id, c?.status === 'finished');
  const pact = usePactConfirmations(id, c?.kind === 'pact' && c.status === 'finished');
  const { habits } = useHabitsData();
  const toast = useToast((t) => t.show);
  const act = useChallengeMutation(async (fn: () => Promise<unknown>) => fn());
  const run = (fn: () => Promise<unknown>, ok?: string) => act.mutate(fn, { onSuccess: () => ok && toast(ok), onError: (e) => toast(socialError(e)) });
  const [target, setTarget] = useState('');
  const [habit, setHabit] = useState<string | null>(null);

  if (challenges.isLoading) return <View style={styles.center}><SkeletonList rows={3} /></View>;
  if (!c) return <View style={styles.center}><Text tone="secondary">Este reto no existe o no participas en él.</Text><Button label="Volver" variant="secondary" onPress={() => router.replace('/retos')} /></View>;

  const st = statusText(c, today);
  const rows = standings.data ?? [];
  const mine = rows.find((r) => r.userId === me);
  const needsTarget = c.metric === 'percent' || c.kind === 'pact';
  const daysLeft = diffDays(today, c.endsOn);
  const competitive = ['duel', 'group', 'team'].includes(c.kind);
  const nextAbove = mine ? rows.filter((r) => r.rank < mine.rank).sort((a, b) => b.rank - a.rank)[0] : undefined;

  const accept = () => {
    const t = target.trim() ? Number(target.replace(',', '.')) : null;
    run(() => api.acceptChallenge(c.id, needsTarget ? t : null, c.source === 'habit' ? habit : null), '¡Aceptado! Te avisaremos cuando empiece.');
  };

  // Equipos: media del % (equilibrado) o suma (resto).
  const teams = c.kind === 'team'
    ? [1, 2].map((t) => {
        const members = rows.filter((r) => r.team === t && r.status === 'accepted');
        const score = c.metric === 'percent' ? (members.length ? members.reduce((a, r) => a + r.score, 0) / members.length : 0) : members.reduce((a, r) => a + r.score, 0);
        return { team: t, members, score };
      }).sort((a, b) => b.score - a.score)
    : [];
  const coopTotal = rows.filter((r) => r.status === 'accepted').reduce((a, r) => a + r.value, 0);

  return (
    <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing[4], paddingBottom: insets.bottom + spacing[12] }, width >= 900 && styles.wide]} keyboardShouldPersistTaps="handled">
      <BackLink label="Retos" />
      <View style={styles.head}>
        <View style={styles.headRow}>
          <Text variant="overline" tone="accent">{KIND_LABEL[c.kind].toUpperCase()}</Text>
          <View style={styles.pill}><Text variant="caption" tone={st.tone}>{st.text}</Text></View>
        </View>
        <Text variant="title1" accessibilityRole="header">{c.title}</Text>
        {c.description ? <Text tone="secondary">{c.description}</Text> : null}
        <Text variant="callout" tone="tertiary">
          {c.startsOn.split('-').reverse().join('/')} – {c.endsOn.split('-').reverse().join('/')} · {c.source === 'focus' ? 'Minutos de enfoque' : 'Hábito de cada participante'} · {METRIC_LABEL[c.metric].title}
        </Text>
      </View>

      {c.status === 'active' && competitive && mine ? (
        <MotivationLine moment="reto" extra={{ reto: { dias: Math.max(0, daysLeft), posicion: mine.rank, diferencia: nextAbove ? scoreText(c.metric, Math.max(0, nextAbove.score - mine.score), c.unit) : '' } }} />
      ) : null}

      {/* Invitación pendiente */}
      {c.status === 'pending' && c.myStatus === 'invited' ? (
        <View style={[styles.card, styles.invite]}>
          <Text variant="title3">Te han invitado</Text>
          <Text tone="secondary">{rankingNote(c)}</Text>
          {c.kind === 'pact' && (c.pactCelebration || c.pactSupport) ? (
            <Text>{c.pactCelebration ? `Si cumplís: ${c.pactCelebration}. ` : ''}{c.pactSupport ? `Si no: ${c.pactSupport}.` : ''}</Text>
          ) : null}
          {needsTarget ? <TextField label={c.kind === 'pact' ? 'Días que te comprometes a cumplir' : `Tu objetivo personal (${c.unit})`} value={target} onChangeText={setTarget} inputMode="decimal" hint="Quedará bloqueado cuando empiece el reto." /> : null}
          {c.source === 'habit' ? (
            <View style={styles.wrap}>
              <Text variant="callout">Participas con:</Text>
              {(habits.data ?? []).filter((h) => !h.archived).map((h) => <Chip key={h.id} role="radio" label={h.name} selected={habit === h.id} onToggle={() => setHabit(h.id)} />)}
            </View>
          ) : null}
          <View style={styles.actions}>
            <Button label="Rechazar" variant="ghost" icon={<X size={18} color={colors.accentSoft} />} onPress={() => run(() => api.declineChallenge(c.id), 'Invitación rechazada')} />
            <Button label="Aceptar las reglas" icon={<Check size={18} color={colors.textOnAccent} />} loading={act.isPending} onPress={accept} />
          </View>
        </View>
      ) : null}

      {/* A la espera de que empiece */}
      {c.status === 'pending' && c.myStatus !== 'invited' ? (
        <View style={styles.card}>
          <Text variant="title3">{c.startsOn === today ? 'Empieza hoy' : `Empieza en ${diffDays(today, c.startsOn)} días`}</Text>
          <Text tone="secondary">Necesita al menos dos participantes que acepten antes del inicio.</Text>
          {people.data?.map((p) => (
            <View key={p.userId} style={styles.person}>
              <Avatar name={p.displayName} seed={p.handle} />
              <Text style={styles.flex}>{p.userId === me ? 'Tú' : p.displayName}{p.team ? ` · Equipo ${p.team}` : ''}</Text>
              <Text variant="caption" tone={p.status === 'accepted' ? 'success' : p.status === 'declined' ? 'danger' : 'warning'}>
                {p.status === 'accepted' ? `Aceptó${p.personalTarget ? ` · objetivo ${formatNumber(p.personalTarget)} ${c.kind === 'pact' ? 'días' : c.unit}` : ''}` : p.status === 'declined' ? 'Rechazó' : 'Pendiente'}
              </Text>
            </View>
          ))}
          {c.createdBy === me ? <Button label="Cancelar reto" variant="danger" onPress={() => confirmAction('Cancelar reto', 'Se avisará a los invitados.', 'Cancelar reto', () => run(() => api.cancelChallenge(c.id), 'Reto cancelado'))} /> : null}
        </View>
      ) : null}

      {/* Clasificación / progreso */}
      {live ? (
        <View style={styles.card}>
          <Text variant="title3">{c.kind === 'cooperative' ? 'Progreso conjunto' : c.kind === 'pact' ? 'Compromisos' : 'Clasificación'}</Text>
          {standings.isLoading ? <Text tone="secondary">Calculando…</Text> : null}
          {standings.error ? <Text tone="danger">No se pudo cargar la clasificación.</Text> : null}

          {c.kind === 'cooperative' && c.coopTarget ? (
            <>
              <Text variant="metric" tabular>{formatNumber(Math.round(coopTotal * 10) / 10)} <Text tone="secondary">/ {formatNumber(c.coopTarget)} {c.unit}</Text></Text>
              <ContributionBar total={c.coopTarget} parts={rows.filter((r) => r.status === 'accepted').map((r) => ({ value: r.value, color: colorFor(r.handle), label: r.displayName }))} />
              <View style={styles.legend}>
                {rows.map((r) => (
                  <Text key={r.userId} variant="callout" style={{ color: colorFor(r.handle) }}>
                    {r.userId === me ? 'Tú' : r.displayName} · {formatNumber(Math.round(r.value * 10) / 10)}
                    {c.coopMode === 'distributed' && c.coopMinEach ? (r.value >= c.coopMinEach ? ' ✓' : ` (mín. ${formatNumber(c.coopMinEach)})`) : ''}
                  </Text>
                ))}
              </View>
              <Text variant="caption" tone="tertiary">
                {c.coopMode === 'distributed' ? `Cada integrante debe aportar al menos ${formatNumber(c.coopMinEach ?? 0)} ${c.unit}.` : 'Cada integrante contribuye al resultado colectivo, con su aportación visible.'}
              </Text>
            </>
          ) : null}

          {c.kind === 'pact'
            ? rows.map((r) => {
                const kept = r.target ? r.daysActive >= r.target : false;
                return (
                  <View key={r.userId} style={styles.rankRow}>
                    <View style={styles.person}>
                      <Avatar name={r.displayName} seed={r.handle} />
                      <Text variant="bodyStrong" style={styles.flex}>{r.userId === me ? 'Tú' : r.displayName}</Text>
                      <Text variant="bodyStrong" tabular tone={kept ? 'success' : 'primary'}>{r.daysActive} / {formatNumber(r.target ?? 0)} días</Text>
                    </View>
                    <ProgressBar progress={r.target ? r.daysActive / r.target : 0} color={colorFor(r.handle)} />
                  </View>
                );
              })
            : null}

          {competitive && c.kind !== 'team'
            ? rows.map((r, i) => {
                const prev = rows[i - 1];
                const gap = prev && prev.rank < r.rank ? prev.score - r.score : null;
                const detail = `${c.metric === 'percent' ? `${formatNumber(Math.round(r.value))} de ${formatNumber(r.target ?? 0)} ${c.unit}` : `${r.daysActive} días activos`}${gap !== null ? ` · a ${scoreText(c.metric, Math.round(gap * 10) / 10, c.unit)} del anterior` : ''}${r.value > 0 ? ` · ${Math.round(r.timerShare * 100)} % con temporizador` : ''}`;
                return (
                  <LeaderboardRow
                    key={r.userId}
                    rank={r.rank}
                    name={`${r.displayName}${r.status === 'left' ? ' (abandonó)' : ''}`}
                    handle={r.handle}
                    isMe={r.userId === me}
                    score={scoreText(c.metric, r.score, c.unit)}
                    progress={c.metric === 'percent' ? r.score / 100 : rows[0]!.score ? r.score / rows[0]!.score : 0}
                    detail={detail}
                  />
                );
              })
            : null}

          {c.kind === 'team'
            ? teams.map((t, i) => (
                <View key={t.team} style={styles.rankRow}>
                  <View style={styles.person}>
                    <Text variant="bodyStrong" tone="tertiary" style={styles.rankNum}>{i + 1}</Text>
                    <Text variant="bodyStrong" style={styles.flex}>Equipo {t.team}</Text>
                    <Text variant="bodyStrong" tabular>{scoreText(c.metric, Math.round(t.score * 10) / 10, c.unit)}</Text>
                  </View>
                  <Text variant="caption" tone="tertiary">{t.members.map((m) => (m.userId === me ? 'Tú' : m.displayName)).join(', ')}</Text>
                </View>
              ))
            : null}

          {competitive ? <Text variant="caption" tone="tertiary">{rankingNote(c)}{c.kind === 'team' && c.metric === 'percent' ? ' En equipos se usa la media de sus integrantes.' : ''}</Text> : null}
          <Text variant="caption" tone="tertiary">Los minutos de enfoque se registran con el temporizador; los registros de hábitos pueden ser autodeclarados. No cuentan registros hechos más de 2 días después de su fecha.</Text>
        </View>
      ) : null}

      {/* Resultados y pactos al terminar */}
      {c.status === 'finished' && competitive && results.data?.length ? (
        <View style={styles.card}>
          <View style={styles.person}>
            <Trophy size={20} color={colors.warning} />
            <Text variant="title3">Resultado final</Text>
          </View>
          <Text>
            {results.data.filter((r) => r.winner).map((r) => (r.user_id === me ? 'Tú' : rows.find((x) => x.userId === r.user_id)?.displayName ?? 'Alguien')).join(' y ')}
            {results.data.filter((r) => r.winner).length > 1 ? ' empatáis en el primer puesto.' : results.data.find((r) => r.winner)?.user_id === me ? ' ganas este reto.' : ' gana este reto.'}
          </Text>
          <Button label="Revancha" variant="secondary" icon={<RotateCcw size={18} color={colors.text} />} onPress={() => router.push({ pathname: '/reto/nuevo', params: rows.length === 2 ? { amigo: rows.find((r) => r.userId !== me)?.userId ?? '' } : {} })} />
        </View>
      ) : null}

      {c.status === 'finished' && c.kind === 'pact' ? (
        <View style={styles.card}>
          <Text variant="title3">Confirmad el resultado</Text>
          {c.pactCelebration ? <Text>Si los dos cumplisteis: {c.pactCelebration}.</Text> : null}
          {c.pactSupport ? <Text>Si alguien no cumplió: {c.pactSupport}.</Text> : null}
          {rows.filter((r) => r.userId !== me).map((r) => {
            const mineConf = pact.data?.find((p) => p.user_id === me && p.about_user === r.userId);
            return (
              <View key={r.userId} style={styles.person}>
                <Text style={styles.flex}>¿{r.displayName} cumplió?</Text>
                <Chip role="radio" label="Sí" selected={mineConf?.kept === true} onToggle={() => run(() => api.confirmPact(c.id, r.userId, true, null), 'Confirmado')} />
                <Chip role="radio" label="No" selected={mineConf?.kept === false} onToggle={() => run(() => api.confirmPact(c.id, r.userId, false, null), 'Confirmado')} />
              </View>
            );
          })}
          {pact.data?.filter((p) => p.about_user === me).map((p) => (
            <Text key={p.user_id} variant="callout" tone={p.kept ? 'success' : 'warning'}>
              {rows.find((r) => r.userId === p.user_id)?.displayName ?? 'Tu compañero'} confirma que {p.kept ? 'cumpliste' : 'no cumpliste'}.
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.actions}>
        {c.status === 'active' && c.source === 'focus' ? <Button label="Sesión de enfoque" icon={<Timer size={18} color={colors.textOnAccent} />} onPress={() => router.push('/enfoque')} /> : null}
        {c.status === 'active' && c.myStatus === 'accepted' ? (
          <Button label="Abandonar" variant="ghost" icon={<LogOut size={18} color={colors.accentSoft} />} onPress={() => confirmAction('Abandonar el reto', 'Tu resultado se conservará marcado como abandonado.', 'Abandonar', () => run(() => api.leaveChallenge(c.id)))} />
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing[5], gap: spacing[5] },
  wide: { maxWidth: 760, width: '100%', alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[4], padding: spacing[6] },
  head: { gap: spacing[2] },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pill: { paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.bgAlt },
  card: { gap: spacing[3], padding: spacing[5], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  invite: { borderColor: colors.warning },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], alignItems: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3], justifyContent: 'flex-end' },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  rankRow: { gap: spacing[2], paddingVertical: spacing[2] },
  rankNum: { width: 18 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[4] },
  flex: { flex: 1 },
});
