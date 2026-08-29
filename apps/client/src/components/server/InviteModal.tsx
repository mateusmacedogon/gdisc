import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal.js';
import { useUIStore } from '../../stores/useUIStore.js';
import { useServerStore } from '../../stores/useServerStore.js';
import { api } from '../../services/api.js';
import { Copy, Check, Link, Compass, Sparkles } from 'lucide-react';
import type { InviteSummary } from '@gdisc/shared';

export const InviteModal: React.FC = () => {
  const { activeModal, modalData, closeModal, addToast } = useUIStore();
  const { fetchServers, selectServer, activeServer } = useServerStore();

  const isInviteMode = activeModal === 'invite';
  const isJoinMode = activeModal === 'join_invite';
  const isOpen = isInviteMode || isJoinMode;

  const [inviteCode, setInviteCode] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate / fetch invite code when opened in invite mode
  useEffect(() => {
    if (!isInviteMode || !modalData?.serverId) return;

    const generateInvite = async () => {
      try {
        setIsLoading(true);
        const { invite } = await api.post<{ invite: InviteSummary }>(
          `/servers/${modalData.serverId}/invites`,
          { maxUses: 0, expiresInHours: 0 }
        );
        setInviteCode(invite.code);
      } catch (err: any) {
        console.error('Error generating invite:', err);
      } finally {
        setIsLoading(false);
      }
    };

    generateInvite();
  }, [isInviteMode, modalData?.serverId]);

  useEffect(() => {
    if (isJoinMode && modalData?.inviteCode) {
      setJoinCodeInput(String(modalData.inviteCode));
    }
  }, [isJoinMode, modalData?.inviteCode]);

  const handleCopy = async () => {
    const inviteUrl = `${window.location.origin}/#invite=${inviteCode}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      addToast('Link de convite copiado!', 'success');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      addToast('Não foi possível copiar. Selecione o código manualmente.', 'error');
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = joinCodeInput.trim().replace(/^.*invite=/, '');
    if (!cleanCode) return;

    try {
      setIsLoading(true);
      setError(null);
      const res = await api.post<{ success: boolean; serverId: string }>(
        `/invites/${cleanCode}/join`
      );

      addToast('Você entrou no servidor com sucesso!', 'success');
      await fetchServers();
      await selectServer(res.serverId);
      closeModal();
      setJoinCodeInput('');
    } catch (err: any) {
      setError(err.message || 'Convite inválido ou expirado.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      title={isInviteMode ? `Convidar Amigos para ${activeServer?.name || 'o Servidor'}` : 'Entrar em um Servidor'}
      description={
        isInviteMode
          ? 'Envie este código ou link para seus amigos para que eles entrem no servidor.'
          : 'Digite o código ou link de convite fornecido pelo proprietário.'
      }
      maxWidth="md"
    >
      {isInviteMode ? (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gdisc-text-secondary uppercase tracking-wider mb-1.5">
              Código de Convite do Servidor
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={inviteCode ? inviteCode : 'Gerando...'}
                className="w-full px-3.5 py-2.5 bg-gdisc-bg-secondary border border-gdisc-bg-hover rounded-xl text-sm font-mono text-gdisc-text-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopy}
                disabled={!inviteCode}
                className="px-4 py-2.5 bg-gdisc-brand-primary hover:bg-gdisc-brand-secondary text-white text-sm font-semibold rounded-xl transition-all shadow-md flex items-center gap-1.5 shrink-0"
              >
                {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-gdisc-bg-secondary border border-gdisc-bg-hover text-xs text-gdisc-text-muted flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-gdisc-brand-secondary shrink-0" />
            <span>Seu código de convite nunca expira e possui usos ilimitados.</span>
          </div>
        </div>
      ) : (
        <form onSubmit={handleJoin} className="space-y-4">
          {error && (
            <div className="p-3 bg-gdisc-danger/10 border border-gdisc-danger/30 text-gdisc-danger text-xs rounded-xl font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gdisc-text-secondary uppercase tracking-wider mb-1.5">
              Código ou Link de Convite *
            </label>
            <input
              type="text"
              required
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value)}
              placeholder="Ex: gdisc-demo ou 8 caracteres"
              className="w-full px-3.5 py-2.5 bg-gdisc-bg-secondary border border-gdisc-bg-hover rounded-xl text-sm text-gdisc-text-primary focus:outline-none focus:border-gdisc-brand-primary transition-colors"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2.5 bg-gdisc-bg-secondary hover:bg-gdisc-bg-hover text-gdisc-text-secondary hover:text-gdisc-text-primary text-sm font-semibold rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading || !joinCodeInput.trim()}
              className="px-5 py-2.5 bg-gdisc-brand-primary hover:bg-gdisc-brand-secondary disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all shadow-md flex items-center gap-1.5"
            >
              <Compass className="w-4 h-4" />
              <span>{isLoading ? 'Entrando...' : 'Entrar no Servidor'}</span>
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
