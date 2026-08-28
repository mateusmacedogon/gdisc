import React, { useEffect } from 'react';
import { useAuthStore } from './stores/useAuthStore.js';
import { AuthPage } from './components/auth/AuthPage.js';
import { AppLayout } from './components/layout/AppLayout.js';
import { Radio } from 'lucide-react';

export const App: React.FC = () => {
  const { isAuthenticated, isLoading, initAuth } = useAuthStore();

  useEffect(() => {
    initAuth();
  }, []);

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gdisc-bg-primary text-gdisc-text-primary select-none">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-gdisc-brand-primary to-gdisc-brand-secondary flex items-center justify-center shadow-gdisc-glow mb-4 animate-pulse">
          <Radio className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-lg font-bold tracking-tight">GDisC</h2>
        <p className="text-xs text-gdisc-text-muted mt-1">Carregando ambiente em tempo real...</p>
      </div>
    );
  }

  return isAuthenticated ? <AppLayout /> : <AuthPage />;
};

export default App;
