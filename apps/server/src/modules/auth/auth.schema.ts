import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('E-mail inválido'),
  username: z
    .string()
    .min(2, 'O nome de usuário deve ter pelo menos 2 caracteres')
    .max(32, 'O nome de usuário deve ter no máximo 32 caracteres')
    .regex(/^[a-zA-Z0-9_.]+$/, 'O nome de usuário só pode conter letras, números, pontos e underscores'),
  displayName: z
    .string()
    .min(1, 'O nome de exibição é obrigatório')
    .max(50, 'O nome de exibição deve ter no máximo 50 caracteres'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
});

export const loginSchema = z.object({
  emailOrUsername: z.string().min(1, 'Informe seu e-mail ou nome de usuário'),
  password: z.string().min(1, 'Informe sua senha'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
