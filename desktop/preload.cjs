// Puente mínimo entre el renderer (sandbox, sin Node) y el proceso principal.
// Contrato tipado en src/platform/desktopBridge.ts.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nebulaDesktop', {
  platform: process.platform,
  settings: { get: () => ipcRenderer.invoke('settings:get'), set: (patch) => ipcRenderer.invoke('settings:set', patch) },
  secureStore: {
    get: (key) => ipcRenderer.invoke('secure:get', key),
    set: (key, value) => ipcRenderer.invoke('secure:set', key, value),
    remove: (key) => ipcRenderer.invoke('secure:remove', key),
  },
  notify: (options) => ipcRenderer.invoke('notify', options),
  focus: { openMini: () => ipcRenderer.invoke('focus:mini'), openMain: () => ipcRenderer.invoke('focus:openMain') },
  schedule: (n) => ipcRenderer.invoke('notify:schedule', n),
  cancel: (id) => ipcRenderer.invoke('notify:cancel', id),
  cancelPrefix: (prefix) => ipcRenderer.invoke('notify:cancelPrefix', prefix),
  update: { check: () => ipcRenderer.invoke('update:check'), install: () => ipcRenderer.invoke('update:install') },
  oauth: {
    listen: () => ipcRenderer.invoke('oauth:listen'),
    open: (authUrl) => ipcRenderer.invoke('oauth:open', authUrl),
  },
});
