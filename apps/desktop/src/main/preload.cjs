const { contextBridge, ipcRenderer } = require('electron');

const electronAPI = {
  isElectron: true,
  platform: process.platform,

  minimize: () => {
    ipcRenderer.send('window-minimize');
  },

  maximize: () => {
    ipcRenderer.send('window-maximize');
  },

  close: () => {
    ipcRenderer.send('window-close');
  },

  isMaximized: () => {
    return ipcRenderer.invoke('window-is-maximized');
  },

  onMaximizedChange: (callback) => {
    const handler = (_event, isMax) => callback(isMax);
    ipcRenderer.on('window-maximized-state', handler);

    return () => {
      ipcRenderer.removeListener('window-maximized-state', handler);
    };
  },

  getScreenSources: () => {
    return ipcRenderer.invoke('get-screen-sources');
  },
};

try {
  contextBridge.exposeInMainWorld('electronAPI', electronAPI);
} catch (e) {
  // Fallback for direct window assignment if contextBridge not available
  window.electronAPI = electronAPI;
}
