import { z } from 'zod';

export const createMessageSchema = z.object({
  content: z.string().min(1, 'Mensagem não pode estar vazia').max(4000, 'Mensagem muito longa'),
  replyToId: z.string().uuid().optional().nullable(),
});

export const updateMessageSchema = z.object({
  content: z.string().min(1, 'Mensagem não pode estar vazia').max(4000, 'Mensagem muito longa'),
});

export const getMessagesQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type UpdateMessageInput = z.infer<typeof updateMessageSchema>;
export type GetMessagesQuery = z.infer<typeof getMessagesQuerySchema>;
