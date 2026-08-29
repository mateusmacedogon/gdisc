import React, { useState } from 'react';
import { useAuthStore } from '../../stores/useAuthStore.js';
import { Eye, EyeOff, Radio, LogIn, UserPlus } from 'lucide-react';

export const AuthPage: React.FC = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const { login, register, isLoading, error, notice, clearError } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      if (isRegister) {
        await register({
          email,
          username,
          displayName: displayName || username,
          password,
        });
        if (useAuthStore.getState().notice) setIsRegister(false);
      } else {
        await login({
          emailOrUsername,
          password,
        });
      }
    } catch {
      // The store exposes a localized error in the form.
    }
  };

  return (
    <div className="relative flex min-h-screen min-h-dvh w-full items-center justify-center overflow-y-auto bg-gdisc-bg-primary p-4">
      {/* Background ambient lighting effects */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-gdisc-brand-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-gdisc-brand-secondary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="z-10 my-auto w-full max-w-md rounded-3xl border border-gdisc-bg-hover bg-gdisc-bg-card p-5 shadow-2xl animate-scale-in sm:p-8">
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
            aria-pressed={!isRegister}
            className={`min-h-11 py-2 text-sm font-semibold rounded-lg transition-all ${
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
            aria-pressed={isRegister}
            className={`min-h-11 py-2 text-sm font-semibold rounded-lg transition-all ${
              isRegister
                ? 'bg-gdisc-brand-primary text-white shadow-md'
                : 'text-gdisc-text-secondary hover:text-gdisc-text-primary'
            }`}
          >
            Criar Conta
          </button>
        </div>

        {error && (
          <div role="alert" className="mb-4 p-3 rounded-xl bg-gdisc-danger/10 border border-gdisc-danger/30 text-gdisc-danger text-sm text-center font-medium animate-fade-in">
            {error}
          </div>
        )}

        {notice && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs text-center font-medium animate-fade-in" role="status">
            {notice}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister ? (
            <>
              <div>
                <label htmlFor="register-email" className="block text-xs font-semibold text-gdisc-text-secondary uppercase tracking-wider mb-1.5">
                  E-mail
                </label>
                <input
                  id="register-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@exemplo.com"
                  className="min-h-11 w-full px-3.5 py-2.5 bg-gdisc-bg-secondary border border-gdisc-bg-hover rounded-xl text-base text-gdisc-text-primary focus:outline-none focus:border-gdisc-brand-primary transition-colors sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="register-username" className="block text-xs font-semibold text-gdisc-text-secondary uppercase tracking-wider mb-1.5">
                  Nome de Usuário (@handle)
                </label>
                <input
                  id="register-username"
                  type="text"
                  required
                  minLength={2}
                  maxLength={32}
                  pattern="[a-z0-9_.]+"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
                  placeholder="seu_usuario"
                  className="min-h-11 w-full px-3.5 py-2.5 bg-gdisc-bg-secondary border border-gdisc-bg-hover rounded-xl text-base text-gdisc-text-primary focus:outline-none focus:border-gdisc-brand-primary transition-colors sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="register-display-name" className="block text-xs font-semibold text-gdisc-text-secondary uppercase tracking-wider mb-1.5">
                  Nome de Exibição
                </label>
                <input
                  id="register-display-name"
                  type="text"
                  required
                  minLength={1}
                  maxLength={50}
                  autoComplete="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Seu Nome Completo"
                  className="min-h-11 w-full px-3.5 py-2.5 bg-gdisc-bg-secondary border border-gdisc-bg-hover rounded-xl text-base text-gdisc-text-primary focus:outline-none focus:border-gdisc-brand-primary transition-colors sm:text-sm"
                />
              </div>
            </>
          ) : (
            <div>
              <label htmlFor="login-email" className="block text-xs font-semibold text-gdisc-text-secondary uppercase tracking-wider mb-1.5">
                E-mail
              </label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
                placeholder="seu_email@exemplo.com"
                autoFocus
                className="min-h-11 w-full px-3.5 py-2.5 bg-gdisc-bg-secondary border border-gdisc-bg-hover rounded-xl text-base text-gdisc-text-primary focus:outline-none focus:border-gdisc-brand-primary transition-colors sm:text-sm"
              />
            </div>
          )}

          <div>
            <label htmlFor={isRegister ? 'new-password' : 'current-password'} className="block text-xs font-semibold text-gdisc-text-secondary uppercase tracking-wider mb-1.5">
              Senha
            </label>
            <div className="relative">
              <input
                id={isRegister ? 'new-password' : 'current-password'}
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                pattern={isRegister ? '(?=.*[A-Za-z])(?=.*\\d).{8,}' : undefined}
                title={isRegister ? 'Use pelo menos 8 caracteres, incluindo letras e números.' : undefined}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="min-h-11 w-full border border-gdisc-bg-hover bg-gdisc-bg-secondary py-2.5 pl-3.5 pr-12 text-base text-gdisc-text-primary rounded-xl focus:outline-none focus:border-gdisc-brand-primary transition-colors sm:text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                aria-pressed={showPassword}
                title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute inset-y-0 right-0 flex min-h-11 min-w-11 items-center justify-center rounded-r-xl text-gdisc-text-muted hover:text-gdisc-text-primary"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {isRegister && (
              <p className="mt-1.5 text-xs leading-relaxed text-gdisc-text-muted">
                Use pelo menos 8 caracteres, incluindo letras e números.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="min-h-12 w-full py-3 bg-gdisc-brand-primary hover:bg-gdisc-brand-secondary text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-gdisc-glow flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
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
