import type { FastifyRequest, FastifyReply } from 'fastify';
import { userService } from './user.service.js';
import { updateProfileSchema } from './user.schema.js';

export class UserController {
  async getMe(request: FastifyRequest, reply: FastifyReply) {
    const profile = await userService.getProfile(request.user.userId);
    if (!profile) {
      return reply.status(404).send({ error: 'User not found' });
    }
    return reply.send({ user: profile });
  }

  async updateMe(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = updateProfileSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: parseResult.error.errors[0]?.message || 'Dados inválidos',
      });
    }

    try {
      const updated = await userService.updateProfile(request.user.userId, parseResult.data);
      return reply.send({ user: updated });
    } catch (error: any) {
      return reply.status(400).send({
        error: 'Update Error',
        message: error.message || 'Erro ao atualizar perfil',
      });
    }
  }

  async getUser(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const profile = await userService.getProfile(id);
    if (!profile) {
      return reply.status(404).send({ error: 'User not found' });
    }
    // Return sanitized public profile
    const { email, ...publicProfile } = profile;
    return reply.send({ user: publicProfile });
  }
}

export const userController = new UserController();
