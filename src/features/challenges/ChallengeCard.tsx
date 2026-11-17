import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import { addDays, diffDays, type DayKey } from '@/lib/dates';

import type { Challenge } from './api';
import { KIND_LABEL } from './labels';

export function statusText(c: Challenge, today: DayKey): { text: string; tone: 'accent' | 'success' | 'warning' | 'tertiary' } {
  if (c.status === 'pending') return c.myStatus === 'invited' ? { text: 'Te han invitado', tone: 'warning' } : { text: `Empieza ${c.startsOn === today ? 'hoy' : `en ${diffDays(today, c.startsOn)} días`}`, tone: 'accent' };
  if (c.status === 'active') {
    const total = diffDays(c.startsOn, c.endsOn) + 1;
    const n = Math.min(total, diffDays(c.startsOn, today) + 1);
    return { text: today > c.endsOn ? 'Cerrando resultados' : `Día ${n} de ${total}`, tone: 'success' };
  }
  if (c.status === 'finished') return { text: c.outcome === 'achieved' ? 'Objetivo conseguido' : c.outcome === 'not_achieved' ? 'No se alcanzó' : 'Terminado', tone: 'tertiary' };
  return { text: 'Cancelado', tone: 'tertiary' };
}

export function ChallengeCard({ c, today }: { c: Challenge; today: DayKey }) {
  const st = statusText(c, today);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/reto/[id]', params: { id: c.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${KIND_LABEL[c.kind]}: ${c.title}. ${st.text}`}
      style={({ pressed }) => [styles.card, c.myStatus === 'invited' && c.status === 'pending' && styles.invited, pressed && styles.pressed]}
    >
      <View style={styles.head}>
        <Text variant="overline" tone="accent">{KIND_LABEL[c.kind].toUpperCase()}</Text>
        <View style={styles.pill}><Text variant="caption" tone={st.tone}>{st.text}</Text></View>
      </View>
      <Text variant="title3">{c.title}</Text>
      {c.description ? <Text variant="callout" tone="secondary" numberOfLines={2}>{c.description}</Text> : null}
      <Text variant="caption" tone="tertiary">{c.startsOn.split('-').reverse().slice(0, 2).join('/')} – {addDays(c.endsOn, 0).split('-').reverse().slice(0, 2).join('/')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[2], padding: spacing[5], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  invited: { borderColor: colors.warning },
  pressed: { backgroundColor: colors.surfacePressed },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: { paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.bgAlt },
});
