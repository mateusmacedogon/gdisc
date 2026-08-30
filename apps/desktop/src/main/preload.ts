const { contextBridge, ipcRenderer } = require('electron');

export interface DesktopCaptureSource {
  id: string;
  name: string;
  thumbnail: string;
  appIcon: string | null;
  isScreen: boolean;
}

export interface ElectronAPI {
  isElectron: boolean;
  platform: string;
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  onMaximizedChange: (callback: (isMax: boolean) => void) => () => void;
  getScreenSources: () => Promise<DesktopCaptureSource[]>;
  selectScreenSource: (sourceId: string) => Promise<void>;
}

const electronAPI: ElectronAPI = {
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

  onMaximizedChange: (callback: (isMax: boolean) => void) => {
    const handler = (_event: any, isMax: boolean) => callback(isMax);
    ipcRenderer.on('window-maximized-state', handler);

    return () => {
      ipcRenderer.removeListener('window-maximized-state', handler);
    };
  },

  getScreenSources: () => {
    return ipcRenderer.invoke('get-screen-sources');
  },

  selectScreenSource: (sourceId: string) => {
    return ipcRenderer.invoke('select-screen-source', sourceId);
  },
};

try {
  contextBridge.exposeInMainWorld('electronAPI', electronAPI);
} catch (e) {
  (window as any).electronAPI = electronAPI;
}
