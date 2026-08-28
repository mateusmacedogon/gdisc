import type { FastifyRequest, FastifyReply } from 'fastify';
import { authService } from './auth.service.js';
import { registerSchema, loginSchema } from './auth.schema.js';

export class AuthController {
  async register(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = registerSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: parseResult.error.errors[0]?.message || 'Dados inválidos',
      });
    }

    try {
      const user = await authService.register(parseResult.data);
      const token = request.server.jwt.sign({
        userId: user.id,
        username: user.username,
        email: user.email,
      });

      return reply.status(201).send({
        user,
        token,
      });
    } catch (error: any) {
      return reply.status(400).send({
        error: 'Registration Error',
        message: error.message || 'Erro ao registrar usuário',
      });
    }
  }

  async login(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = loginSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: parseResult.error.errors[0]?.message || 'Dados inválidos',
      });
    }

    try {
      const user = await authService.login(parseResult.data);
      const token = request.server.jwt.sign({
        userId: user.id,
        username: user.username,
        email: user.email,
      });

      return reply.status(200).send({
        user,
        token,
      });
    } catch (error: any) {
      return reply.status(401).send({
        error: 'Authentication Error',
        message: error.message || 'Falha no login',
      });
    }
  }

  async me(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.userId;
    const user = await authService.getUserById(userId);

    if (!user) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Usuário não encontrado',
      });
    }

    return reply.send({ user });
  }
}

export const authController = new AuthController();
