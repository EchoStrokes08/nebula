import { StyleSheet, View } from 'react-native';

import { ProgressBar } from '@/components/progress/ProgressBar';
import { Avatar, colorFor } from '@/components/social/Avatar';
import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';

export interface LeaderboardRowProps {
  rank: number;
  name: string;
  handle: string;
  /** Valor ya formateado (p. ej. «82 %» o «340 min»). */
  score: string;
  /** 0–1 para la barra. */
  progress: number;
  detail?: string;
  isMe?: boolean;
}

/** Fila de clasificación (maqueta «Competencia» del PDF): posición, persona, valor y barra. */
export function LeaderboardRow({ rank, name, handle, score, progress, detail, isMe }: LeaderboardRowProps) {
  return (
    <View style={[styles.row, isMe && styles.me]} accessible accessibilityLabel={`Posición ${rank}: ${isMe ? 'tú' : name}, ${score}${detail ? `. ${detail}` : ''}`}>
      <View style={styles.head}>
        <Text variant="bodyStrong" tone={rank === 1 ? 'accent' : 'tertiary'} tabular style={styles.rank}>{rank}</Text>
        <Avatar name={name} seed={handle} />
        <Text variant="bodyStrong" style={styles.flex} numberOfLines={1}>{isMe ? 'Tú' : name}</Text>
        <Text variant="bodyStrong" tabular>{score}</Text>
      </View>
      <ProgressBar progress={progress} color={colorFor(handle)} />
      {detail ? <Text variant="caption" tone="tertiary">{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing[2], padding: spacing[3], borderRadius: radius.md },
  me: { backgroundColor: colors.accentMuted },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  rank: { width: 20, textAlign: 'center' },
  flex: { flex: 1 },
});
