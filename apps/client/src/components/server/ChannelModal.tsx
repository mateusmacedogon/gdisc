import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal.js';
import { useUIStore } from '../../stores/useUIStore.js';
import { useChannelStore } from '../../stores/useChannelStore.js';
import { Hash, Volume2 } from 'lucide-react';
import type { ChannelType } from '@gdisc/shared';

export const ChannelModal: React.FC = () => {
  const { activeModal, modalData, closeModal, addToast } = useUIStore();
  const { createChannel } = useChannelStore();

  const [name, setName] = useState('');
  const [type, setType] = useState<ChannelType>('TEXT');
  const [topic, setTopic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOpen = activeModal === 'channel_settings';

  useEffect(() => {
    if (modalData?.initialType) {
      setType(modalData.initialType);
    }
  }, [modalData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !modalData?.serverId) return;

    try {
      setIsLoading(true);
      setError(null);

      await createChannel(modalData.serverId, {
        name: name.trim(),
        type,
        topic: topic.trim() || undefined,
      });

      addToast(`Canal #${name} criado com sucesso!`, 'success');
      closeModal();
      setName('');
      setTopic('');
    } catch (err: any) {
      setError(err.message || 'Falha ao criar canal');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      title="Criar Canal"
      description="Crie um canal de texto para mensagens ou um canal de voz para conversas e vídeo."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-gdisc-danger/10 border border-gdisc-danger/30 text-gdisc-danger text-xs rounded-xl font-medium">
            {error}
          </div>
        )}

        {/* Channel Type Selector */}
        <div>
          <label className="block text-xs font-semibold text-gdisc-text-secondary uppercase tracking-wider mb-2">
            Tipo do Canal
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setType('TEXT')}
              className={`p-3.5 rounded-xl border flex flex-col items-start gap-1 transition-all ${
                type === 'TEXT'
                  ? 'border-gdisc-brand-primary bg-gdisc-brand-primary/10 text-gdisc-text-primary shadow-sm'
                  : 'border-gdisc-bg-hover bg-gdisc-bg-secondary text-gdisc-text-secondary hover:border-gdisc-bg-hover/80'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm">
                <Hash className="w-4 h-4 text-gdisc-brand-secondary" />
                <span>Texto</span>
              </div>
              <span className="text-[11px] text-gdisc-text-muted text-left">
                Postar mensagens, links e respostas.
              </span>
            </button>

            <button
              type="button"
              onClick={() => setType('VOICE')}
              className={`p-3.5 rounded-xl border flex flex-col items-start gap-1 transition-all ${
                type === 'VOICE'
                  ? 'border-gdisc-brand-primary bg-gdisc-brand-primary/10 text-gdisc-text-primary shadow-sm'
                  : 'border-gdisc-bg-hover bg-gdisc-bg-secondary text-gdisc-text-secondary hover:border-gdisc-bg-hover/80'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm">
                <Volume2 className="w-4 h-4 text-gdisc-success" />
                <span>Voz & Vídeo</span>
              </div>
              <span className="text-[11px] text-gdisc-text-muted text-left">
                Conversar por voz, webcam e tela.
              </span>
            </button>
          </div>
        </div>

        {/* Channel Name */}
        <div>
          <label className="block text-xs font-semibold text-gdisc-text-secondary uppercase tracking-wider mb-1.5">
            Nome do Canal *
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-3.5 text-gdisc-text-muted">
              {type === 'TEXT' ? <Hash className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </span>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === 'TEXT' ? 'novo-canal' : 'Sala de Voz'}
              className="w-full pl-9 pr-3.5 py-2.5 bg-gdisc-bg-secondary border border-gdisc-bg-hover rounded-xl text-sm text-gdisc-text-primary focus:outline-none focus:border-gdisc-brand-primary transition-colors"
            />
          </div>
        </div>

        {/* Channel Topic */}
        {type === 'TEXT' && (
          <div>
            <label className="block text-xs font-semibold text-gdisc-text-secondary uppercase tracking-wider mb-1.5">
              Tópico do Canal (Opcional)
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Descreva o propósito deste canal"
              className="w-full px-3.5 py-2.5 bg-gdisc-bg-secondary border border-gdisc-bg-hover rounded-xl text-sm text-gdisc-text-primary focus:outline-none focus:border-gdisc-brand-primary transition-colors"
            />
          </div>
        )}

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
            disabled={isLoading || !name.trim()}
            className="px-5 py-2.5 bg-gdisc-brand-primary hover:bg-gdisc-brand-secondary disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all shadow-md"
          >
            {isLoading ? 'Criando...' : 'Criar Canal'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
