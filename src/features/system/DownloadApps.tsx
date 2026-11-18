import type { LucideIcon } from 'lucide-react-native';
import { Download, Info, Monitor, Smartphone } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import { getDesktopBridge } from '@/platform/desktopBridge';
import { apkUrl, linuxAppImageUrl, webBaseUrl, windowsInstallerUrl } from '@/lib/webBase';

type Target = 'android' | 'windows' | 'linux';

interface TargetInfo { url: string; icon: LucideIcon; name: string; detail: string; hint: string }

const TARGETS: Record<Target, TargetInfo> = {
  android: {
    url: apkUrl,
    icon: Smartphone,
    name: 'Android',
    detail: 'APK · 35 MB',
    hint: 'Ábrelo en el móvil y permite instalar apps de origen desconocido. ¿Tenías la 1.2.3 o anterior? Desinstálala antes, también del segundo espacio o espacio de seguridad si usas uno: cambió la firma de la app (tus datos vuelven al iniciar sesión).',
  },
  windows: {
    url: windowsInstallerUrl,
    icon: Monitor,
    name: 'Windows',
    detail: 'Instalador x64',
    hint: 'Si Windows avisa, pulsa «Más información» › «Ejecutar de todas formas».',
  },
  linux: {
    url: linuxAppImageUrl,
    icon: Monitor,
    name: 'Linux',
    detail: 'AppImage x86-64',
    hint: 'Dale permiso de ejecución (chmod +x) y ábrelo.',
  },
};

/** Sistema de quien visita la web, para destacar su descarga. */
export function detectTarget(ua: string): Target | null {
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod|mac os/i.test(ua)) return null;
  if (/windows/i.test(ua)) return 'windows';
  if (/linux|x11|cros/i.test(ua)) return 'linux';
  return null;
}

/** Última versión publicada (version.json en la misma web); null mientras carga o si falla. */
function usePublishedVersion() {
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`${webBaseUrl}/version.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { version?: unknown } | null) => { if (live && typeof j?.version === 'string') setVersion(j.version); })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  return version;
}

/**
 * Solo en la versión web del navegador: descarga destacada para el sistema de quien visita y
 * enlaces a las demás plataformas.
 */
export function DownloadApps({ compact }: { compact?: boolean }) {
  const version = usePublishedVersion();
  if (Platform.OS !== 'web' || getDesktopBridge()) return null;
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const main = detectTarget(ua);
  const others = (Object.keys(TARGETS) as Target[]).filter((t) => t !== main);
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text variant="overline" tone="secondary">DESCARGA LA APP</Text>
        {version ? <View style={styles.badge}><Text variant="caption" style={styles.badgeText}>v{version}</Text></View> : null}
      </View>
      {main ? <Featured target={main} compact={compact} /> : null}
      <View style={styles.row}>
        {others.map((t) => <Chip key={t} target={t} />)}
      </View>
    </View>
  );
}

function Featured({ target, compact }: { target: Target; compact?: boolean }) {
  const t = TARGETS[target];
  const Icon = t.icon;
  return (
    <View style={styles.featuredWrap}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Descargar la app para ${t.name}`}
        onPress={() => void Linking.openURL(t.url)}
        style={({ hovered, pressed }: { hovered?: boolean; pressed?: boolean }) => [styles.featured, (hovered || pressed) && styles.featuredHover]}
      >
        <View style={styles.featuredIcon}><Icon size={22} color={colors.textOnAccent} /></View>
        <View style={styles.flex}>
          <Text variant="bodyStrong" style={styles.onAccent}>Descargar para {t.name}</Text>
          <Text variant="caption" style={styles.onAccentSoft}>{t.detail} · gratis</Text>
        </View>
        <Download size={20} color={colors.textOnAccent} />
      </Pressable>
      {compact ? null : (
        <View style={styles.hint}>
          <Info size={14} color={colors.textTertiary} />
          <Text variant="caption" tone="tertiary" style={styles.flex}>{t.hint}</Text>
        </View>
      )}
    </View>
  );
}

function Chip({ target }: { target: Target }) {
  const t = TARGETS[target];
  const Icon = t.icon;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Descargar la app para ${t.name}`}
      onPress={() => void Linking.openURL(t.url)}
      style={({ hovered }: { hovered?: boolean }) => [styles.chip, hovered && styles.chipHover]}
    >
      <Icon size={16} color={colors.accentSoft} />
      <View>
        <Text variant="callout">{t.name}</Text>
        <Text variant="caption" tone="tertiary">{t.detail}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[3] },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  badge: { paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.accentMuted, borderWidth: 1, borderColor: colors.borderStrong },
  badgeText: { color: colors.accentSoft },
  featuredWrap: { gap: spacing[2] },
  featured: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[3], paddingHorizontal: spacing[4],
    borderRadius: radius.lg, backgroundColor: colors.accent,
    shadowColor: colors.accent, shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 6 },
  },
  featuredHover: { backgroundColor: colors.accentPressed },
  featuredIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 255, 255, 0.16)' },
  onAccent: { color: colors.textOnAccent },
  onAccentSoft: { color: 'rgba(255, 255, 255, 0.78)' },
  hint: { flexDirection: 'row', gap: spacing[2], alignItems: 'flex-start', paddingHorizontal: spacing[1] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: {
    flexGrow: 1, flexBasis: 120, flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[2], paddingHorizontal: spacing[3],
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.card,
  },
  chipHover: { borderColor: colors.accentBright },
  flex: { flex: 1 },
});
