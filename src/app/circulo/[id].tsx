import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Flag, LogOut, UserPlus, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Chip } from '@/components/forms/Chip';
import { Screen } from '@/components/layout/Screen';
import { Sheet } from '@/components/overlays/Sheet';
import { useToast } from '@/components/overlays/UndoToast';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { Avatar } from '@/components/social/Avatar';
import { colors, radius, spacing } from '@/design/tokens';
import { useAuth } from '@/features/auth/session';
import { ChallengeCard } from '@/features/challenges/ChallengeCard';
import { useMyChallenges } from '@/features/challenges/hooks';
import { useToday } from '@/features/habits/useToday';
import * as api from '@/features/social/api';
import { socialError, useCircles, useFriends, useSocialMutation } from '@/features/social/hooks';
import { confirmAction } from '@/lib/confirm';
import { SkeletonList } from '@/components/feedback/Skeleton';

const ROLE = { owner: 'Propietario', admin: 'Administrador', member: 'Miembro' } as const;

export default function CirculoDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useAuth((s) => s.session?.user.id);
  const today = useToday();
  const circles = useCircles();
  const circle = circles.data?.find((c) => c.id === id);
  const members = useQuery({ queryKey: ['circle_members', id], queryFn: () => api.circleMembers(id) });
  const friends = useFriends();
  const challenges = useMyChallenges();
  const toast = useToast((t) => t.show);
  const [invite, setInvite] = useState(false);
  const act = useSocialMutation(async (fn: () => Promise<unknown>) => fn());
  const run = (fn: () => Promise<unknown>, ok?: string, after?: () => void) => act.mutate(fn, { onSuccess: () => { if (ok) toast(ok); after?.(); }, onError: (e) => toast(socialError(e)) });
  const myRole = members.data?.find((m) => m.userId === me)?.role;
  const memberIds = new Set(members.data?.map((m) => m.userId));
  const circleChallenges = (challenges.data ?? []).filter((c) => c.circleId === id);

  if (circles.isLoading || members.isLoading) return <Screen back={{ fallback: '/retos', label: 'Círculos' }} title="Círculo"><SkeletonList rows={3} /></Screen>;
  if (!circle) return <Screen back={{ fallback: '/retos', label: 'Círculos' }} title="Círculo"><Text tone="secondary">Este círculo ya no existe o no perteneces a él.</Text></Screen>;

  return (
    <Screen back={{ fallback: '/retos', label: 'Círculos' }} title={circle.name}>
      {circle.description ? <Text tone="secondary">{circle.description}</Text> : null}
      <View style={styles.actions}>
        {myRole === 'owner' || myRole === 'admin' ? <Button label="Invitar" icon={<UserPlus size={18} color={colors.textOnAccent} />} onPress={() => setInvite(true)} /> : null}
        <Button label="Reto del círculo" variant="secondary" icon={<Flag size={18} color={colors.text} />} onPress={() => router.push({ pathname: '/reto/nuevo', params: { circulo: id } })} />
        <Button label="Salir" variant="secondary" icon={<LogOut size={18} color={colors.text} />} onPress={() => confirmAction('Salir del círculo', myRole === 'owner' ? 'La propiedad pasará a otro miembro (o se eliminará si eres el único).' : '¿Seguro?', 'Salir', () => run(() => api.leaveCircle(id), 'Has salido del círculo', () => router.replace('/circulos')))} />
      </View>

      <View style={styles.card}>
        <Text variant="title3">Miembros · {members.data?.length ?? 0}</Text>
        {members.data?.map((m) => (
          <View key={m.userId} style={styles.person}>
            <Avatar name={m.displayName} seed={m.handle} />
            <View style={styles.flex}>
              <Text variant="bodyStrong">{m.displayName}{m.userId === me ? ' (tú)' : ''}</Text>
              <Text variant="caption" tone="secondary">@{m.handle} · {ROLE[m.role]}</Text>
            </View>
            {myRole === 'owner' && m.role !== 'owner' ? (
              <Chip label={m.role === 'admin' ? 'Admin' : 'Hacer admin'} selected={m.role === 'admin'} onToggle={() => run(() => api.setCircleRole(id, m.userId, m.role === 'admin' ? 'member' : 'admin'))} />
            ) : null}
            {(myRole === 'owner' || (myRole === 'admin' && m.role === 'member')) && m.userId !== me ? (
              <Pressable onPress={() => confirmAction('Quitar del círculo', `${m.displayName} dejará el círculo.`, 'Quitar', () => run(() => api.removeCircleMember(id, m.userId)))} accessibilityRole="button" accessibilityLabel={`Quitar a ${m.displayName}`} style={styles.iconBtn}><X size={18} color={colors.textTertiary} /></Pressable>
            ) : null}
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text variant="title3">Retos del círculo</Text>
        {circleChallenges.length === 0 ? <Text tone="secondary">Ningún reto todavía.</Text> : circleChallenges.map((c) => <ChallengeCard key={c.id} c={c} today={today} />)}
      </View>

      <Sheet visible={invite} onClose={() => setInvite(false)} title="Invitar amigos">
        {(friends.data ?? []).filter((f) => !memberIds.has(f.id)).length === 0 ? <Text tone="secondary">Todos tus amigos ya están en este círculo.</Text> : null}
        <View style={styles.wrap}>
          {(friends.data ?? []).filter((f) => !memberIds.has(f.id)).map((f) => (
            <Chip key={f.id} label={f.displayName} selected={false} onToggle={() => run(() => api.inviteToCircle(id, f.id), `Invitación enviada a ${f.displayName}`)} />
          ))}
        </View>
        <Button label="Listo" variant="secondary" onPress={() => setInvite(false)} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  card: { gap: spacing[3], padding: spacing[5], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  flex: { flex: 1 },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
});
