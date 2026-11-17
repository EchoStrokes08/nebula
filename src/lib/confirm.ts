import { Alert, Platform } from 'react-native';
import { create } from 'zustand';

export interface PendingConfirm { title: string; message: string; action: string; onYes(): void }

/** Confirmación pendiente en escritorio; la muestra `ConfirmHost` con el estilo de Nebula. */
export const useConfirmStore = create<{ pending: PendingConfirm | null }>(() => ({ pending: null }));

/** Confirmación destructiva: diálogo nativo en Android y diálogo propio en escritorio. */
export function confirmAction(title: string, message: string, action: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    useConfirmStore.setState({ pending: { title, message, action, onYes } });
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: action, style: 'destructive', onPress: onYes },
  ]);
}
