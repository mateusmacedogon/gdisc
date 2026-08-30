import React, { useState } from 'react';
import { Search, Sparkles, Smile, Hand, Gamepad2, Heart, X } from 'lucide-react';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

interface EmojiCategory {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  emojis: string[];
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'popular',
    name: 'Populares',
    icon: Sparkles,
    emojis: ['👍', '❤️', '😂', '🔥', '🚀', '🎉', '✨', '👀', '💯', '👏', '😍', '🤔', '😭', '😎', '🙌', '💪'],
  },
  {
    id: 'faces',
    name: 'Expressões',
    icon: Smile,
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇',
      '🥰', '😍', '🤩', '😘', '😗', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗',
      '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
      '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶',
      '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐'
    ],
  },
  {
    id: 'gestures',
    name: 'Gestos',
    icon: Hand,
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙',
      '👈', '👉', '👆', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏',
      '🙌', '👐', '🤲', '🤝', '🙏', '💪', '🧠', '👀', '👁️'
    ],
  },
  {
    id: 'gaming',
    name: 'Gaming & Tech',
    icon: Gamepad2,
    emojis: [
      '🎮', '🕹️', '👾', '💻', '🖥️', '📱', '⌨️', '🎧', '🎙️', '⚡', '🔋', '📡',
      '🚀', '🛸', '🤖', '💾', '💿', '🔌', '💎', '🛡️', '⚔️', '🏆', '🥇', '🎯',
      '🎲', '👑', '🔥', '💡', '🎵', '🔊'
    ],
  },
  {
    id: 'hearts',
    name: 'Corações',
    icon: Heart,
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕',
      '💞', '💓', '💗', '💖', '💘', '💝', '💟', '🔥', '✨', '🌟', '⭐', '💥', '💯'
    ],
  },
];

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect, onClose }) => {
  const [activeCategory, setActiveCategory] = useState('popular');
  const [search, setSearch] = useState('');

  const filteredEmojis = search.trim()
    ? EMOJI_CATEGORIES.flatMap((c) => c.emojis).filter((emoji, idx, arr) => arr.indexOf(emoji) === idx)
    : EMOJI_CATEGORIES.find((c) => c.id === activeCategory)?.emojis || [];

  return (
    <div className="w-72 sm:w-80 bg-gdisc-bg-card border border-gdisc-bg-hover rounded-2xl shadow-2xl overflow-hidden flex flex-col z-50 animate-scale-in select-none">
      {/* Search Header */}
      <div className="p-2.5 border-b border-gdisc-bg-hover/70 flex items-center justify-between gap-2">
        <div className="relative flex-1 flex items-center">
          <Search className="w-3.5 h-3.5 text-gdisc-text-muted absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar emojis..."
            className="w-full pl-8 pr-2.5 py-1.5 bg-gdisc-bg-secondary border border-gdisc-bg-hover rounded-xl text-xs text-gdisc-text-primary placeholder:text-gdisc-text-muted focus:outline-none focus:border-gdisc-brand-primary"
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-gdisc-text-muted hover:text-gdisc-text-primary rounded-lg hover:bg-gdisc-bg-hover transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Category Tabs (if not searching) */}
      {!search && (
        <div className="flex items-center justify-around px-1 py-1.5 bg-gdisc-bg-secondary border-b border-gdisc-bg-hover/40">
          {EMOJI_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                title={cat.name}
                className={`p-1.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-gdisc-brand-primary text-white shadow-sm'
                    : 'text-gdisc-text-muted hover:text-gdisc-text-primary hover:bg-gdisc-bg-hover/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            );
          })}
        </div>
      )}

      {/* Emoji Grid */}
      <div className="p-2.5 grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
        {filteredEmojis.map((emoji, idx) => (
          <button
            key={`${emoji}-${idx}`}
            type="button"
            onClick={() => onSelect(emoji)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-lg hover:bg-gdisc-bg-hover hover:scale-125 transition-transform"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};
