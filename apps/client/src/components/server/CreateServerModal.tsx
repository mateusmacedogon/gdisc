import React, { useState } from 'react';
import { Modal } from '../common/Modal.js';
import { useUIStore } from '../../stores/useUIStore.js';
import { useServerStore } from '../../stores/useServerStore.js';
import { Radio, Image } from 'lucide-react';

export const CreateServerModal: React.FC = () => {
  const { activeModal, closeModal, addToast } = useUIStore();
  const { createServer } = useServerStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOpen = activeModal === 'create_server';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setIsLoading(true);
      setError(null);
      await createServer({
        name: name.trim(),
        description: description.trim() || undefined,
        iconUrl: iconUrl.trim() || undefined,
      });

      addToast('Servidor criado com sucesso!', 'success');
      closeModal();
      setName('');
      setDescription('');
      setIconUrl('');
    } catch (err: any) {
      setError(err.message || 'Falha ao criar servidor');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      title="Crie seu Servidor"
      description="Seu servidor é onde você e seus amigos podem conversar por texto, voz e vídeo."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-gdisc-danger/10 border border-gdisc-danger/30 text-gdisc-danger text-xs rounded-xl font-medium">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gdisc-text-secondary uppercase tracking-wider mb-1.5">
            Nome do Servidor *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Comunidade Dev, Jogatina dos Amigos"
            className="w-full px-3.5 py-2.5 bg-gdisc-bg-secondary border border-gdisc-bg-hover rounded-xl text-sm text-gdisc-text-primary focus:outline-none focus:border-gdisc-brand-primary transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gdisc-text-secondary uppercase tracking-wider mb-1.5">
            Descrição (Opcional)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Sobre o que é este servidor?"
            className="w-full px-3.5 py-2.5 bg-gdisc-bg-secondary border border-gdisc-bg-hover rounded-xl text-sm text-gdisc-text-primary focus:outline-none focus:border-gdisc-brand-primary transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gdisc-text-secondary uppercase tracking-wider mb-1.5">
            URL do Ícone (Opcional)
          </label>
          <input
            type="url"
            value={iconUrl}
            onChange={(e) => setIconUrl(e.target.value)}
            placeholder="https://exemplo.com/icone.png"
            className="w-full px-3.5 py-2.5 bg-gdisc-bg-secondary border border-gdisc-bg-hover rounded-xl text-sm text-gdisc-text-primary focus:outline-none focus:border-gdisc-brand-primary transition-colors"
          />
        </div>

        <div className="pt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={closeModal}
            className="px-4 py-2.5 bg-gdisc-bg-secondary hover:bg-gdisc-bg-hover text-gdisc-text-secondary hover:text-gdisc-text-primary text-sm font-semibold rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isLoading || !name.trim()}
            className="px-5 py-2.5 bg-gdisc-brand-primary hover:bg-gdisc-brand-secondary disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all shadow-md"
          >
            {isLoading ? 'Criando...' : 'Criar Servidor'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
