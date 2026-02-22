import { contextBridge, ipcRenderer, shell } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  saveToken: (token: string) => ipcRenderer.send('setup:save-token', token),
  openExternal: (url: string) => shell.openExternal(url),
});
