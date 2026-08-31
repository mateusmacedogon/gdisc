# GDisC

Plataforma de comunidades em tempo real inspirada no Discord, com texto, presença, voz, vídeo e compartilhamento de tela. O mesmo cliente React é usado pela web e foi estruturado para ser empacotado futuramente com Capacitor (Android/iOS) e Tauri (Windows).

## Arquitetura atual

```text
Web (Vercel) ─┐
Mobile        ├─> Supabase Auth + Data API + Realtime ─> PostgreSQL com RLS
Windows       ┘
                    └─> Broadcast/Presence para digitação, presença e sinalização WebRTC
```

- `apps/client`: React 19, Vite, Tailwind e Zustand.
- `packages/shared`: contratos TypeScript, eventos e permissões bitmask.
- `supabase/migrations`: schema versionado, índices, triggers, funções e políticas RLS.
- `apps/server`: servidor Fastify legado mantido como fallback local; não é necessário para o deploy Vercel.

O deploy web não chama mais `/api` no próprio domínio. Isso era a causa do cadastro quebrado: a rota retornava `index.html`, pois somente o SPA estava publicado.

## Funcionalidades

- Cadastro e login por e-mail com Supabase Auth, sessão persistente e confirmação de e-mail suportada.
- Perfis, status e presença.
- Servidores/comunidades, membros e convites.
- Canais de texto e voz.
- Mensagens com resposta, edição, exclusão e paginação por cursor.
- Indicador de digitação e sincronização em tempo real.
- Cargos e permissões.
- Voz, vídeo, mute/deafen, seleção de dispositivos, VAD e compartilhamento de tela por WebRTC.
- Layout responsivo para celular, tablet e desktop.

## Executar localmente

Requisitos: Node.js 22 ou superior e npm 10 ou superior.

```bash
npm install
cp .env.example .env
```

Preencha no `.env` apenas as duas configurações públicas do cliente:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Nunca coloque `service_role` ou `sb_secret_...` em uma variável `VITE_*`: tudo com esse prefixo é incorporado ao bundle público.

Depois:

```bash
npm run dev:client
```

A aplicação estará em `http://localhost:5173`.

### Supabase local opcional

Com Docker em execução:

```bash
npx supabase start
npx supabase db reset
```

Use a URL e a publishable/anon key exibidas por `npx supabase status` no seu `.env`.

## Auth em produção

No painel Supabase, configure:

- Site URL: `https://gdisc-client.vercel.app`
- Redirect URLs: `http://localhost:5173/**`, os domínios de preview da Vercel e, no futuro, `com.gdisc.app://**`
- SMTP próprio antes de depender de e-mails transacionais em produção

Se confirmação de e-mail estiver habilitada, o cadastro cria a conta e a interface orienta o usuário a confirmar o endereço antes do primeiro login.

## Qualidade e build

```bash
npm test
npm run typecheck
npm run build
npm run build:all
```

O build padrão compila o pacote compartilhado e gera o frontend em `dist`, diretório publicado pela Vercel. `build:all` também compila o servidor legado.

## Vercel

O projeto canônico é `gdisc-client`. A configuração em `vercel.json` publica `dist`, mantém o fallback de rotas do SPA e adiciona headers básicos de segurança.

As variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` devem existir em Production e Preview. O arquivo `.env.production` versiona apenas esses valores públicos para que clones e deploys atuais continuem reproduzíveis.

## Mobile e Windows

O frontend não depende de URLs relativas a um backend local; ele conversa diretamente com APIs HTTPS/WSS do Supabase. Isso permite reutilizar o mesmo bundle.

- Mobile: `apps/client/capacitor.config.json` usa somente HTTPS e desativa mixed content/debug de produção. O projeto nativo completo, secure storage, deep links, notificações push e áudio em background são as próximas etapas antes de publicar nas lojas.
- Windows: `apps/client/src-tauri` contém configuração Tauri 2, bootstrap Rust e CSP restrita ao projeto Supabase. Assinatura, updater, ícones finais e secure storage devem ser configurados antes da distribuição.

O WebRTC atual é mesh P2P. Para chamadas confiáveis fora de redes domésticas, configure servidores TURN; para salas grandes, migre a mídia para uma SFU.

O cliente aceita TURN estático pelas variáveis `VITE_TURN_URLS`, `VITE_TURN_USERNAME` e `VITE_TURN_CREDENTIAL`. Em produção, prefira `VITE_TURN_CREDENTIALS_URL`: o cliente consulta esse endpoint com o JWT do usuário, valida a resposta e mantém credenciais temporárias em cache por cinco minutos. O endpoint pode retornar um array de `RTCIceServer` ou `{ "iceServers": [...] }`.

A chamada monitora RTT, perda de pacotes e fluxo de bytes com `getStats()`. Quando detecta mídia travada, tenta reiniciar o ICE e, se necessário, recria o par automaticamente. Vídeo e tela reduzem bitrate, resolução e FPS durante perda alta, recuperando a qualidade quando a rede estabiliza.

## Segurança do banco

- Toda tabela exposta usa RLS.
- Leitura e escrita são limitadas por associação ao servidor, propriedade e/ou permissão.
- O cliente usa somente publishable key; nenhuma chave privilegiada é necessária.
- Funções privilegiadas validam `auth.uid()`, têm `search_path` fixo e execução revogada por padrão.
- Colunas de FKs e filtros de RLS são indexadas.
- Grants da Data API são explícitos para compatibilidade com projetos Supabase novos.

## Servidor Fastify legado

O fallback em `apps/server` continua compilável para desenvolvimento específico, mas não é o backend da versão Vercel. Se for executado, configure `DATABASE_URL`, `JWT_SECRET` seguro e `CLIENT_ORIGIN`; não use os defaults de desenvolvimento em produção.

## Licença

MIT
