import { router } from 'expo-router';
import { Bell, CheckCheck } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import { useMarkRead, useNotifications, type AppNotification } from '@/features/notifications/api';
import { SkeletonList } from '@/components/feedback/Skeleton';

function open(n: AppNotification) {
  if (n.data.challenge_id) router.push({ pathname: '/reto/[id]', params: { id: n.data.challenge_id } });
  else if (n.data.circle_id) router.push('/circulos');
  else if (n.kind.startsWith('friend')) router.push('/amigos');
}

const dayLabel = (iso: string) => new Date(iso).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });

export default function Notificaciones() {
  const list = useNotifications();
  const mark = useMarkRead();
  const items = list.data ?? [];
  const groups = new Map<string, AppNotification[]>();
  for (const n of items) groups.set(dayLabel(n.createdAt), [...(groups.get(dayLabel(n.createdAt)) ?? []), n]);

  return (
    <Screen back={{ fallback: '/retos' }} title="Notificaciones" trailing={items.some((n) => !n.readAt) ? <Button label="Marcar todo" variant="ghost" icon={<CheckCheck size={18} color={colors.accentSoft} />} onPress={() => mark.mutate('all')} /> : undefined}>
      {list.isLoading ? <SkeletonList rows={3} /> : null}
      {!list.isLoading && items.length === 0 ? <EmptyState icon={<Bell size={28} color={colors.accentSoft} strokeWidth={1.6} />} title="Todo al día" description="Aquí verás solicitudes de amistad, invitaciones y resultados de retos." /> : null}
      {[...groups.entries()].map(([day, ns]) => (
        <View key={day} style={styles.group}>
          <Text variant="overline" tone="secondary">{day.toUpperCase()}</Text>
          {ns.map((n) => (
            <Pressable
              key={n.id}
              onPress={() => {
                if (!n.readAt) mark.mutate([n.id]);
                open(n);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${n.readAt ? '' : 'Sin leer. '}${n.title}. ${n.body}`}
              style={({ pressed }) => [styles.item, !n.readAt && styles.unread, pressed && styles.pressed]}
            >
              {!n.readAt ? <View style={styles.dot} /> : null}
              <View style={styles.flex}>
                <Text variant="bodyStrong">{n.title}</Text>
                {n.body ? <Text variant="callout" tone="secondary">{n.body}</Text> : null}
                <Text variant="caption" tone="tertiary">{new Date(n.createdAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing[2] },
  item: { flexDirection: 'row', gap: spacing[3], padding: spacing[4], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  unread: { borderColor: colors.accent },
  pressed: { backgroundColor: colors.surfacePressed },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accentBright, marginTop: 6 },
  flex: { flex: 1, gap: 2 },
});
