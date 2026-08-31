'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('alexDesktop', {
  isDesktop: true,
  getBuildInfo: () => ipcRenderer.invoke('code-update-build-info'),
  checkCodePatch: () => ipcRenderer.invoke('code-patch-check'),
  installCodePatch: () => ipcRenderer.invoke('code-patch-install'),
  checkCodeUpdate: () => ipcRenderer.invoke('code-update-check'),
  downloadCodeUpdate: () => ipcRenderer.invoke('code-update-download'),
  applyCodeUpdate: () => ipcRenderer.invoke('code-update-apply'),
  onDownloadProgress: (cb) => {
    const listener = (_event, payload) => cb(payload);
    ipcRenderer.on('code-update-progress', listener);
    return () => ipcRenderer.removeListener('code-update-progress', listener);
  },
});
