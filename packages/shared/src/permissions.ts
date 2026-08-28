/**
 * GDisC Bitwise Permissions System
 * Ultra-fast O(1) bitmask calculations for user and role authorization.
 */

export const PermissionFlags = {
  // General Server Permissions
  ADMINISTRATOR: 1n << 0n,      // 1: Bypasses all channel/role restrictions
  MANAGE_SERVER: 1n << 1n,      // 2: Edit server name, icon, description
  MANAGE_ROLES: 1n << 2n,       // 4: Create, edit, reorder lower roles
  MANAGE_CHANNELS: 1n << 3n,    // 8: Create, edit, delete channels
  KICK_MEMBERS: 1n << 4n,       // 16: Kick lower rank members
  BAN_MEMBERS: 1n << 5n,        // 32: Ban members
  CREATE_INVITES: 1n << 6n,     // 64: Create server invite codes

  // Text Channel Permissions
  VIEW_CHANNEL: 1n << 7n,       // 128: View/read channel
  SEND_MESSAGES: 1n << 8n,      // 256: Post text messages
  MANAGE_MESSAGES: 1n << 9n,    // 512: Delete/edit others' messages
  ATTACH_FILES: 1n << 10n,      // 1024: Send attachments/links
  READ_MESSAGE_HISTORY: 1n << 11n, // 2048: See past messages

  // Voice Channel Permissions
  CONNECT_VOICE: 1n << 12n,     // 4096: Join voice channels
  SPEAK: 1n << 13n,             // 8192: Speak in voice channels
  STREAM_VIDEO: 1n << 14n,      // 16384: Transmit camera stream
  SCREEN_SHARE: 1n << 15n,      // 32768: Share display/window
  MUTE_MEMBERS: 1n << 16n,      // 65536: Server-mute other participants
  DEAFEN_MEMBERS: 1n << 17n,    // 131072: Server-deafen participants
  MOVE_MEMBERS: 1n << 18n,      // 262144: Move members between voice channels
} as const;

export type PermissionKey = keyof typeof PermissionFlags;

/**
 * Standard default permissions granted to @everyone upon server creation
 */
export const DEFAULT_EVERYONE_PERMISSIONS =
  PermissionFlags.CREATE_INVITES |
  PermissionFlags.VIEW_CHANNEL |
  PermissionFlags.SEND_MESSAGES |
  PermissionFlags.READ_MESSAGE_HISTORY |
  PermissionFlags.CONNECT_VOICE |
  PermissionFlags.SPEAK |
  PermissionFlags.STREAM_VIDEO |
  PermissionFlags.SCREEN_SHARE;

/**
 * Administrator all-inclusive bitmask
 */
export const ALL_PERMISSIONS = Object.values(PermissionFlags).reduce(
  (acc, flag) => acc | flag,
  0n
);

/**
 * Checks whether a given bitfield has a specific permission flag.
 * Administrator flag always returns true.
 */
export function hasPermission(
  userPermissions: bigint | string | number,
  requiredPermission: bigint
): boolean {
  const perms = BigInt(userPermissions);
  if ((perms & PermissionFlags.ADMINISTRATOR) === PermissionFlags.ADMINISTRATOR) {
    return true;
  }
  return (perms & requiredPermission) === requiredPermission;
}

/**
 * Computes combined permissions from an array of roles.
 */
export function computeCombinedPermissions(
  rolePermissions: Array<bigint | string | number>
): bigint {
  return rolePermissions.reduce<bigint>((acc, cur) => acc | BigInt(cur), 0n);
}

/**
 * Human-readable definitions for UI settings and permission editors.
 */
export const PERMISSION_DEFINITIONS: Array<{
  key: PermissionKey;
  label: string;
  description: string;
  category: 'general' | 'text' | 'voice';
}> = [
  {
    key: 'ADMINISTRATOR',
    label: 'Administrador',
    description: 'Concede todas as permissões e ignora todas as restrições de canais.',
    category: 'general',
  },
  {
    key: 'MANAGE_SERVER',
    label: 'Gerenciar Servidor',
    description: 'Permite alterar o nome, ícone e configurações gerais do servidor.',
    category: 'general',
  },
  {
    key: 'MANAGE_ROLES',
    label: 'Gerenciar Cargos',
    description: 'Permite criar, editar e excluir cargos abaixo do seu.',
    category: 'general',
  },
  {
    key: 'MANAGE_CHANNELS',
    label: 'Gerenciar Canais',
    description: 'Permite criar, editar e excluir canais de texto e voz.',
    category: 'general',
  },
  {
    key: 'CREATE_INVITES',
    label: 'Criar Convites',
    description: 'Permite gerar novos links e códigos de convite para o servidor.',
    category: 'general',
  },
  {
    key: 'KICK_MEMBERS',
    label: 'Expulsar Membros',
    description: 'Permite remover membros do servidor.',
    category: 'general',
  },
  {
    key: 'BAN_MEMBERS',
    label: 'Banir Membros',
    description: 'Permite banir membros permanentemente do servidor.',
    category: 'general',
  },
  {
    key: 'VIEW_CHANNEL',
    label: 'Ver Canais',
    description: 'Permite visualizar canais de texto e voz.',
    category: 'text',
  },
  {
    key: 'SEND_MESSAGES',
    label: 'Enviar Mensagens',
    description: 'Permite enviar mensagens nos canais de texto.',
    category: 'text',
  },
  {
    key: 'MANAGE_MESSAGES',
    label: 'Gerenciar Mensagens',
    description: 'Permite apagar ou fixar mensagens de outros membros.',
    category: 'text',
  },
  {
    key: 'CONNECT_VOICE',
    label: 'Conectar à Voz',
    description: 'Permite entrar e escutar em canais de voz.',
    category: 'voice',
  },
  {
    key: 'SPEAK',
    label: 'Falar',
    description: 'Permite falar nos canais de voz.',
    category: 'voice',
  },
  {
    key: 'STREAM_VIDEO',
    label: 'Câmera / Vídeo',
    description: 'Permite transmitir vídeo da webcam.',
    category: 'voice',
  },
  {
    key: 'SCREEN_SHARE',
    label: 'Compartilhar Tela',
    description: 'Permite compartilhar tela ou janelas nos canais de voz.',
    category: 'voice',
  },
];
