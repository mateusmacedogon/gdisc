import { useEffect } from 'react';
import { useVoiceStore } from '../stores/useVoiceStore.js';
import { useUIStore } from '../stores/useUIStore.js';

export const useGlobalShortcuts = () => {
  const { activeVoiceChannelId, toggleMute, toggleDeaf } = useVoiceStore();
  const { activeModal, closeModal, isMobileSidebarOpen, closeMobileSidebar } = useUIStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input/textarea
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if (e.key === 'Escape') {
        if (activeModal) {
          closeModal();
          return;
        }
        if (isMobileSidebarOpen) {
          closeMobileSidebar();
          return;
        }
      }

      const isModifier = e.ctrlKey || e.metaKey;

      // Ctrl + K: Quick Switcher (works even inside inputs)
      if (isModifier && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        useUIStore.getState().openModal('quick_switcher');
        return;
      }

      if (isInput) return;

      // Ctrl + M: Toggle Mute
      if (isModifier && !e.shiftKey && (e.key === 'm' || e.key === 'M')) {
        if (activeVoiceChannelId) {
          e.preventDefault();
          toggleMute();
        }
      }

      // Ctrl + Shift + D: Toggle Deafen
      if (isModifier && e.shiftKey && (e.key === 'd' || e.key === 'D')) {
        if (activeVoiceChannelId) {
          e.preventDefault();
          toggleDeaf();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeVoiceChannelId, activeModal, isMobileSidebarOpen, toggleMute, toggleDeaf, closeModal, closeMobileSidebar]);
};
