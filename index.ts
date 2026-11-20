// Entrada de la app: Expo Router y, en Android, el manejador del widget de pantalla de inicio,
// que debe registrarse antes de montar nada porque también se ejecuta con la app cerrada.
import 'expo-router/entry';

import { registerWidgets } from '@/platform/widget';

registerWidgets();
