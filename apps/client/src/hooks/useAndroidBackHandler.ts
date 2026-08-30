import { useEffect } from 'react';
import { useUIStore } from '../stores/useUIStore.js';
import { wsClient } from '../services/ws.js';

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
    let cleanupStateListener: (() => void) | undefined;
    let cleanupLinkListener: (() => void) | undefined;

    const setupCapacitor = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;

        const { StatusBar, Style } = await import('@capacitor/status-bar');
        const { App } = await import('@capacitor/app');

        // Set status bar styling
        await StatusBar.setBackgroundColor({ color: '#0B0D12' });
        await StatusBar.setStyle({ style: Style.Light });

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
          // Follow Android navigation conventions and preserve an active call.
          void App.minimizeApp();
        });

        cleanupAppListener = () => {
          void handle.remove();
        };

        const appStateHandle = await App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) {
            void wsClient.ensureConnected().catch((error) => {
              console.warn('Falha ao restaurar conexão após retomar o aplicativo:', error);
            });
          }
        });
        cleanupStateListener = () => {
          void appStateHandle.remove();
        };

        const appUrlHandle = await App.addListener('appUrlOpen', ({ url }) => {
          const webInvite = url.match(/#invite=([^&]+)/i)?.[1];
          const nativeInvite = url.match(/^gdisc:\/\/invite\/?([^?#]+)/i)?.[1];
          const inviteCode = webInvite ?? nativeInvite;
          if (inviteCode) window.location.hash = `invite=${inviteCode}`;
        });
        cleanupLinkListener = () => {
          void appUrlHandle.remove();
        };
      } catch (err) {
        // Not on Capacitor or plugin not available
      }
    };

    void setupCapacitor();

    return () => {
      if (cleanupAppListener) cleanupAppListener();
      if (cleanupStateListener) cleanupStateListener();
      if (cleanupLinkListener) cleanupLinkListener();
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
