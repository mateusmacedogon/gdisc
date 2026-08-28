import { prisma } from '../../plugins/prisma.js';
import { hashPassword, verifyPassword } from '../../utils/argon2.js';
import type { RegisterInput, LoginInput } from './auth.schema.js';
import type { UserSummary, UserProfile } from '@gdisc/shared';

export class AuthService {
  async register(input: RegisterInput) {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: input.email.toLowerCase() },
          { username: input.username.toLowerCase() },
        ],
      },
    });

    if (existing) {
      if (existing.email === input.email.toLowerCase()) {
        throw new Error('Este e-mail já está em uso.');
      }
      throw new Error('Este nome de usuário já está em uso.');
    }

    const passwordHash = await hashPassword(input.password);

    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        username: input.username.toLowerCase(),
        displayName: input.displayName.trim(),
        passwordHash,
        status: 'ONLINE',
      },
    });

    return this.sanitizeProfile(user);
  }

  async login(input: LoginInput) {
    const identifier = input.emailOrUsername.toLowerCase().trim();

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
    });

    if (!user) {
      throw new Error('Credenciais inválidas.');
    }

    const isValid = await verifyPassword(user.passwordHash, input.password);
    if (!isValid) {
      throw new Error('Credenciais inválidas.');
    }

    return this.sanitizeProfile(user);
  }

  async getUserById(userId: string): Promise<UserProfile | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return null;
    return this.sanitizeProfile(user);
  }

  private sanitizeProfile(user: any): UserProfile {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      status: user.status,
      customStatus: user.customStatus,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}

export const authService = new AuthService();
