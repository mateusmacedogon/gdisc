import { z } from 'zod';

export const createInviteSchema = z.object({
  maxUses: z.number().int().min(0).default(0),
  expiresInHours: z.number().min(0).default(0), // 0 = never
});

export type CreateInviteInput = z.infer<typeof createInviteSchema>;
