# Solution CRM

CRM SaaS local com React, TypeScript, Vite e API Node/Express. A interface foi desenhada para operação real em contexto medico: sidebar fixa, Atendimento, Funil Kanban, Campanhas, Agenda medica, Relatorios, Dashboard, Contatos/Pacientes, Grupos, Departamentos clinicos, Medicos/Usuarios, Robos, Configuracoes e Meu Perfil.

## Stack

- Frontend: React + TypeScript + Vite
- UI: CSS moderno, componentes reutilizaveis e lucide-react
- Graficos: Recharts
- Drag and drop: dnd-kit
- Backend: Node.js + Express
- Banco local: JSON persistido em `server/db/db.json`
- Arquitetura de mensagens: `MessageProvider`, `MockMessageProvider`, `GupshupProvider`, `MetaWhatsAppProvider`, `IHelpProvider`

## Instalar

```bash
npm install
```

## Rodar em desenvolvimento

```bash
npm run dev
```

Frontend: `http://localhost:5173`

API: `http://localhost:4000`

## Build e qualidade

```bash
npm run build
npm run lint
```

## Variaveis `.env`

O app funciona em modo mock sem variaveis. Para preparar providers reais, use:

```env
PORT=4000
META_WHATSAPP_TOKEN=
META_WHATSAPP_PHONE_NUMBER_ID=
GUPSHUP_API_KEY=
GUPSHUP_APP_NAME=
IHELP_API_KEY=
```

Se nenhuma chave existir, o backend usa `MockMessageProvider`.

## Endpoints principais

- `GET /api/bootstrap`
- `GET/POST/PUT/DELETE /api/funnels`
- `POST /api/funnels/:id/duplicate`
- `GET/POST/PUT/DELETE /api/stages`
- `GET/POST/PUT/DELETE /api/cards`
- `PUT /api/cards/:id/move`
- `GET/POST/PUT/DELETE /api/departments`
- `GET/POST/PUT/DELETE /api/contacts`
- `GET/POST/PUT/DELETE /api/appointments`
- `GET/POST/PUT/DELETE /api/campaigns`
- `POST /api/campaigns/:id/send-test`
- `POST /api/campaigns/:id/simulate-send`
- `GET/POST/PUT/DELETE /api/users`
- `GET/POST/PUT/DELETE /api/groups`
- `GET/POST/PUT/DELETE /api/bots`
- `GET /api/reports/summary`
- `GET /api/reports/charts`
- `GET /api/reports/table`
- `GET/PUT /api/settings`
- `POST /api/messages/send`
- `POST /api/webhooks/inbound-message`

## Webhook de mensagem recebida

```bash
curl -X POST http://localhost:4000/api/webhooks/inbound-message \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"+554999999999\",\"body\":\"Ola, quero atendimento\",\"provider\":\"mock\"}"
```

## Modelo de dados

O seed local cria Workspace, User, Department, Channel, Funnel, Stage, Contact, Tag, Card, Message, Appointment, Campaign, Group, AutomationBot, ActivityLog e Setting.

Conta inicial: `Clinica Solution`

Departamentos iniciais:

- Recepcao
- Triagem
- Consultorios
- Centro Cirurgico
- Exames e Diagnostico
- Financeiro

Funil inicial: `Gravacao`

Etapas iniciais:

- Novo paciente
- Triagem
- Consulta marcada
- Em tratamento
- Alta / concluido

A base inicial nasce sem leads/cards e sem contatos, para começar limpa. A agenda vem com exemplos clinicos de consulta, cirurgia, reuniao, retorno e exame para demonstrar o calendario por medico.

## Trocar para Supabase/PostgreSQL

A API ja centraliza persistencia no backend. O proximo passo recomendado e substituir as funcoes `readDb`/`writeDb` por repositories com Prisma ou Supabase, mantendo os contratos REST atuais.

Variaveis sugeridas:

```env
DATABASE_URL=postgresql://...
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=
```

Entidades recomendadas para schema SQL:

- workspaces
- users
- departments
- channels
- funnels
- stages
- contacts
- tags
- card_tags
- cards
- messages
- appointments
- campaigns
- campaign_recipients
- groups
- group_contacts
- automation_bots
- activity_logs
- settings

## Limitacoes atuais

- Providers externos estao em modo adapter/mock; as classes reais ja existem como ponto de extensao.
- Autenticacao e permissoes ainda sao locais/simuladas.
- O banco JSON e suficiente para desenvolvimento local, mas nao substitui PostgreSQL em producao.

## Criterios cobertos

- Sem `prompt()`, `confirm()` ou `alert()` no codigo do app.
- Validacao contra funil, etapa, card, departamento, contato, campanha e agendamento vazios.
- Cards criados aparecem imediatamente e atualizam contadores/relatorios.
- Cards movidos no Kanban persistem via API.
- Campanhas e agendamentos impactam dashboard/relatorios.
- Modais, drawers, toasts, filtros, tabelas, graficos e empty states funcionais.
