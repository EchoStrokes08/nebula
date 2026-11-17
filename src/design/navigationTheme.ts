import { DarkTheme } from 'expo-router';

import { colors } from './tokens';

/** Tema de navegación: fondo transparente para que se vea el fondo espacial. */
export const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accentBright,
    background: 'transparent',
    card: colors.bgAlt,
    text: colors.text,
    border: colors.border,
    notification: colors.accent,
  },
};
