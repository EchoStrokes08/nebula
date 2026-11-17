import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Háptica en Android; en escritorio/web no existe y no hace nada (F01-017). */
export const platformHaptics = {
  success() {
    if (Platform.OS === 'web') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  tap() {
    if (Platform.OS === 'web') return;
    Haptics.selectionAsync().catch(() => {});
  },
};
