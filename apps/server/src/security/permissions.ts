import { prisma } from '../plugins/prisma.js';
import { PermissionFlags, hasPermission } from '@gdisc/shared';

export interface MemberWithRoles {
  userId: string;
  serverId: string;
  isOwner: boolean;
  permissions: bigint;
}

/**
 * Computes all active permissions for a user in a specific server.
 * If the user is the server owner, automatically returns all permissions.
 */
export async function getMemberPermissions(
  serverId: string,
  userId: string
): Promise<MemberWithRoles | null> {
  const server = await prisma.server.findUnique({
    where: { id: serverId },
    select: { ownerId: true },
  });

  if (!server) return null;

  const isOwner = server.ownerId === userId;
  if (isOwner) {
    return {
      userId,
      serverId,
      isOwner: true,
      permissions: PermissionFlags.ADMINISTRATOR,
    };
  }

  const member = await prisma.serverMember.findUnique({
    where: {
      serverId_userId: {
        serverId,
        userId,
      },
    },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
    },
  });

  if (!member) return null;

  // Also include the @everyone default role
  const defaultRole = await prisma.role.findFirst({
    where: {
      serverId,
      isDefault: true,
    },
  });

  let totalPermissions = 0n;

  if (defaultRole) {
    totalPermissions |= BigInt(defaultRole.permissions);
  }

  for (const mr of member.roles) {
    totalPermissions |= BigInt(mr.role.permissions);
  }

  return {
    userId,
    serverId,
    isOwner: false,
    permissions: totalPermissions,
  };
}

/**
 * Asserts that a user has the specified permission in a server.
 * Throws an Error if unauthorized.
 */
export async function requirePermission(
  serverId: string,
  userId: string,
  requiredPermission: bigint
): Promise<MemberWithRoles> {
  const memberPerms = await getMemberPermissions(serverId, userId);

  if (!memberPerms) {
    throw new Error('Você não é membro deste servidor.');
  }

  if (!hasPermission(memberPerms.permissions, requiredPermission)) {
    throw new Error('Você não possui permissão para executar esta ação.');
  }

  return memberPerms;
}
