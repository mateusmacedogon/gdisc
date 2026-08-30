/** Cross-platform runtime and browser capability helpers. */

export type RuntimePlatform = 'electron' | 'capacitor' | 'mobile-web' | 'web';

export const isElectron =
  typeof window !== 'undefined' &&
  (Boolean(window.electronAPI) || /Electron|GDisC-Desktop/i.test(navigator.userAgent));

export const isCapacitor =
  typeof window !== 'undefined' &&
  Boolean((window as Window & { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor?.isNativePlatform?.());

export const isMobileDevice =
  typeof navigator !== 'undefined' &&
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );

export const isWeb = !isElectron && !isCapacitor;

export const runtimePlatform: RuntimePlatform = isElectron
  ? 'electron'
  : isCapacitor
    ? 'capacitor'
    : isMobileDevice
      ? 'mobile-web'
      : 'web';

export const platformCapabilities = {
  get camera(): boolean {
    return typeof navigator !== 'undefined' &&
      typeof navigator.mediaDevices?.getUserMedia === 'function';
  },
  get screenShare(): boolean {
    if (isCapacitor) return false;
    return isElectron
      ? Boolean(window.electronAPI?.getScreenSources)
      : typeof navigator !== 'undefined' &&
          typeof navigator.mediaDevices?.getDisplayMedia === 'function';
  },
  get audioOutputSelection(): boolean {
    return typeof HTMLMediaElement !== 'undefined' &&
      typeof (HTMLMediaElement.prototype as HTMLMediaElement & {
        setSinkId?: (deviceId: string) => Promise<void>;
      }).setSinkId === 'function';
  },
  get fullscreen(): boolean {
    return typeof document !== 'undefined' &&
      typeof document.documentElement.requestFullscreen === 'function';
  },
};

export const getPublicAppUrl = (): string => {
  const configured = (import.meta as ImportMeta & {
    readonly env?: Record<string, string | undefined>;
  }).env?.VITE_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');

  if (typeof window !== 'undefined' && /^https?:$/.test(window.location.protocol)) {
    const isNativeLocalhost = isCapacitor && /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
    if (!isNativeLocalhost) return window.location.origin;
  }

  return 'https://gdisc-client.vercel.app';
};
