import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import { DEFAULT_EVERYONE_PERMISSIONS, PermissionFlags } from '@gdisc/shared';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16,
    timeCost: 3,
    parallelism: 1,
  });
}

async function main() {
  console.log('🌱 Iniciando seed do banco de dados GDisC...');

  const defaultPasswordHash = await hashPassword('password123');

  // 1. Create Demo Users
  const alex = await prisma.user.upsert({
    where: { email: 'alex@gdisc.dev' },
    update: {},
    create: {
      email: 'alex@gdisc.dev',
      username: 'alex',
      displayName: 'Alex Rivers',
      passwordHash: defaultPasswordHash,
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      bio: 'Engenheiro de software e entusiasta de WebRTC & Realtime.',
      status: 'ONLINE',
      customStatus: 'Construindo o futuro do GDisC ⚡',
    },
  });

  const elena = await prisma.user.upsert({
    where: { email: 'elena@gdisc.dev' },
    update: {},
    create: {
      email: 'elena@gdisc.dev',
      username: 'elena',
      displayName: 'Elena Rostova',
      passwordHash: defaultPasswordHash,
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      bio: 'Product Designer focada em interfaces minimalistas e rápidas.',
      status: 'ONLINE',
      customStatus: 'Refinando o design system 🎨',
    },
  });

  const neo = await prisma.user.upsert({
    where: { email: 'neo@gdisc.dev' },
    update: {},
    create: {
      email: 'neo@gdisc.dev',
      username: 'neo',
      displayName: 'Neo Matrix',
      passwordHash: defaultPasswordHash,
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      bio: 'Desenvolvedor backend e performance specialist.',
      status: 'IDLE',
      customStatus: 'Otimizando pipelines 🚀',
    },
  });

  console.log(`👤 Usuários criados: ${alex.username}, ${elena.username}, ${neo.username}`);

  // 2. Create Demo Server
  let server = await prisma.server.findFirst({
    where: { name: 'GDisC Comunidade Tech' },
  });

  if (!server) {
    server = await prisma.server.create({
      data: {
        name: 'GDisC Comunidade Tech',
        description: 'Servidor oficial da comunidade de desenvolvedores e criadores GDisC.',
        iconUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
        ownerId: alex.id,
        roles: {
          create: [
            {
              name: '@everyone',
              color: '#9AA4B2',
              position: 0,
              permissions: DEFAULT_EVERYONE_PERMISSIONS.toString(),
              isDefault: true,
            },
            {
              name: 'Core Team',
              color: '#6C63FF',
              position: 1,
              permissions: PermissionFlags.ADMINISTRATOR.toString(),
              isDefault: false,
            },
          ],
        },
        channels: {
          create: [
            {
              name: 'boas-vindas',
              type: 'TEXT',
              topic: 'Regras e novidades da comunidade',
              position: 0,
            },
            {
              name: 'geral',
              type: 'TEXT',
              topic: 'Discussões gerais e bate-papo',
              position: 1,
            },
            {
              name: 'desenvolvimento',
              type: 'TEXT',
              topic: 'Código, WebRTC, Fastify e React',
              position: 2,
            },
            {
              name: 'Voz Geral',
              type: 'VOICE',
              topic: 'Chamada de voz e vídeo principal',
              position: 3,
            },
            {
              name: 'Sala de Foco',
              type: 'VOICE',
              topic: 'Pair programming e compartilhamento de tela',
              position: 4,
            },
          ],
        },
        members: {
          create: [
            { userId: alex.id },
            { userId: elena.id },
            { userId: neo.id },
          ],
        },
        invites: {
          create: [
            {
              code: 'gdisc-demo',
              creatorId: alex.id,
              maxUses: 0,
            },
          ],
        },
      },
    });

    console.log(`🌐 Servidor criado: ${server.name}`);

    // Add initial messages
    const generalChannel = await prisma.channel.findFirst({
      where: { serverId: server.id, name: 'geral' },
    });

    if (generalChannel) {
      await prisma.message.createMany({
        data: [
          {
            channelId: generalChannel.id,
            authorId: alex.id,
            content: 'Sejam muito bem-vindos ao **GDisC**! 🚀 Nossa plataforma de comunicação em tempo real de ultra-baixa latência.',
          },
          {
            channelId: generalChannel.id,
            authorId: elena.id,
            content: 'A interface ficou incrivelmente rápida e elegante! O tema escuro com a paleta original #6C63FF está impecável.',
          },
          {
            channelId: generalChannel.id,
            authorId: neo.id,
            content: 'Conexão WebRTC P2P pronta para voz, vídeo e compartilhamento de tela com quase 0ms de atraso.',
          },
        ],
      });
      console.log('💬 Mensagens de demonstração adicionadas');
    }
  }

  console.log('✨ Seed concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
