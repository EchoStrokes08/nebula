import { createWebSecureStorage } from './secureStorage.web';

describe('almacenamiento seguro en escritorio', () => {
  afterEach(() => {
    globalThis.nebulaDesktop = undefined;
  });

  it('delega en el puente de Electron cuando existe', async () => {
    const store = new Map<string, string>();
    globalThis.nebulaDesktop = {
      platform: 'linux',
      settings: { get: async () => ({ minimizeToTray: false, startWithSystem: false, globalShortcut: '', canStartWithSystem: false, trayAvailable: false, shortcutActive: false }), set: async () => {} },
      focus: { openMini: async () => {}, openMain: async () => {} },
      secureStore: {
        get: async (k) => store.get(k) ?? null,
        set: async (k, v) => {
          store.set(k, v);
          return { persisted: true };
        },
        remove: async (k) => void store.delete(k),
      },
      notify: async () => {},
      schedule: async () => {},
      cancel: async () => {},
      cancelPrefix: async () => {},
      oauth: { listen: async () => '', open: async () => null },
    };
    const s = createWebSecureStorage();
    await s.setItem('sb-session', 'token');
    expect(store.get('sb-session')).toBe('token');
    expect(await s.getItem('sb-session')).toBe('token');
    await s.removeItem('sb-session');
    expect(await s.getItem('sb-session')).toBeNull();
  });
});
