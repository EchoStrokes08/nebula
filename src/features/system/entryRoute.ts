import type { Gate } from './gate';

/** Ruta a la que lleva `/` según el estado de la app. */
export function entryRoute(gate: Gate): '/hoy' | '/bienvenida' | '/bienvenido' | '/nueva-contrasena' | null {
  switch (gate) {
    case 'app':
    case 'preview':
      return '/hoy';
    case 'auth':
      return '/bienvenida';
    case 'onboarding':
      return '/bienvenido';
    case 'recovery':
      return '/nueva-contrasena';
    default:
      return null; // config/loading: el layout raíz ya muestra la pantalla adecuada
  }
}
