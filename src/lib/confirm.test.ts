import { Platform } from 'react-native';

import { confirmAction, useConfirmStore } from './confirm';

it.each(['web', 'android'])('en %s deja la confirmación pendiente para el diálogo de Nebula', (os) => {
  const original = Platform.OS;
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  const onYes = jest.fn();
  confirmAction('Eliminar', 'Seguro', 'Eliminar', onYes);
  expect(onYes).not.toHaveBeenCalled();
  expect(useConfirmStore.getState().pending?.title).toBe('Eliminar');
  expect(useConfirmStore.getState().pending?.destructive).toBe(true);
  useConfirmStore.getState().pending?.onYes();
  expect(onYes).toHaveBeenCalledTimes(1);
  useConfirmStore.setState({ pending: null });
  Object.defineProperty(Platform, 'OS', { value: original, configurable: true });
});
