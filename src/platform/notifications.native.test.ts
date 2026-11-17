import { toPermission } from './notifications.native';

jest.mock('expo-notifications', () => ({ AndroidImportance: { HIGH: 4, DEFAULT: 3 } }));

it('denied con posibilidad de volver a preguntar cuenta como sin decidir (Android 13+)', () => {
  expect(toPermission({ status: 'granted' })).toBe('granted');
  expect(toPermission({ status: 'denied', canAskAgain: true })).toBe('undetermined');
  expect(toPermission({ status: 'denied', canAskAgain: false })).toBe('denied');
  expect(toPermission({ status: 'undetermined' })).toBe('undetermined');
});
