export interface DesktopCaptureSource {
  id: string;
  name: string;
  thumbnail: string;
  appIcon: string | null;
  isScreen: boolean;
}

export interface ElectronGlobalAPI {
  isElectron: boolean;
  platform: string;
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  onMaximizedChange: (callback: (isMax: boolean) => void) => () => void;
  getScreenSources?: () => Promise<DesktopCaptureSource[]>;
}

declare global {
  interface Window {
    electronAPI?: ElectronGlobalAPI;
  }
}
