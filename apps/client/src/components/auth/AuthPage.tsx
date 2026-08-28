import React, { useState } from 'react';
import { useAuthStore } from '../../stores/useAuthStore.js';
import { Radio, LogIn, UserPlus } from 'lucide-react';

export const AuthPage: React.FC = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');

  const { login, register, isLoading, error, clearError } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (isRegister) {
      await register({
        email,
        username,
        displayName: displayName || username,
        password,
      });
    } else {
      await login({
        emailOrUsername,
        password,
      });
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gdisc-bg-primary p-4 relative overflow-hidden">
      {/* Background ambient lighting effects */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-gdisc-brand-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-gdisc-brand-secondary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-gdisc-bg-card border border-gdisc-bg-hover rounded-3xl p-8 shadow-2xl z-10 animate-scale-in">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-gdisc-brand-primary to-gdisc-brand-secondary flex items-center justify-center shadow-gdisc-glow mb-3">
            <Radio className="w-7 h-7 text-white animate-pulse-subtle" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gdisc-text-primary">
            GDisC
          </h1>
          <p className="text-xs text-gdisc-text-secondary mt-1">
            Comunicação em tempo real de ultra-baixa latência
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="grid grid-cols-2 p-1 bg-gdisc-bg-secondary rounded-xl mb-6">
          <button
            type="button"
            onClick={() => {
              setIsRegister(false);
              clearError();
            }}
            className={`py-2 text-sm font-semibold rounded-lg transition-all ${
              !isRegister
                ? 'bg-gdisc-brand-primary text-white shadow-md'
                : 'text-gdisc-text-secondary hover:text-gdisc-text-primary'
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => {
              setIsRegister(true);
              clearError();
            }}
            className={`py-2 text-sm font-semibold rounded-lg transition-all ${
              isRegister
                ? 'bg-gdisc-brand-primary text-white shadow-md'
                : 'text-gdisc-text-secondary hover:text-gdisc-text-primary'
            }`}
          >
            Criar Conta
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-gdisc-danger/10 border border-gdisc-danger/30 text-gdisc-danger text-xs text-center font-medium animate-fade-in">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-gdisc-text-secondary uppercase tracking-wider mb-1.5">
                  E-mail
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@exemplo.com"
                  className="w-full px-3.5 py-2.5 bg-gdisc-bg-secondary border border-gdisc-bg-hover rounded-xl text-sm text-gdisc-text-primary focus:outline-none focus:border-gdisc-brand-primary transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gdisc-text-secondary uppercase tracking-wider mb-1.5">
                  Nome de Usuário (@handle)
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="seu_usuario"
                  className="w-full px-3.5 py-2.5 bg-gdisc-bg-secondary border border-gdisc-bg-hover rounded-xl text-sm text-gdisc-text-primary focus:outline-none focus:border-gdisc-brand-primary transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gdisc-text-secondary uppercase tracking-wider mb-1.5">
                  Nome de Exibição
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Seu Nome Completo"
                  className="w-full px-3.5 py-2.5 bg-gdisc-bg-secondary border border-gdisc-bg-hover rounded-xl text-sm text-gdisc-text-primary focus:outline-none focus:border-gdisc-brand-primary transition-colors"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-gdisc-text-secondary uppercase tracking-wider mb-1.5">
                E-mail ou Usuário
              </label>
              <input
                type="text"
                required
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
                placeholder="seu_email@exemplo.com ou usuario"
                className="w-full px-3.5 py-2.5 bg-gdisc-bg-secondary border border-gdisc-bg-hover rounded-xl text-sm text-gdisc-text-primary focus:outline-none focus:border-gdisc-brand-primary transition-colors"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gdisc-text-secondary uppercase tracking-wider mb-1.5">
              Senha
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 bg-gdisc-bg-secondary border border-gdisc-bg-hover rounded-xl text-sm text-gdisc-text-primary focus:outline-none focus:border-gdisc-brand-primary transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-gdisc-brand-primary hover:bg-gdisc-brand-secondary text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-gdisc-glow flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
          >
            {isRegister ? (
              <>
                <UserPlus className="w-4 h-4" />
                {isLoading ? 'Criando Conta...' : 'Criar Conta no GDisC'}
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                {isLoading ? 'Entrando...' : 'Entrar'}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
