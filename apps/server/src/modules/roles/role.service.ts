import { prisma } from '../../plugins/prisma.js';
import type { CreateRoleInput, UpdateRoleInput } from './role.schema.js';
import type { RoleSummary } from '@gdisc/shared';

export class RoleService {
  async createRole(serverId: string, input: CreateRoleInput): Promise<RoleSummary> {
    const count = await prisma.role.count({ where: { serverId } });

    const role = await prisma.role.create({
      data: {
        serverId,
        name: input.name.trim(),
        color: input.color,
        permissions: input.permissions,
        position: input.position ?? count,
        isDefault: false,
      },
    });

    return this.mapRoleSummary(role);
  }

  async getServerRoles(serverId: string): Promise<RoleSummary[]> {
    const roles = await prisma.role.findMany({
      where: { serverId },
      orderBy: { position: 'asc' },
    });

    return roles.map((r) => this.mapRoleSummary(r));
  }

  async updateRole(roleId: string, input: UpdateRoleInput): Promise<RoleSummary> {
    const role = await prisma.role.update({
      where: { id: roleId },
      data: {
        ...(input.name ? { name: input.name.trim() } : {}),
        ...(input.color ? { color: input.color } : {}),
        ...(input.permissions ? { permissions: input.permissions } : {}),
        ...(input.position !== undefined ? { position: input.position } : {}),
      },
    });

    return this.mapRoleSummary(role);
  }

  async deleteRole(roleId: string): Promise<void> {
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new Error('Cargo não encontrado.');
    if (role.isDefault) {
      throw new Error('O cargo padrão @everyone não pode ser excluído.');
    }

    await prisma.role.delete({ where: { id: roleId } });
  }

  async assignRole(serverId: string, memberId: string, roleId: string): Promise<void> {
    await prisma.memberRole.create({
      data: {
        memberId,
        roleId,
      },
    });
  }

  async removeRole(memberId: string, roleId: string): Promise<void> {
    await prisma.memberRole.deleteMany({
      where: {
        memberId,
        roleId,
      },
    });
  }

  private mapRoleSummary(role: any): RoleSummary {
    return {
      id: role.id,
      serverId: role.serverId,
      name: role.name,
      color: role.color,
      position: role.position,
      permissions: role.permissions,
      isDefault: role.isDefault,
      createdAt: role.createdAt.toISOString(),
    };
  }
}

export const roleService = new RoleService();
