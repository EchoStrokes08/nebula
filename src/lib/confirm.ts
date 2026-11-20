import { create } from 'zustand';

export interface PendingConfirm { title: string; message: string; action: string; destructive: boolean; onYes(): void }

/** Confirmación pendiente; la muestra `ConfirmHost` con el estilo de Nebula en todas las plataformas. */
export const useConfirmStore = create<{ pending: PendingConfirm | null }>(() => ({ pending: null }));

/**
 * Confirmación con el diálogo propio de Nebula (no el `Alert` gris de Android ni el `confirm` del
 * navegador). Por defecto es destructiva: el botón de acción va en rojo.
 */
export function confirmAction(title: string, message: string, action: string, onYes: () => void, opts: { destructive?: boolean } = {}) {
  useConfirmStore.setState({ pending: { title, message, action, destructive: opts.destructive ?? true, onYes } });
}
