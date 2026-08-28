import React, { useState } from 'react';
import { StatusBadge } from './StatusBadge.js';
import type { UserStatus } from '@gdisc/shared';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  status?: UserStatus | null;
  isSpeaking?: boolean;
  className?: string;
  onClick?: () => void;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  status,
  isSpeaking = false,
  className = '',
  onClick,
}) => {
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm font-semibold',
    lg: 'w-12 h-12 text-base font-bold',
    xl: 'w-16 h-16 text-xl font-bold',
    '2xl': 'w-24 h-24 text-3xl font-extrabold',
  };

  const badgeSizes = {
    xs: 'sm' as const,
    sm: 'sm' as const,
    md: 'md' as const,
    lg: 'md' as const,
    xl: 'lg' as const,
    '2xl': 'lg' as const,
  };

  // Generate deterministic gradient background based on name
  const getGradient = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
      'from-indigo-600 to-violet-800',
      'from-blue-600 to-indigo-800',
      'from-emerald-600 to-teal-800',
      'from-purple-600 to-pink-800',
      'from-amber-600 to-orange-800',
      'from-cyan-600 to-blue-800',
    ];
    return colors[Math.abs(hash) % colors.length];
  };

  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';

  return (
    <div
      onClick={onClick}
      className={`relative inline-flex items-center justify-center shrink-0 rounded-full select-none transition-all duration-150 ${
        isSpeaking ? 'ring-2 ring-gdisc-status-online shadow-gdisc-speaking' : ''
      } ${onClick ? 'cursor-pointer hover:opacity-90' : ''} ${className}`}
    >
      <div
        className={`rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br ${getGradient(
          name
        )} text-gdisc-text-primary ${sizeClasses[size]}`}
      >
        {src && !imageError ? (
          <img
            src={src}
            alt={name}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>

      {status && (
        <div className="absolute -bottom-0.5 -right-0.5">
          <StatusBadge status={status} size={badgeSizes[size]} />
        </div>
      )}
    </div>
  );
};
