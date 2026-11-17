import { router } from 'expo-router';
import { Bell, Flag, Plus, Users, UsersRound } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Chip } from '@/components/forms/Chip';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import { ChallengeCard } from '@/features/challenges/ChallengeCard';
import { useMyChallenges } from '@/features/challenges/hooks';
import { useToday } from '@/features/habits/useToday';
import { useNotifications } from '@/features/notifications/api';
import { useFriendRequests, useFriends } from '@/features/social/hooks';
import { SkeletonList } from '@/components/feedback/Skeleton';

type Seg = 'competencia' | 'equipo' | 'pactos' | 'historial';

export default function RetosScreen() {
  const today = useToday();
  const challenges = useMyChallenges();
  const friends = useFriends();
  const requests = useFriendRequests();
  const notifications = useNotifications();
  const [seg, setSeg] = useState<Seg>('competencia');
  const unread = (notifications.data ?? []).filter((n) => !n.readAt).length;
  const incoming = (requests.data ?? []).filter((r) => r.direction === 'incoming').length;

  const all = (challenges.data ?? []).filter((c) => c.myStatus !== 'declined');
  const open = all.filter((c) => c.status === 'pending' || c.status === 'active');
  const invites = open.filter((c) => c.status === 'pending' && c.myStatus === 'invited');
  const bySeg = (s: Seg) =>
    s === 'historial'
      ? all.filter((c) => c.status === 'finished' || c.status === 'cancelled')
      : open.filter((c) => (s === 'competencia' ? ['duel', 'group', 'team'].includes(c.kind) : s === 'equipo' ? c.kind === 'cooperative' : c.kind === 'pact'));
  const items = bySeg(seg).filter((c) => !invites.includes(c));

  return (
    <Screen
      title="Retos"
      trailing={
        <View style={styles.row}>
          <Pressable onPress={() => router.push('/notificaciones')} accessibilityRole="button" accessibilityLabel={`Notificaciones${unread ? `, ${unread} sin leer` : ''}`} style={styles.bell} hitSlop={8}>
            <Bell size={22} color={colors.textSecondary} />
            {unread ? <View style={styles.badge}><Text variant="caption" style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text></View> : null}
          </Pressable>
          <Button label="Crear" icon={<Plus size={18} color={colors.textOnAccent} />} disabled={!friends.data?.length} onPress={() => router.push('/reto/nuevo')} />
        </View>
      }
    >
      <View style={styles.links}>
        <Pressable onPress={() => router.push('/amigos')} style={({ pressed }) => [styles.link, pressed && styles.pressed]} accessibilityRole="button">
          <Users size={18} color={colors.accentSoft} />
          <Text variant="bodyStrong">Amigos</Text>
          <Text variant="callout" tone={incoming ? 'warning' : 'secondary'}>{incoming ? `${incoming} solicitudes` : (friends.data?.length ?? 0)}</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/circulos')} style={({ pressed }) => [styles.link, pressed && styles.pressed]} accessibilityRole="button">
          <UsersRound size={18} color={colors.accentSoft} />
          <Text variant="bodyStrong">Círculos</Text>
        </Pressable>
      </View>

      {invites.length ? (
        <View style={styles.section}>
          <Text variant="overline" tone="warning">INVITACIONES PENDIENTES</Text>
          {invites.map((c) => <ChallengeCard key={c.id} c={c} today={today} />)}
        </View>
      ) : null}

      <View style={styles.wrap} accessibilityRole="radiogroup">
        {(['competencia', 'equipo', 'pactos', 'historial'] as Seg[]).map((s) => (
          <Chip key={s} role="radio" label={{ competencia: 'Competencia', equipo: 'En equipo', pactos: 'Pactos', historial: 'Historial' }[s]} selected={seg === s} onToggle={() => setSeg(s)} />
        ))}
      </View>

      {challenges.isLoading ? (
        <SkeletonList rows={3} />
      ) : challenges.error ? (
        <EmptyState title="No se pudieron cargar los retos" action={<Button label="Reintentar" variant="secondary" onPress={() => challenges.refetch()} />} />
      ) : !friends.data?.length ? (
        <EmptyState
          icon={<Flag size={28} color={colors.accentSoft} strokeWidth={1.6} />}
          title="Los retos se hacen con amigos"
          description="Añade a alguien por su @usuario para competir, colaborar o hacer un pacto."
          action={<Button label="Buscar amigos" onPress={() => router.push('/amigos')} />}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title={seg === 'historial' ? 'Sin retos terminados' : 'Nada en marcha aquí'}
          description={seg === 'competencia' ? 'Reta a un amigo: duelo, grupo o equipos. Con reglas claras y objetivos personales justos.' : seg === 'equipo' ? 'Un objetivo que cumplís juntos, con la contribución de cada uno visible.' : seg === 'pactos' ? 'Un compromiso mutuo: si cumplís, celebráis; si no, acordáis una acción de apoyo.' : undefined}
          action={seg !== 'historial' ? <Button label="Crear" variant="secondary" onPress={() => router.push({ pathname: '/reto/nuevo', params: { tipo: seg } })} /> : undefined}
        />
      ) : (
        <View style={styles.section}>{items.map((c) => <ChallengeCard key={c.id} c={c} today={today} />)}</View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  bell: { padding: spacing[2] },
  badge: { position: 'absolute', top: 2, right: 0, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: colors.textOnAccent, fontSize: 10, lineHeight: 12 },
  links: { flexDirection: 'row', gap: spacing[3] },
  link: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[2], padding: spacing[4], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexWrap: 'wrap' },
  pressed: { backgroundColor: colors.surfacePressed },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  section: { gap: spacing[3] },
});
