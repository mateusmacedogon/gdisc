/**
 * GDisC Data Transfer Objects (DTOs) and Validation Types
 */

import type { UserStatus } from './models.js';

export interface RegisterDTO {
  email: string;
  username: string;
  displayName: string;
  password: string;
}

export interface LoginDTO {
  emailOrUsername: string;
  password: string;
}

export interface UpdateProfileDTO {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  status?: UserStatus;
  customStatus?: string;
}

export interface CreateServerDTO {
  name: string;
  description?: string;
  iconUrl?: string;
}

export interface UpdateServerDTO {
  name?: string;
  description?: string;
  iconUrl?: string;
}

export interface CreateChannelDTO {
  name: string;
  type: 'TEXT' | 'VOICE';
  topic?: string;
  position?: number;
  isPrivate?: boolean;
}

export interface UpdateChannelDTO {
  name?: string;
  topic?: string;
  position?: number;
  isPrivate?: boolean;
}

export interface CreateMessageDTO {
  content: string;
  replyToId?: string;
}

export interface UpdateMessageDTO {
  content: string;
}

export interface CreateRoleDTO {
  name: string;
  color?: string;
  position?: number;
  permissions?: string;
}

export interface UpdateRoleDTO {
  name?: string;
  color?: string;
  position?: number;
  permissions?: string;
}

export interface CreateInviteDTO {
  maxUses?: number;
  expiresInHours?: number; // 0 = never
}
