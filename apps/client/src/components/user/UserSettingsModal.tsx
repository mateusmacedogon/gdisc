import React, { useState } from 'react';
import { Modal } from '../common/Modal.js';
import { useUIStore } from '../../stores/useUIStore.js';
import { useAuthStore } from '../../stores/useAuthStore.js';
import { Avatar } from '../common/Avatar.js';
import { User, LogOut, Sparkles } from 'lucide-react';

export const UserSettingsModal: React.FC = () => {
  const { activeModal, closeModal, addToast } = useUIStore();
  const { user, updateProfile, logout } = useAuthStore();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [customStatus, setCustomStatus] = useState(user?.customStatus || '');
  const [isSaving, setIsSaving] = useState(false);

  const isOpen = activeModal === 'user_settings';
  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await updateProfile({
        displayName: displayName.trim(),
        bio: bio.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
        customStatus: customStatus.trim() || undefined,
      });

      addToast('Perfil atualizado com sucesso!', 'success');
      closeModal();
    } catch (err: any) {
      addToast(err.message || 'Erro ao atualizar perfil', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      title="Meu Perfil & Configurações"
      maxWidth="lg"
    >
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* Form Column */}
        <form onSubmit={handleSubmit} className="md:col-span-3 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gdisc-text-secondary uppercase tracking-wider mb-1.5">
              Nome de Exibição
            </label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-gdisc-bg-secondary border border-gdisc-bg-hover rounded-xl text-sm text-gdisc-text-primary focus:outline-none focus:border-gdisc-brand-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gdisc-text-secondary uppercase tracking-wider mb-1.5">
              Status Personalizado
            </label>
            <input
              type="text"
              value={customStatus}
              onChange={(e) => setCustomStatus(e.target.value)}
              placeholder="O que está acontecendo?"
              className="w-full px-3.5 py-2.5 bg-gdisc-bg-secondary border border-gdisc-bg-hover rounded-xl text-sm text-gdisc-text-primary focus:outline-none focus:border-gdisc-brand-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gdisc-text-secondary uppercase tracking-wider mb-1.5">
              Sobre Mim (Bio)
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Conte um pouco sobre você..."
              className="w-full px-3.5 py-2.5 bg-gdisc-bg-secondary border border-gdisc-bg-hover rounded-xl text-sm text-gdisc-text-primary focus:outline-none focus:border-gdisc-brand-primary resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gdisc-text-secondary uppercase tracking-wider mb-1.5">
              URL do Avatar
            </label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://exemplo.com/avatar.jpg"
              className="w-full px-3.5 py-2.5 bg-gdisc-bg-secondary border border-gdisc-bg-hover rounded-xl text-sm text-gdisc-text-primary focus:outline-none focus:border-gdisc-brand-primary"
            />
          </div>

          <div className="pt-3 flex justify-between items-center">
            <button
              type="button"
              onClick={() => {
                closeModal();
                logout();
              }}
              className="text-xs text-gdisc-danger hover:underline flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair da conta</span>
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-gdisc-brand-primary hover:bg-gdisc-brand-secondary text-white text-sm font-semibold rounded-xl transition-all shadow-md"
            >
              {isSaving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>

        {/* Live Preview Card */}
        <div className="md:col-span-2 flex flex-col items-center">
          <div className="text-xs font-semibold text-gdisc-text-muted uppercase tracking-wider mb-2">
            Pré-visualização do Perfil
          </div>
          <div className="w-full bg-gdisc-bg-secondary border border-gdisc-bg-hover rounded-2xl p-4 shadow-lg text-center flex flex-col items-center">
            <Avatar
              src={avatarUrl || user.avatarUrl}
              name={displayName || user.displayName}
              size="xl"
              status={user.status}
              className="mb-3"
            />
            <h4 className="text-base font-bold text-gdisc-text-primary">
              {displayName || user.displayName}
            </h4>
            <span className="text-xs text-gdisc-text-muted">@{user.username}</span>

            {customStatus && (
              <div className="mt-2.5 px-3 py-1 bg-gdisc-bg-card rounded-lg border border-gdisc-bg-hover text-xs text-gdisc-brand-secondary">
                {customStatus}
              </div>
            )}

            {bio && (
              <p className="mt-3 text-xs text-gdisc-text-secondary italic line-clamp-3">
                "{bio}"
              </p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
