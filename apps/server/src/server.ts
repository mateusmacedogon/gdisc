import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import websocket from '@fastify/websocket';

import { env } from './config/env.js';
import { connectPrisma } from './plugins/prisma.js';
import jwtPlugin from './plugins/jwt.js';

import { authRoutes } from './modules/auth/auth.routes.js';
import { userRoutes } from './modules/users/user.routes.js';
import { serverRoutes } from './modules/servers/server.routes.js';
import { channelRoutes } from './modules/channels/channel.routes.js';
import { messageRoutes } from './modules/messages/message.routes.js';
import { roleRoutes } from './modules/roles/role.routes.js';
import { inviteRoutes } from './modules/invites/invite.routes.js';
import { setupWebSocket } from './realtime/wsHandler.js';

const fastify = Fastify({
  logger: true,
});

async function bootstrap() {
  try {
    // 1. Connect Database
    await connectPrisma();

    // 2. Core Security & Middleware Plugins
    await fastify.register(cors, {
      origin: true, // Allow frontend during development and configured domains
      credentials: true,
    });

    await fastify.register(helmet, {
      contentSecurityPolicy: false, // Managed per deployment needs
    });

    await fastify.register(rateLimit, {
      max: 200,
      timeWindow: '1 minute',
    });

    await fastify.register(sensible);
    await fastify.register(jwtPlugin);
    await fastify.register(websocket);

    // 3. Setup WebSocket Gateway
    setupWebSocket(fastify);

    // 4. Register Healthcheck
    fastify.get('/api/health', async () => {
      return {
        status: 'ok',
        app: 'GDisC Server',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      };
    });

    // 5. Register REST Module Routes
    await fastify.register(authRoutes, { prefix: '/api/auth' });
    await fastify.register(userRoutes, { prefix: '/api/users' });
    await fastify.register(serverRoutes, { prefix: '/api/servers' });
    await fastify.register(channelRoutes, { prefix: '/api' });
    await fastify.register(messageRoutes, { prefix: '/api' });
    await fastify.register(roleRoutes, { prefix: '/api' });
    await fastify.register(inviteRoutes, { prefix: '/api' });

    // 6. Listen on designated PORT & HOST
    await fastify.listen({ port: env.PORT, host: env.HOST });
    console.log(`🚀 GDisC Server rodando em http://${env.HOST}:${env.PORT}`);
    console.log(`⚡ WebSocket Gateway ativo em ws://${env.HOST}:${env.PORT}/ws`);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
}

bootstrap();
