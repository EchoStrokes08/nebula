import { router } from 'expo-router';
import { TabList, Tabs, TabSlot, TabTrigger } from 'expo-router/ui';
import { useEffect } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NavItem } from '@/components/navigation/NavItem';
import { QuickCreate } from '@/components/navigation/QuickCreate';
import { navLayoutFor, sections } from '@/components/navigation/sections';
import { Text } from '@/components/primitives/Text';
import { glassBlur } from '@/components/primitives/Card';
import { QuickActions } from '@/platform/QuickActions';
import { colors, hitTarget, spacing } from '@/design/tokens';
import { useSocialRealtime } from '@/features/notifications/realtime';
import { useReminderSync } from '@/features/notifications/useReminderSync';
import { useTimezoneSync } from '@/features/profile/useTimezoneSync';

/** Atajos de escritorio: Ctrl+1…5 cambia de sección. */
function useSectionShortcuts(enabled: boolean) {
  useEffect(() => {
    if (!enabled || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      if (e.key.toLowerCase() === 'k') { e.preventDefault(); router.push('/captura'); return; }
      const index = Number(e.key) - 1;
      const section = sections[index];
      if (section) {
        e.preventDefault();
        router.navigate(section.href);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}

export default function TabsLayout() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const layout = navLayoutFor(width);
  const sidebar = layout === 'sidebar';
  useSectionShortcuts(Platform.OS === 'web');
  useTimezoneSync();
  useReminderSync();
  useSocialRealtime();

  return (
    <Tabs style={sidebar ? styles.row : styles.column}>
      {sidebar ? (
        // TabList debe ser hijo directo de Tabs para que los triggers reciban `isFocused`.
        <TabList style={styles.sidebar} role="navigation" aria-label="Secciones">
          <View style={styles.brand}>
            <View style={styles.brandMark} />
            <Text variant="title2" style={styles.brandText}>Nebula</Text>
          </View>
          <QuickCreate layout="sidebar" />
          {sections.map((s, i) => (
            <TabTrigger key={s.name} name={s.name} href={s.href} asChild>
              <NavItem section={s} layout="sidebar" shortcut={`Ctrl ${i + 1}`} />
            </TabTrigger>
          ))}
        </TabList>
      ) : null}
      <QuickActions />
      <TabSlot style={styles.slot} />
      {!sidebar ? <View pointerEvents="box-none" style={[styles.fabLayer, { bottom: hitTarget + 8 + Math.max(insets.bottom, spacing[2]) + spacing[4] }]}><QuickCreate layout="floating" /></View> : null}
      {!sidebar ? (
        <TabList
          style={[styles.bottomBar, glassBlur, { marginBottom: Math.max(insets.bottom, spacing[2]) }]}
          accessibilityRole="tablist"
        >
          {sections.map((s) => (
            <TabTrigger key={s.name} name={s.name} href={s.href} asChild>
              <NavItem section={s} layout="bottom" />
            </TabTrigger>
          ))}
        </TabList>
      ) : null}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row' },
  column: { flex: 1 },
  slot: { flex: 1 },
  fabLayer: { position: 'absolute', right: 0, left: 0, height: 0 },
  sidebar: {
    width: 232,
    paddingHorizontal: spacing[3],
    paddingTop: spacing[6],
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
    backgroundColor: 'rgba(16, 13, 28, 0.72)',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    gap: spacing[1],
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    marginBottom: spacing[5],
  },
  brandMark: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  brandText: { letterSpacing: -0.6 },
  bottomBar: {
    flexDirection: 'row',
    marginHorizontal: spacing[3],
    paddingHorizontal: spacing[1],
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(20, 15, 36, 0.9)',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
});
