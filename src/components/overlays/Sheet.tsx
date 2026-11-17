import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';

/** Hoja inferior en Android / modal centrado en escritorio (DISENO_UI_UX §3). `Esc` cierra en escritorio. */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose(): void; title: string; children: ReactNode }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const centered = width >= 900;
  return (
    <Modal visible={visible} transparent animationType={centered ? 'fade' : 'slide'} onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.backdrop, centered && styles.backdropCentered]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cerrar" accessibilityRole="button" />
          <View
            style={[styles.sheet, centered ? styles.sheetCentered : { paddingBottom: insets.bottom + spacing[5] }]}
            accessibilityViewIsModal
          >
            {!centered ? <View style={styles.grabber} /> : null}
            <Text variant="title3" accessibilityRole="header">
              {title}
            </Text>
            {children}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  backdropCentered: { justifyContent: 'center', alignItems: 'center' },
  sheet: {
    gap: spacing[4],
    padding: spacing[5],
    backgroundColor: colors.surfaceRaised,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sheetCentered: { width: 480, maxWidth: '92%', borderRadius: radius.xl },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong },
});
