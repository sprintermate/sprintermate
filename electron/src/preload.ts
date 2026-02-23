import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  saveToken: (token: string) => ipcRenderer.send('setup:save-token', token),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  copyText: (text: string) => ipcRenderer.invoke('copy-text', text),
  onLoadingUpdate: (cb: (msg: string) => void) => {
    ipcRenderer.on('loading:update', (_e, msg: string) => cb(msg));
  },
  onReady: (cb: (url: string, local: string) => void) => {
    ipcRenderer.on('app:ready', (_e, url: string, local: string) => cb(url, local));
  },
  onError: (cb: (msg: string) => void) => {
    ipcRenderer.on('app:error', (_e, msg: string) => cb(msg));
  },
});
