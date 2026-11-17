import { create } from 'zustand';

/**
 * Vista de columnas (lista + detalle) de escritorio ancho (F02-019). Cuando una lista está en
 * modo columnas, sus filas seleccionan en lugar de navegar.
 */
export const SPLIT_MIN_WIDTH = 1100;
type Kind = 'habit' | 'task';
interface SplitState { active: Record<Kind, boolean>; selected: Record<Kind, string | null> }
export const useSplit = create<SplitState>(() => ({ active: { habit: false, task: false }, selected: { habit: null, task: null } }));

export function setSplitActive(kind: Kind, active: boolean) {
  useSplit.setState((s) => ({ active: { ...s.active, [kind]: active }, selected: active ? s.selected : { ...s.selected, [kind]: null } }));
}
export function selectInSplit(kind: Kind, id: string | null) {
  useSplit.setState((s) => ({ selected: { ...s.selected, [kind]: id } }));
}
/** Abre un elemento: lo selecciona si su lista está en columnas; si no, devuelve `false` para navegar. */
export function openInSplit(kind: Kind, id: string): boolean {
  if (!useSplit.getState().active[kind]) return false;
  selectInSplit(kind, id);
  return true;
}
