import type { FastifyRequest, FastifyReply } from 'fastify';
import { roleService } from './role.service.js';
import { createRoleSchema, updateRoleSchema, assignRoleSchema } from './role.schema.js';
import { requirePermission } from '../../security/permissions.js';
import { PermissionFlags } from '@gdisc/shared';

export class RoleController {
  async getRoles(request: FastifyRequest, reply: FastifyReply) {
    const { serverId } = request.params as { serverId: string };
    const roles = await roleService.getServerRoles(serverId);
    return reply.send({ roles });
  }

  async createRole(request: FastifyRequest, reply: FastifyReply) {
    const { serverId } = request.params as { serverId: string };
    const userId = request.user.userId;

    try {
      await requirePermission(serverId, userId, PermissionFlags.MANAGE_ROLES);

      const parseResult = createRoleSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: parseResult.error.errors[0]?.message || 'Dados inválidos',
        });
      }

      const role = await roleService.createRole(serverId, parseResult.data);
      return reply.status(201).send({ role });
    } catch (error: any) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: error.message || 'Sem permissão para criar cargos',
      });
    }
  }

  async updateRole(request: FastifyRequest, reply: FastifyReply) {
    const { serverId, roleId } = request.params as { serverId: string; roleId: string };
    const userId = request.user.userId;

    try {
      await requirePermission(serverId, userId, PermissionFlags.MANAGE_ROLES);

      const parseResult = updateRoleSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: parseResult.error.errors[0]?.message || 'Dados inválidos',
        });
      }

      const role = await roleService.updateRole(roleId, parseResult.data);
      return reply.send({ role });
    } catch (error: any) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: error.message || 'Sem permissão para editar cargos',
      });
    }
  }

  async deleteRole(request: FastifyRequest, reply: FastifyReply) {
    const { serverId, roleId } = request.params as { serverId: string; roleId: string };
    const userId = request.user.userId;

    try {
      await requirePermission(serverId, userId, PermissionFlags.MANAGE_ROLES);
      await roleService.deleteRole(roleId);
      return reply.send({ success: true });
    } catch (error: any) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: error.message || 'Sem permissão para deletar cargos',
      });
    }
  }

  async assignRole(request: FastifyRequest, reply: FastifyReply) {
    const { serverId, memberId } = request.params as { serverId: string; memberId: string };
    const userId = request.user.userId;

    try {
      await requirePermission(serverId, userId, PermissionFlags.MANAGE_ROLES);

      const parseResult = assignRoleSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: parseResult.error.errors[0]?.message || 'Dados inválidos',
        });
      }

      await roleService.assignRole(serverId, memberId, parseResult.data.roleId);
      return reply.send({ success: true });
    } catch (error: any) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: error.message || 'Sem permissão para atribuir cargos',
      });
    }
  }

  async removeRole(request: FastifyRequest, reply: FastifyReply) {
    const { serverId, memberId, roleId } = request.params as {
      serverId: string;
      memberId: string;
      roleId: string;
    };
    const userId = request.user.userId;

    try {
      await requirePermission(serverId, userId, PermissionFlags.MANAGE_ROLES);
      await roleService.removeRole(memberId, roleId);
      return reply.send({ success: true });
    } catch (error: any) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: error.message || 'Sem permissão para remover cargos',
      });
    }
  }
}

export const roleController = new RoleController();
