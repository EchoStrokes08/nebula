import { Download, Smartphone } from 'lucide-react-native';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import { getDesktopBridge } from '@/platform/desktopBridge';
import { apkUrl } from '@/lib/webBase';

/** Solo en la versión web del navegador: enlace para instalar la app de Android. */
export function DownloadApk({ compact }: { compact?: boolean }) {
  if (Platform.OS !== 'web' || getDesktopBridge()) return null;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="Descargar la app para Android"
      onPress={() => void Linking.openURL(apkUrl)}
      style={({ hovered }: { hovered?: boolean }) => [styles.root, hovered && styles.hover]}
    >
      <View style={styles.icon}><Smartphone size={20} color={colors.success} /></View>
      <View style={styles.flex}>
        <Text variant="bodyStrong">Descargar para Android</Text>
        {!compact ? <Text variant="caption" tone="secondary">APK gratuito · ábrelo en el móvil y permite instalar apps de origen desconocido</Text> : null}
      </View>
      <Download size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[4], borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(111, 214, 160, 0.35)', backgroundColor: colors.successMuted },
  hover: { borderColor: colors.success },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(11, 8, 21, 0.4)' },
  flex: { flex: 1, gap: 2 },
});
