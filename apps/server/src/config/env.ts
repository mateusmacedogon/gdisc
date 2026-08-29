import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const DEVELOPMENT_JWT_SECRET = 'gdisc_super_secret_jwt_key_development_32chars_minimum';

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().default('file:./dev.db'),
  JWT_SECRET: z.string().min(32).default(DEVELOPMENT_JWT_SECRET),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  STUN_SERVERS: z.string().default('stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302'),
}).superRefine((value, context) => {
  if (value.NODE_ENV !== 'production') return;

  if (value.JWT_SECRET === DEVELOPMENT_JWT_SECRET) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['JWT_SECRET'],
      message: 'JWT_SECRET seguro é obrigatório em produção',
    });
  }

  if (value.DATABASE_URL.startsWith('file:')) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['DATABASE_URL'],
      message: 'DATABASE_URL de produção deve apontar para PostgreSQL',
    });
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Configuração inválida de variáveis de ambiente:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
