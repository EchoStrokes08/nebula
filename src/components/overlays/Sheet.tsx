import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/primitives/Text';
import { colors, fontFamily, radius, spacing } from '@/design/tokens';

/**
 * Altura del teclado en Android. Dentro de un `Modal` (y con edge-to-edge) la ventana no se
 * redimensiona al abrir el teclado, así que la hoja se sube a mano para no quedar tapada.
 */
export function useAndroidKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return height;
}

/** Hoja inferior en Android / modal centrado en escritorio (DISENO_UI_UX §3). `Esc` cierra en escritorio. */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose(): void; title: string; children: ReactNode }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const keyboard = useAndroidKeyboardHeight();
  const centered = width >= 900;
  return (
    <Modal visible={visible} transparent animationType={centered ? 'fade' : 'slide'} onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.backdrop, centered && styles.backdropCentered]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cerrar" accessibilityRole="button" />
          <View
            style={[
              styles.sheet,
              centered ? styles.sheetCentered : { paddingBottom: (keyboard ? spacing[4] : insets.bottom + spacing[5]), marginBottom: keyboard, maxHeight: height - keyboard - insets.top - spacing[4] },
            ]}
            accessibilityViewIsModal
          >
            {!centered ? <View style={styles.grabber} /> : null}
            <Text accessibilityRole="header" style={styles.title}>
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
  title: { fontFamily: fontFamily.serif, fontSize: 28, lineHeight: 32, color: colors.text },
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
