import { Platform } from 'react-native';

import { confirmAction, useConfirmStore } from './confirm';

it('en escritorio deja la confirmación pendiente sin ejecutar la acción', () => {
  const original = Platform.OS;
  Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
  const onYes = jest.fn();
  confirmAction('Eliminar', 'Seguro', 'Eliminar', onYes);
  expect(onYes).not.toHaveBeenCalled();
  expect(useConfirmStore.getState().pending?.title).toBe('Eliminar');
  useConfirmStore.getState().pending?.onYes();
  expect(onYes).toHaveBeenCalledTimes(1);
  Object.defineProperty(Platform, 'OS', { value: original, configurable: true });
});
