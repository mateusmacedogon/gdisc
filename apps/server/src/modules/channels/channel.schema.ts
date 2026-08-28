import { z } from 'zod';

export const createChannelSchema = z.object({
  name: z
    .string()
    .min(1, 'Nome do canal é obrigatório')
    .max(32, 'Nome muito longo')
    .transform((v) => v.toLowerCase().replace(/\s+/g, '-')),
  type: z.enum(['TEXT', 'VOICE']),
  topic: z.string().max(250).optional(),
  position: z.number().int().optional(),
  isPrivate: z.boolean().optional(),
});

export const updateChannelSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(32)
    .transform((v) => v.toLowerCase().replace(/\s+/g, '-'))
    .optional(),
  topic: z.string().max(250).optional().nullable(),
  position: z.number().int().optional(),
  isPrivate: z.boolean().optional(),
});

export type CreateChannelInput = z.infer<typeof createChannelSchema>;
export type UpdateChannelInput = z.infer<typeof updateChannelSchema>;
