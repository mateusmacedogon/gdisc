/**
 * Platform detection helper
 */

export const isElectron =
  typeof window !== 'undefined' && Boolean((window as any).electronAPI);

export const isCapacitor =
  typeof window !== 'undefined' &&
  Boolean((window as any).Capacitor?.isNativePlatform?.());

export const isWeb = !isElectron && !isCapacitor;

export const isMobileDevice =
  typeof navigator !== 'undefined' &&
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
