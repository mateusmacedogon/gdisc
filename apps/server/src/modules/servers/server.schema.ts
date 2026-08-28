import { z } from 'zod';

export const createServerSchema = z.object({
  name: z.string().min(1, 'Nome do servidor é obrigatório').max(64, 'Nome muito longo'),
  description: z.string().max(300).optional(),
  iconUrl: z.string().url().or(z.literal('')).optional().nullable(),
});

export const updateServerSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  description: z.string().max(300).optional().nullable(),
  iconUrl: z.string().url().or(z.literal('')).optional().nullable(),
});

export type CreateServerInput = z.infer<typeof createServerSchema>;
export type UpdateServerInput = z.infer<typeof updateServerSchema>;
