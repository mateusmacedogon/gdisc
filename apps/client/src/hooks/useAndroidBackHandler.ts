import { useEffect } from 'react';
import { useUIStore } from '../stores/useUIStore.js';

export const useAndroidBackHandler = () => {
  const {
    activeModal,
    closeModal,
    isMobileSidebarOpen,
    closeMobileSidebar,
    isMobileMemberListOpen,
    closeMobileMemberList,
  } = useUIStore();

  useEffect(() => {
    // Dynamic import to support both web and Capacitor mobile environments seamlessly
    let cleanupAppListener: (() => void) | undefined;

    const setupCapacitor = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;

        const { StatusBar, Style } = await import('@capacitor/status-bar');
        const { App } = await import('@capacitor/app');

        // Set status bar styling
        await StatusBar.setBackgroundColor({ color: '#0B0D12' });
        await StatusBar.setStyle({ style: Style.Dark });

        // Handle Android hardware back button
        const handle = await App.addListener('backButton', () => {
          if (activeModal) {
            closeModal();
            return;
          }
          if (isMobileMemberListOpen) {
            closeMobileMemberList();
            return;
          }
          if (isMobileSidebarOpen) {
            closeMobileSidebar();
            return;
          }
          void App.exitApp();
        });

        cleanupAppListener = () => {
          void handle.remove();
        };
      } catch (err) {
        // Not on Capacitor or plugin not available
      }
    };

    void setupCapacitor();

    return () => {
      if (cleanupAppListener) cleanupAppListener();
    };
  }, [
    activeModal,
    closeModal,
    isMobileSidebarOpen,
    closeMobileSidebar,
    isMobileMemberListOpen,
    closeMobileMemberList,
  ]);
};
