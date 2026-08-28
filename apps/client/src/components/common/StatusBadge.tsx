import React from 'react';
import type { UserStatus } from '@gdisc/shared';

interface StatusBadgeProps {
  status?: UserStatus | null;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status = 'OFFLINE',
  className = '',
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'w-2.5 h-2.5 border',
    md: 'w-3.5 h-3.5 border-2',
    lg: 'w-4 h-4 border-2',
  };

  const statusColors: Record<UserStatus, string> = {
    ONLINE: 'bg-gdisc-status-online',
    IDLE: 'bg-gdisc-status-idle',
    DND: 'bg-gdisc-status-dnd',
    OFFLINE: 'bg-gdisc-status-offline',
  };

  const colorClass = status ? statusColors[status] || statusColors.OFFLINE : statusColors.OFFLINE;

  return (
    <span
      title={`Status: ${status}`}
      className={`inline-block rounded-full border-gdisc-bg-primary shrink-0 ${sizeClasses[size]} ${colorClass} ${className}`}
    />
  );
};
