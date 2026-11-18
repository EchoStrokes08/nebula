import { ExternalLink as LinkIcon } from 'lucide-react-native';
import { Linking, Pressable, StyleSheet } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { colors, spacing } from '@/design/tokens';

const URL_RE = /(https:\/\/[^\s)]+)/g;

/** Abre en el navegador del sistema (en Electron, `setWindowOpenHandler` lo manda fuera). */
export const openLink = (url: string) => { if (/^https:\/\//.test(url)) void Linking.openURL(url).catch(() => undefined); };

export function ExternalLink({ url, label }: { url: string; label: string }) {
  return (
    <Pressable onPress={() => openLink(url)} accessibilityRole="link" accessibilityLabel={`${label}, abre ${url}`} style={styles.row} hitSlop={4}>
      <LinkIcon size={14} color={colors.accentSoft} />
      <Text variant="callout" tone="accent" style={styles.flex} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

/** Texto plano con los enlaces https pulsables (notas de tareas y descripciones de metas). */
export function LinkifiedText({ children, tone = 'secondary' }: { children: string; tone?: 'secondary' | 'primary' }) {
  const parts = children.split(URL_RE);
  return (
    <Text tone={tone}>
      {parts.map((p, i) => (i % 2 === 1
        ? <Text key={i} tone="accent" style={styles.underline} accessibilityRole="link" onPress={() => openLink(p)}>{p}</Text>
        : p))}
    </Text>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  flex: { flex: 1 },
  underline: { textDecorationLine: 'underline' },
});
