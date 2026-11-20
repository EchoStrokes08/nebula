import type { ComponentProps } from 'react';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { spacing } from '@/design/tokens';

/**
 * ScrollView que mantiene visible el campo enfocado por encima del teclado. Con edge-to-edge,
 * Android ya no encoge la ventana al abrir el teclado (adjustResize no basta), así que sin esto
 * el teclado tapa los campos y botones de la parte baja.
 */
export function KeyboardScroll({ bottomOffset = spacing[6], keyboardShouldPersistTaps = 'handled', ...rest }: ComponentProps<typeof KeyboardAwareScrollView>) {
  return <KeyboardAwareScrollView bottomOffset={bottomOffset} keyboardShouldPersistTaps={keyboardShouldPersistTaps} {...rest} />;
}
