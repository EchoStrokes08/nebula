import { ConfirmDialog } from '@/components/overlays/ConfirmDialog';
import { useConfirmStore } from '@/lib/confirm';

/** Muestra las confirmaciones pedidas con `confirmAction` en escritorio. */
export function ConfirmHost() {
  const pending = useConfirmStore((s) => s.pending);
  const close = () => useConfirmStore.setState({ pending: null });
  return (
    <ConfirmDialog
      visible={!!pending}
      title={pending?.title ?? ''}
      message={pending?.message ?? ''}
      confirmLabel={pending?.action ?? 'Confirmar'}
      onCancel={close}
      onConfirm={() => { const p = pending; close(); p?.onYes(); }}
    />
  );
}
