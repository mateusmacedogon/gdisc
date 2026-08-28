/**
 * GDisC Domain Models & Shared Entity Definitions
 */

export type UserStatus = 'ONLINE' | 'IDLE' | 'DND' | 'OFFLINE';

export interface UserSummary {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  status: UserStatus;
  customStatus?: string | null;
}

export interface UserProfile extends UserSummary {
  email: string;
  bio?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ChannelType = 'TEXT' | 'VOICE';

export interface ChannelSummary {
  id: string;
  serverId: string;
  name: string;
  type: ChannelType;
  topic?: string | null;
  position: number;
  isPrivate: boolean;
  createdAt: string;
}

export interface RoleSummary {
  id: string;
  serverId: string;
  name: string;
  color: string;
  position: number;
  permissions: string; // Serialized BigInt string
  isDefault: boolean;
  createdAt: string;
}

export interface ServerMemberSummary {
  id: string;
  serverId: string;
  userId: string;
  nickname?: string | null;
  joinedAt: string;
  user: UserSummary;
  roles: RoleSummary[];
}

export interface ServerSummary {
  id: string;
  name: string;
  iconUrl?: string | null;
  description?: string | null;
  ownerId: string;
  memberCount?: number;
  channels?: ChannelSummary[];
  roles?: RoleSummary[];
  createdAt: string;
}

export interface MessageSummary {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  replyToId?: string | null;
  replyTo?: {
    id: string;
    content: string;
    author: {
      id: string;
      displayName: string;
      username: string;
    };
  } | null;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
  author: UserSummary;
}

export interface InviteSummary {
  id: string;
  code: string;
  serverId: string;
  creatorId: string;
  maxUses: number;
  uses: number;
  expiresAt?: string | null;
  createdAt: string;
  server?: {
    id: string;
    name: string;
    iconUrl?: string | null;
    memberCount?: number;
  };
}

export interface VoiceState {
  userId: string;
  channelId: string;
  serverId: string;
  user: UserSummary;
  selfMute: boolean;
  selfDeaf: boolean;
  selfVideo: boolean;
  selfScreen: boolean;
  isSpeaking?: boolean;
  joinedAt: number;
}
