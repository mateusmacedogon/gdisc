import { z } from 'zod';

export const createRoleSchema = z.object({
  name: z.string().min(1, 'Nome do cargo é obrigatório').max(32),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor deve ser um hexadecimal válido (ex: #6C63FF)').default('#6C63FF'),
  permissions: z.string().default('0'),
  position: z.number().int().optional(),
});

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(32).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  permissions: z.string().optional(),
  position: z.number().int().optional(),
});

export const assignRoleSchema = z.object({
  roleId: z.string().uuid(),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
