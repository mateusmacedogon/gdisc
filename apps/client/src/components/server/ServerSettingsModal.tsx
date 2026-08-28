import React, { useState } from 'react';
import { Modal } from '../common/Modal.js';
import { useUIStore } from '../../stores/useUIStore.js';
import { useServerStore } from '../../stores/useServerStore.js';
import { useChannelStore } from '../../stores/useChannelStore.js';
import { useAuthStore } from '../../stores/useAuthStore.js';
import { api } from '../../services/api.js';
import {
  PERMISSION_DEFINITIONS,
  PermissionFlags,
  hasPermission,
  type RoleSummary,
} from '@gdisc/shared';
import {
  Settings,
  Hash,
  Volume2,
  Shield,
  Trash2,
  Plus,
  Check,
  AlertTriangle,
} from 'lucide-react';

export const ServerSettingsModal: React.FC = () => {
  const { activeModal, closeModal, addToast } = useUIStore();
  const { activeServer, updateServer, deleteServer, roles, fetchRoles } = useServerStore();
  const { channels, deleteChannel } = useChannelStore();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'overview' | 'channels' | 'roles' | 'danger'>('overview');

  // Overview Form
  const [name, setName] = useState(activeServer?.name || '');
  const [description, setDescription] = useState(activeServer?.description || '');
  const [iconUrl, setIconUrl] = useState(activeServer?.iconUrl || '');
  const [isSaving, setIsSaving] = useState(false);

  // Role Form
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('#6C63FF');
  const [selectedRole, setSelectedRole] = useState<RoleSummary | null>(null);

  const isOpen = activeModal === 'server_settings';
  if (!isOpen || !activeServer) return null;

  const isOwner = user?.id === activeServer.ownerId;

  const handleSaveOverview = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await updateServer(activeServer.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        iconUrl: iconUrl.trim() || undefined,
      });
      addToast('Configurações do servidor salvas!', 'success');
    } catch (err: any) {
      addToast(err.message || 'Erro ao salvar', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return;
    try {
      await api.post(`/servers/${activeServer.id}/roles`, {
        name: newRoleName.trim(),
        color: newRoleColor,
        permissions: '0',
      });
      addToast('Cargo criado com sucesso!', 'success');
      setNewRoleName('');
      fetchRoles(activeServer.id);
    } catch (err: any) {
      addToast(err.message || 'Erro ao criar cargo', 'error');
    }
  };

  const handleTogglePermission = async (role: RoleSummary, flag: bigint) => {
    let current = BigInt(role.permissions);
    if ((current & flag) === flag) {
      current &= ~flag;
    } else {
      current |= flag;
    }

    try {
      await api.patch(`/servers/${activeServer.id}/roles/${role.id}`, {
        permissions: current.toString(),
      });
      fetchRoles(activeServer.id);
    } catch (err: any) {
      addToast(err.message || 'Erro ao atualizar permissão', 'error');
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm('Deseja realmente apagar este cargo?')) return;
    try {
      await api.delete(`/servers/${activeServer.id}/roles/${roleId}`);
      addToast('Cargo removido com sucesso!', 'success');
      fetchRoles(activeServer.id);
      if (selectedRole?.id === roleId) setSelectedRole(null);
    } catch (err: any) {
      addToast(err.message || 'Erro ao remover cargo', 'error');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      title={`Configurações: ${activeServer.name}`}
      maxWidth="4xl"
    >
      <div className="flex flex-col md:flex-row gap-6 min-h-[460px]">
        {/* Navigation Sidebar */}
        <div className="w-full md:w-48 flex md:flex-col gap-1 border-b md:border-b-0 md:border-r border-gdisc-bg-hover/60 pb-3 md:pb-0 md:pr-3 shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
              activeTab === 'overview'
                ? 'bg-gdisc-brand-primary text-white shadow-sm'
                : 'text-gdisc-text-secondary hover:bg-gdisc-bg-hover hover:text-gdisc-text-primary'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Visão Geral</span>
          </button>

          <button
            onClick={() => setActiveTab('channels')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
              activeTab === 'channels'
                ? 'bg-gdisc-brand-primary text-white shadow-sm'
                : 'text-gdisc-text-secondary hover:bg-gdisc-bg-hover hover:text-gdisc-text-primary'
            }`}
          >
            <Hash className="w-4 h-4" />
            <span>Canais ({channels.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('roles')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
              activeTab === 'roles'
                ? 'bg-gdisc-brand-primary text-white shadow-sm'
                : 'text-gdisc-text-secondary hover:bg-gdisc-bg-hover hover:text-gdisc-text-primary'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Cargos ({roles.length})</span>
          </button>

          {isOwner && (
            <button
              onClick={() => setActiveTab('danger')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-colors mt-auto ${
                activeTab === 'danger'
                  ? 'bg-gdisc-danger text-white'
                  : 'text-gdisc-danger hover:bg-gdisc-danger/10'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Zona de Perigo</span>
            </button>
          )}
        </div>

        {/* Tab Content Panels */}
        <div className="flex-1 overflow-y-auto max-h-[500px] pr-1">
          {activeTab === 'overview' && (
            <form onSubmit={handleSaveOverview} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gdisc-text-secondary uppercase tracking-wider mb-1.5">
                  Nome do Servidor
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gdisc-bg-secondary border border-gdisc-bg-hover rounded-xl text-sm text-gdisc-text-primary focus:outline-none focus:border-gdisc-brand-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gdisc-text-secondary uppercase tracking-wider mb-1.5">
                  Descrição
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gdisc-bg-secondary border border-gdisc-bg-hover rounded-xl text-sm text-gdisc-text-primary focus:outline-none focus:border-gdisc-brand-primary resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gdisc-text-secondary uppercase tracking-wider mb-1.5">
                  URL do Ícone
                </label>
                <input
                  type="url"
                  value={iconUrl}
                  onChange={(e) => setIconUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gdisc-bg-secondary border border-gdisc-bg-hover rounded-xl text-sm text-gdisc-text-primary focus:outline-none focus:border-gdisc-brand-primary"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-gdisc-brand-primary hover:bg-gdisc-brand-secondary text-white text-sm font-semibold rounded-xl transition-all shadow-md"
                >
                  {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'channels' && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-gdisc-text-primary mb-3">
                Gerenciar Canais
              </h3>
              {channels.map((channel) => (
                <div
                  key={channel.id}
                  className="flex items-center justify-between p-3 bg-gdisc-bg-secondary border border-gdisc-bg-hover rounded-xl"
                >
                  <div className="flex items-center gap-2.5">
                    {channel.type === 'TEXT' ? (
                      <Hash className="w-4 h-4 text-gdisc-brand-secondary" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-gdisc-success" />
                    )}
                    <span className="text-sm font-semibold text-gdisc-text-primary">
                      {channel.name}
                    </span>
                    <span className="text-[10px] text-gdisc-text-muted px-2 py-0.5 rounded bg-gdisc-bg-card">
                      {channel.type}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      if (confirm(`Deseja realmente apagar o canal #${channel.name}?`)) {
                        deleteChannel(activeServer.id, channel.id);
                      }
                    }}
                    title="Excluir canal"
                    className="p-1.5 text-gdisc-text-muted hover:text-gdisc-danger hover:bg-gdisc-danger/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'roles' && (
            <div className="space-y-4">
              {/* Create Role Input */}
              <div className="flex gap-2 p-3 bg-gdisc-bg-secondary border border-gdisc-bg-hover rounded-xl items-center">
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="Nome do novo cargo"
                  className="flex-1 px-3 py-1.5 bg-gdisc-bg-card border border-gdisc-bg-hover rounded-lg text-xs text-gdisc-text-primary focus:outline-none"
                />
                <input
                  type="color"
                  value={newRoleColor}
                  onChange={(e) => setNewRoleColor(e.target.value)}
                  title="Cor do Cargo"
                  className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                />
                <button
                  onClick={handleCreateRole}
                  disabled={!newRoleName.trim()}
                  className="px-3 py-1.5 bg-gdisc-brand-primary hover:bg-gdisc-brand-secondary disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar Cargo</span>
                </button>
              </div>

              {/* Roles List & Permissions Editor */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Role List */}
                <div className="space-y-1">
                  {roles.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setSelectedRole(r)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                        selectedRole?.id === r.id
                          ? 'border-gdisc-brand-primary bg-gdisc-brand-primary/10 text-gdisc-text-primary'
                          : 'border-gdisc-bg-hover bg-gdisc-bg-secondary text-gdisc-text-secondary hover:text-gdisc-text-primary'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          style={{ backgroundColor: r.color }}
                          className="w-3 h-3 rounded-full shrink-0"
                        />
                        <span className="truncate">{r.name}</span>
                      </div>

                      {!r.isDefault && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRole(r.id);
                          }}
                          className="p-1 hover:text-gdisc-danger rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {/* Role Permissions Matrix */}
                <div className="md:col-span-2 p-3 bg-gdisc-bg-secondary border border-gdisc-bg-hover rounded-xl space-y-3">
                  {selectedRole ? (
                    <>
                      <div className="flex items-center justify-between border-b border-gdisc-bg-hover/60 pb-2">
                        <h4
                          style={{ color: selectedRole.color }}
                          className="text-sm font-bold truncate"
                        >
                          Permissões: {selectedRole.name}
                        </h4>
                        <span className="text-[10px] text-gdisc-text-muted">
                          Bitmask: {selectedRole.permissions}
                        </span>
                      </div>

                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {PERMISSION_DEFINITIONS.map((def) => {
                          const flag = PermissionFlags[def.key];
                          const isEnabled = hasPermission(selectedRole.permissions, flag);

                          return (
                            <div
                              key={def.key}
                              onClick={() => handleTogglePermission(selectedRole, flag)}
                              className="flex items-start justify-between p-2 rounded-lg hover:bg-gdisc-bg-card cursor-pointer transition-colors"
                            >
                              <div className="pr-3">
                                <div className="text-xs font-semibold text-gdisc-text-primary">
                                  {def.label}
                                </div>
                                <div className="text-[10px] text-gdisc-text-muted">
                                  {def.description}
                                </div>
                              </div>

                              <div
                                className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-all ${
                                  isEnabled
                                    ? 'bg-gdisc-success border-gdisc-success text-white'
                                    : 'border-gdisc-bg-hover bg-gdisc-bg-primary text-transparent'
                                }`}
                              >
                                <Check className="w-3.5 h-3.5" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="h-48 flex items-center justify-center text-xs text-gdisc-text-muted">
                      Selecione um cargo para visualizar e editar suas permissões.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'danger' && isOwner && (
            <div className="p-4 bg-gdisc-danger/10 border border-gdisc-danger/30 rounded-xl space-y-3">
              <h3 className="text-sm font-bold text-gdisc-danger flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Excluir este Servidor
              </h3>
              <p className="text-xs text-gdisc-text-secondary">
                Esta ação é irreversível. Todos os canais, mensagens e cargos deste servidor serão excluídos permanentemente.
              </p>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Tem certeza absoluta que deseja excluir o servidor "${activeServer.name}"?`)) {
                    deleteServer(activeServer.id);
                    closeModal();
                  }
                }}
                className="px-4 py-2 bg-gdisc-danger hover:bg-rose-600 text-white text-xs font-semibold rounded-xl transition-colors shadow-md"
              >
                Excluir Servidor Permanentemente
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
