import React, { useState } from 'react';
import { Modal } from '../common/Modal.js';
import { useUIStore } from '../../stores/useUIStore.js';
import { useAuthStore } from '../../stores/useAuthStore.js';
import { Avatar } from '../common/Avatar.js';
import { User, Palette, Volume2, Keyboard, LogOut, Check, Sparkles } from 'lucide-react';
import { themeManager, ACCENT_THEMES } from '../../services/themeManager.js';
import { sounds } from '../../services/soundEffects.js';

type SettingsTab = 'profile' | 'appearance' | 'audio' | 'shortcuts';

export const UserSettingsModal: React.FC = () => {
  const { activeModal, closeModal, addToast } = useUIStore();
  const { user, updateProfile, logout } = useAuthStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [customStatus, setCustomStatus] = useState(user?.customStatus || '');
  const [isSaving, setIsSaving] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(() => themeManager.getTheme().id);
  const [soundEffectsOn, setSoundEffectsOn] = useState(() => sounds.enabled);

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

  const handleSelectTheme = (themeId: string) => {
    themeManager.setTheme(themeId);
    setCurrentTheme(themeId);
    addToast('Cor de destaque atualizada!', 'info');
  };

  const handleToggleSounds = () => {
    const next = !soundEffectsOn;
    sounds.enabled = next;
    setSoundEffectsOn(next);
    if (next) sounds.playJoin();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      title="Configurações do Usuário"
      maxWidth="2xl"
    >
      <div className="flex flex-col md:flex-row gap-6 min-h-[380px]">
        {/* Navigation Sidebar Tabs */}
        <div className="flex md:flex-col gap-1 w-full md:w-48 shrink-0 overflow-x-auto border-b md:border-b-0 md:border-r border-gdisc-bg-hover/70 pb-3 md:pb-0 md:pr-3">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors text-left ${
              activeTab === 'profile'
                ? 'bg-gdisc-brand-primary text-white shadow-sm'
                : 'text-gdisc-text-secondary hover:text-gdisc-text-primary hover:bg-gdisc-bg-hover/60'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Meu Perfil</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('appearance')}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors text-left ${
              activeTab === 'appearance'
                ? 'bg-gdisc-brand-primary text-white shadow-sm'
                : 'text-gdisc-text-secondary hover:text-gdisc-text-primary hover:bg-gdisc-bg-hover/60'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>Aparência & Cores</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audio')}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors text-left ${
              activeTab === 'audio'
                ? 'bg-gdisc-brand-primary text-white shadow-sm'
                : 'text-gdisc-text-secondary hover:text-gdisc-text-primary hover:bg-gdisc-bg-hover/60'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            <span>Sons & Efeitos</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('shortcuts')}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors text-left ${
              activeTab === 'shortcuts'
                ? 'bg-gdisc-brand-primary text-white shadow-sm'
                : 'text-gdisc-text-secondary hover:text-gdisc-text-primary hover:bg-gdisc-bg-hover/60'
            }`}
          >
            <Keyboard className="w-4 h-4" />
            <span>Atalhos</span>
          </button>

          <div className="hidden md:block mt-auto pt-4 border-t border-gdisc-bg-hover/50">
            <button
              type="button"
              onClick={() => {
                closeModal();
                logout();
              }}
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gdisc-danger hover:bg-gdisc-danger/10 rounded-xl transition-colors w-full"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair da Conta</span>
            </button>
          </div>
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto max-h-[480px] pr-1">
          {/* TAB 1: Profile */}
          {activeTab === 'profile' && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <form onSubmit={handleSubmit} className="lg:col-span-3 space-y-4">
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
                    placeholder="O que você está fazendo?"
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

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2.5 bg-gdisc-brand-primary hover:bg-gdisc-brand-secondary text-white text-sm font-semibold rounded-xl transition-all shadow-md"
                  >
                    {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>
              </form>

              {/* Preview */}
              <div className="lg:col-span-2 flex flex-col items-center">
                <div className="text-xs font-semibold text-gdisc-text-muted uppercase tracking-wider mb-2">
                  Pré-visualização
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
          )}

          {/* TAB 2: Appearance & Theme Accents */}
          {activeTab === 'appearance' && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <h4 className="text-sm font-bold text-gdisc-text-primary mb-1">
                  Cor de Destaque da Interface
                </h4>
                <p className="text-xs text-gdisc-text-secondary mb-4">
                  Escolha sua cor preferida para botões, indicadores e elementos visuais ativos.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ACCENT_THEMES.map((theme) => {
                  const isSelected = currentTheme === theme.id;

                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => handleSelectTheme(theme.id)}
                      className={`flex items-center justify-between p-3 rounded-2xl border transition-all text-left ${
                        isSelected
                          ? 'border-gdisc-brand-primary bg-gdisc-brand-primary/10 shadow-md ring-1 ring-gdisc-brand-primary'
                          : 'border-gdisc-bg-hover bg-gdisc-bg-secondary hover:border-gdisc-text-muted'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="w-7 h-7 rounded-full shadow-inner flex items-center justify-center shrink-0"
                          style={{ backgroundColor: theme.primary }}
                        >
                          {isSelected && <Check className="w-4 h-4 text-white" />}
                        </span>
                        <div>
                          <span className="text-sm font-semibold text-gdisc-text-primary block">
                            {theme.name}
                          </span>
                          <span className="text-[11px] font-mono text-gdisc-text-muted block">
                            {theme.primary}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: Sound & Audio Cues */}
          {activeTab === 'audio' && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <h4 className="text-sm font-bold text-gdisc-text-primary mb-1">
                  Efeitos Sonoros do Aplicativo
                </h4>
                <p className="text-xs text-gdisc-text-secondary mb-4">
                  Configure os alertas sonoros em tempo real durante chamadas de voz e ações do app.
                </p>
              </div>

              <div className="flex items-center justify-between p-4 bg-gdisc-bg-secondary border border-gdisc-bg-hover rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gdisc-brand-primary/10 text-gdisc-brand-secondary flex items-center justify-center">
                    <Volume2 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-gdisc-text-primary block">
                      Tons de Voz & Notificações
                    </span>
                    <span className="text-xs text-gdisc-text-muted block">
                      Tocar sons ao entrar/sair de chamadas e ao mutar microfone.
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleToggleSounds}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
                    soundEffectsOn ? 'bg-gdisc-brand-primary justify-end' : 'bg-gdisc-bg-hover justify-start'
                  }`}
                >
                  <div className="bg-white w-4 h-4 rounded-full shadow-md" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: Keyboard Shortcuts */}
          {activeTab === 'shortcuts' && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <h4 className="text-sm font-bold text-gdisc-text-primary mb-1">
                  Atalhos de Teclado
                </h4>
                <p className="text-xs text-gdisc-text-secondary mb-3">
                  Navegue e controle o GDisC rapidamente com os atalhos abaixo:
                </p>
              </div>

              <div className="space-y-2 bg-gdisc-bg-secondary border border-gdisc-bg-hover rounded-2xl p-3">
                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-gdisc-bg-card transition-colors">
                  <span className="text-xs font-semibold text-gdisc-text-primary">
                    Buscar Canais & Servidores (Quick Switcher)
                  </span>
                  <div className="flex gap-1">
                    <kbd className="font-mono text-xs bg-gdisc-bg-card border border-gdisc-bg-hover px-2 py-1 rounded text-gdisc-brand-secondary">
                      Ctrl + K
                    </kbd>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-gdisc-bg-card transition-colors">
                  <span className="text-xs font-semibold text-gdisc-text-primary">
                    Alternar Microfone (Mudo/Desmudo)
                  </span>
                  <div className="flex gap-1">
                    <kbd className="font-mono text-xs bg-gdisc-bg-card border border-gdisc-bg-hover px-2 py-1 rounded text-gdisc-brand-secondary">
                      Ctrl + M
                    </kbd>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-gdisc-bg-card transition-colors">
                  <span className="text-xs font-semibold text-gdisc-text-primary">
                    Alternar Áudio (Ensurdecer/Desensurdecer)
                  </span>
                  <div className="flex gap-1">
                    <kbd className="font-mono text-xs bg-gdisc-bg-card border border-gdisc-bg-hover px-2 py-1 rounded text-gdisc-brand-secondary">
                      Ctrl + Shift + D
                    </kbd>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-gdisc-bg-card transition-colors">
                  <span className="text-xs font-semibold text-gdisc-text-primary">
                    Fechar Janelas / Sair de Tela Cheia
                  </span>
                  <div className="flex gap-1">
                    <kbd className="font-mono text-xs bg-gdisc-bg-card border border-gdisc-bg-hover px-2 py-1 rounded text-gdisc-text-muted">
                      Esc
                    </kbd>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
