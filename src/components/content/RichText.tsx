import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { colors, spacing } from '@/design/tokens';

/** Divide «**negrita**» en fragmentos. */
function inline(line: string, key: string) {
  return line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <Text key={`${key}-${i}`} variant="bodyStrong" style={styles.strong}>{part.slice(2, -2)}</Text>
      : part,
  );
}

/** Markdown mínimo y seguro para respuestas del asistente: párrafos, listas y negritas. */
export function RichText({ children }: { children: string }) {
  const blocks = children.replace(/\r/g, '').split(/\n{2,}/);
  return (
    <View style={styles.root}>
      {blocks.map((block, b) => {
        const lines = block.split('\n').filter((l) => l.trim());
        const isList = lines.length > 0 && lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l));
        if (isList) {
          return (
            <View key={b} style={styles.list}>
              {lines.map((l, i) => {
                const m = /^\s*([-*•]|\d+[.)])\s+(.*)$/.exec(l)!;
                const bullet = /\d/.test(m[1]!) ? m[1]! : '•';
                return (
                  <View key={i} style={styles.item}>
                    <Text style={styles.bullet}>{bullet}</Text>
                    <Text style={styles.flex}>{inline(m[2]!.replace(/^#+\s*/, ''), `${b}-${i}`)}</Text>
                  </View>
                );
              })}
            </View>
          );
        }
        const heading = /^#{1,4}\s+/.test(block);
        return (
          <Text key={b} variant={heading ? 'title3' : 'body'}>
            {inline(block.replace(/^#{1,4}\s+/, ''), String(b))}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[2] },
  list: { gap: spacing[1] },
  item: { flexDirection: 'row', gap: spacing[2] },
  bullet: { color: colors.accentSoft, minWidth: 14 },
  flex: { flex: 1 },
  strong: { color: colors.accentSoft },
});
