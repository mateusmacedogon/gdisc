# 🚀 GDisC

> **GDisC** é uma plataforma moderna, original, ultra-leve e de alta performance para comunicação em comunidade (texto, voz, vídeo e compartilhamento de tela WebRTC).

---

## 💎 Destaques e Diferenciais

- **Arquitetura Ultra-Leve:** Construído visando baixo consumo de RAM e CPU, sem bibliotecas desnecessárias.
- **Identidade Visual Original:** Tema escuro moderno com paleta personalizada (`#0B0D12`, `#11141B`, `#171B24`, `#6C63FF`), microinterações a 140ms e animações sem travamento.
- **Comunicação WebRTC Mesh P2P:** Chamadas de áudio, vídeo em alta definição e compartilhamento de tela com Voice Activity Detection (VAD) dinâmico via Web Audio API.
- **Chat em Tempo Real:** WebSocket persistente com envio instantâneo, paginação por cursor, respostas a mensagens, edição/exclusão e indicadores de digitação.
- **Sistema de Permissões Bitwise:** Cálculo de permissões em tempo de execução $O(1)$ tanto no backend quanto no frontend com cargos customizáveis e paleta de cores.
- **Segurança de Ponta:** Hashing de senhas com Argon2id, tokens JWT seguros, Rate Limiting, Helmet e validação rigorosa de esquemas com Zod.
- **Desktop Ready:** Estrutura modular preparada para empacotamento com **Tauri** (Rust + Webview2).

---

## 🛠️ Stack Tecnológica

### Frontend (`apps/client`)
- **React 19 + TypeScript** com **Vite 6**
- **Tailwind CSS** com design system GDisC
- **Zustand** (gerenciamento de estado reativo e atômico)
- **WebRTC Nativo (`RTCPeerConnection`) + Web Audio API (`AnalyserNode`)**
- **Lucide Icons**

### Backend (`apps/server`)
- **Node.js 24 LTS + Fastify 5 + TypeScript**
- **`@fastify/websocket`** (Gateway WebSocket em tempo real)
- **Argon2id** (Criptografia de senhas recomendada pela OWASP)
- **`@fastify/jwt`**, **`@fastify/rate-limit`**, **`@fastify/helmet`**, **`@fastify/cors`**
- **Zod** (Validação rigorosa de contratos e payloads)

### Banco de Dados & Pacotes
- **Prisma ORM** com suporte flexível a SQLite (dev local imediato) e PostgreSQL (produção)
- **`packages/shared`** (Tipos, eventos WebSocket e bitmask de permissões compartilhados)

---

## 📁 Estrutura do Projeto

```
/gdisc
├── apps
│   ├── client                 # Frontend React + Vite + Tailwind + Zustand
│   └── server                 # Backend Fastify + WebSocket + Prisma
├── packages
│   └── shared                 # Contratos, tipos, eventos e bitwise permissions
├── .env.example               # Exemplo de variáveis de ambiente
├── package.json               # Configuração do Monorepo (npm workspaces)
└── README.md
```

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- **Node.js:** `v20+` (Recomendado `v24+`)
- **npm:** `v10+`

### 1. Clonar e Instalar Dependências
```bash
npm install
```

### 2. Configurar Variáveis de Ambiente
Copie o arquivo de exemplo para `.env`:
```bash
cp .env.example .env
cp .env.example apps/server/.env
```

### 3. Inicializar o Banco de Dados e Seed
Gere o cliente Prisma, execute as migrations e popule o banco com dados de teste:
```bash
npm run db:push
npm run db:seed
```

O seed criará 3 usuários prontos para teste com a senha padrão `password123`:
- `alex@gdisc.dev` (Alex Rivers - Proprietário da Comunidade Tech)
- `elena@gdisc.dev` (Elena Rostova - Designer)
- `neo@gdisc.dev` (Neo Matrix - Desenvolvedor)

### 4. Iniciar em Modo de Desenvolvimento
Inicie o backend e o frontend simultaneamente:
```bash
# Terminal 1 - Inicia Backend (porta 4000)
npm run dev:server

# Terminal 2 - Inicia Frontend (porta 5173)
npm run dev:client
```

Abra seu navegador em [http://localhost:5173](http://localhost:5173).

---

## 🧪 Testes Automatizados

Para executar a suíte de testes unitários:
```bash
npm test
```

---

## 📦 Build para Produção

Para compilar todos os pacotes e gerar os bundles otimizados:
```bash
npm run build
```

---

## 🔮 Futuro Desktop (Tauri)

Devido ao foco em leveza e baixo consumo de memória RAM do GDisC, a versão desktop deve utilizar **Tauri 2.0**:
```bash
npm install -D @tauri-apps/cli
npx tauri init
```
Isso produzirá um executável nativo consumindo menos de 40 MB de memória RAM.

---

## 📄 Licença
Distribuído sob a licença MIT.
