import type { LucideIcon } from 'lucide-react-native';
import { Download, Monitor, Smartphone } from 'lucide-react-native';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import { getDesktopBridge } from '@/platform/desktopBridge';
import { apkUrl, linuxAppImageUrl } from '@/lib/webBase';

/** Solo en la versión web del navegador: enlaces para instalar la app de Android y la de Linux. */
export function DownloadApps({ compact }: { compact?: boolean }) {
  if (Platform.OS !== 'web' || getDesktopBridge()) return null;
  return (
    <View style={styles.list}>
      <DownloadLink
        url={apkUrl}
        icon={Smartphone}
        title="Descargar para Android"
        label="Descargar la app para Android"
        hint={compact ? null : 'APK gratuito · ábrelo en el móvil y permite instalar apps de origen desconocido'}
      />
      <DownloadLink
        url={linuxAppImageUrl}
        icon={Monitor}
        title="Descargar para Linux"
        label="Descargar la app para Linux"
        hint={compact ? null : 'AppImage x86-64 · dale permiso de ejecución (chmod +x) y ábrelo'}
      />
    </View>
  );
}

function DownloadLink({ url, icon: Icon, title, label, hint }: { url: string; icon: LucideIcon; title: string; label: string; hint: string | null }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => void Linking.openURL(url)}
      style={({ hovered }: { hovered?: boolean }) => [styles.root, hovered && styles.hover]}
    >
      <View style={styles.icon}><Icon size={20} color={colors.success} /></View>
      <View style={styles.flex}>
        <Text variant="bodyStrong">{title}</Text>
        {hint ? <Text variant="caption" tone="secondary">{hint}</Text> : null}
      </View>
      <Download size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing[2] },
  root: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[4], borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(111, 214, 160, 0.35)', backgroundColor: colors.successMuted },
  hover: { borderColor: colors.success },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(11, 8, 21, 0.4)' },
  flex: { flex: 1, gap: 2 },
});
