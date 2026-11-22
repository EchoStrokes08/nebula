import type { UpdateOffer } from './update';

/**
 * Fases del aviso de versión nueva:
 * - available: detectada; se descarga sola salvo con datos móviles o si no hay instalación automática.
 * - downloading: descargando en segundo plano.
 * - ready: escritorio, descargada y aplicada al cerrar o con «Reiniciar ahora».
 * - readySilent: Android 12+, se instalará sola al salir de la app.
 * - readyConfirm: Android, descargada; hace falta confirmar una vez en el diálogo del sistema.
 * - confirming: el diálogo del sistema está abierto.
 * - installing / error.
 */
export type UpdatePhase = 'available' | 'downloading' | 'ready' | 'readySilent' | 'readyConfirm' | 'confirming' | 'installing' | 'error';
export type UpdatePlatform = 'android' | 'linux' | 'windows';

export interface UpdateCopy { title: string; body: string; action: string | null; canHide: boolean; hideLabel: string }

export function updateCopy(phase: UpdatePhase, platform: UpdatePlatform, offer: Pick<UpdateOffer, 'current' | 'notes'>): UpdateCopy {
  const notes = offer.notes || `Tienes la ${offer.current}. Actualiza para tener las últimas mejoras.`;
  const desktop = platform !== 'android';
  switch (phase) {
    case 'downloading':
      return { title: 'disponible', body: 'Descargando en segundo plano. Puedes seguir usando Nebula.', action: null, canHide: true, hideLabel: 'Ocultar' };
    case 'ready':
      return platform === 'windows'
        ? { title: 'lista', body: 'Se instalará sola al cerrar Nebula. Tus datos se conservan.', action: 'Reiniciar ahora', canHide: true, hideLabel: 'Ocultar' }
        : { title: 'lista', body: 'Se usará la próxima vez que abras Nebula. Tus datos se conservan.', action: 'Reiniciar ahora', canHide: true, hideLabel: 'Ocultar' };
    case 'readySilent':
      return { title: 'lista', body: 'Se instalará sola cuando salgas de Nebula. Tus datos se conservan.', action: 'Instalar ahora', canHide: true, hideLabel: 'Ocultar' };
    case 'readyConfirm':
      return { title: 'lista para instalar', body: 'Confírmala una vez en Android: desde Android 12, las próximas se instalarán solas.', action: 'Instalar', canHide: true, hideLabel: 'Más tarde' };
    case 'confirming':
      return { title: 'lista para instalar', body: 'Confirma «Actualizar» en el instalador de Android. Tus datos se conservan.', action: 'Abrir instalador otra vez', canHide: false, hideLabel: '' };
    case 'installing':
      return { title: 'instalándose', body: desktop ? 'Nebula se reiniciará sola en unos segundos.' : 'Nebula se cerrará y quedará actualizada. Vuelve a abrirla en unos segundos.', action: null, canHide: false, hideLabel: '' };
    case 'error':
      return { title: 'disponible', body: 'No se pudo actualizar. Reintenta o descárgala desde la web.', action: 'Reintentar', canHide: true, hideLabel: 'Más tarde' };
    case 'available':
    default:
      return { title: 'disponible', body: notes, action: 'Actualizar', canHide: true, hideLabel: 'Más tarde' };
  }
}
