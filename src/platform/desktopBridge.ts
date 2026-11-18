/**
 * Contrato del puente expuesto por el preload de Electron (`desktop/preload.cjs`).
 * Solo existe en el escritorio; en Android y en un navegador normal es `undefined`.
 */
export interface NebulaDesktopBridge {
  platform: 'win32' | 'linux' | 'darwin';
  settings: {
    get(): Promise<{ minimizeToTray: boolean; startWithSystem: boolean; globalShortcut: string; canStartWithSystem: boolean; trayAvailable: boolean; shortcutActive: boolean }>;
    set(patch: { minimizeToTray?: boolean; startWithSystem?: boolean; globalShortcut?: string }): Promise<unknown>;
  };
  /** Mini-ventana de enfoque siempre visible y vuelta a la ventana principal. */
  focus: { openMini(): Promise<void>; openMain(): Promise<void> };
  secureStore: {
    get(key: string): Promise<string | null>;
    /** `persisted: false` si el sistema no ofrece cifrado: el valor vive solo en memoria. */
    set(key: string, value: string): Promise<{ persisted: boolean }>;
    remove(key: string): Promise<void>;
  };
  notify(options: { title: string; body: string }): Promise<void>;
  /** Programa una notificación en el proceso principal (sobrevive a minimizar la ventana). */
  schedule(n: { id: string; title: string; body: string; at: number; route?: string }): Promise<void>;
  cancel(id: string): Promise<void>;
  cancelPrefix(prefix: string): Promise<void>;
  /** Versión nueva publicada (null si no hay) e instalación: en Linux con AppImage se sustituye y reinicia. */
  update?: {
    check(): Promise<{ current: string; latest: string; notes: string; canInstall: boolean } | null>;
    install(): Promise<{ status: 'restarting' | 'opened' | 'busy' | 'error'; message?: string }>;
  };
  oauth: {
    /** Arranca el servidor de retorno y devuelve su URL (`http://127.0.0.1:<puerto>/auth/callback`). */
    listen(): Promise<string>;
    /** Abre el navegador del sistema y resuelve con la URL de retorno, o null si se cancela/caduca. */
    open(authUrl: string): Promise<string | null>;
  };
}

declare global {
  var nebulaDesktop: NebulaDesktopBridge | undefined;
}

export function getDesktopBridge(): NebulaDesktopBridge | undefined {
  return typeof globalThis !== 'undefined' ? globalThis.nebulaDesktop : undefined;
}

export const isDesktop = (): boolean => getDesktopBridge() !== undefined;
