import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { Text } from '@/components/primitives/Text';
import { colors, elevation, radius, spacing } from '@/design/tokens';

interface ToastState {
  message: string | null;
  onUndo: (() => void) | null;
  id: number;
  show(message: string, onUndo?: () => void): void;
  hide(): void;
}

export const useToast = create<ToastState>((set) => ({
  message: null,
  onUndo: null,
  id: 0,
  show: (message, onUndo) => set((s) => ({ message, onUndo: onUndo ?? null, id: s.id + 1 })),
  hide: () => set({ message: null, onUndo: null }),
}));

/** Aviso temporal (5 s) con «Deshacer» para acciones reversibles. */
export function UndoToast({ bottomOffset = 0 }: { bottomOffset?: number }) {
  const { message, onUndo, id, hide } = useToast();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(hide, 5000);
    return () => clearTimeout(t);
  }, [id, message, hide]);
  if (!message) return null;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + bottomOffset + spacing[4] }]}>
      <View style={styles.toast} accessibilityRole="alert" accessibilityLiveRegion="polite">
        <Text variant="callout" style={styles.flex}>
          {message}
        </Text>
        {onUndo ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Deshacer"
            hitSlop={10}
            onPress={() => {
              onUndo();
              hide();
            }}
          >
            <Text variant="bodyStrong" tone="accent">
              Deshacer
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing[4], right: spacing[4], alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    maxWidth: 480,
    width: '100%',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    ...elevation.high,
  },
  flex: { flex: 1 },
});
