import cors from 'cors'
import express from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { createMessageProvider } from './services/messageProviders.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const clientDist = path.join(__dirname, '..', 'dist')
const dbDir = path.join(__dirname, 'db')
const dbFile = path.join(dbDir, 'db.json')
const app = express()
const provider = createMessageProvider()
const sessionCookie = 'solution_crm_session'
const sessionSecret = process.env.SESSION_SECRET || 'solution-crm-dev-secret'
const sessionMaxAge = 60 * 60 * 24 * 7

app.use(cors())
app.use(express.json({ limit: '2mb' }))

const collections = [
  'workspaces',
  'users',
  'departments',
  'channels',
  'funnels',
  'stages',
  'contacts',
  'tags',
  'cards',
  'messages',
  'emails',
  'emailTemplates',
  'appointments',
  'campaigns',
  'campaignRecipients',
  'groups',
  'groupContacts',
  'automationBots',
  'activityLogs',
  'settings',
]

const colors = {
  red: '#ef4444',
  blue: '#3498db',
  green: '#22c55e',
  orange: '#f59e0b',
  purple: '#8b5cf6',
  gray: '#64748b',
}

function now() {
  return new Date().toISOString()
}

function id(prefix) {
  return `${prefix}_${randomUUID().slice(0, 8)}`
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : value
}

function cleanObject(input = {}) {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, clean(value)]))
}

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  return { salt, hash: scryptSync(String(password), salt, 64).toString('hex') }
}

function verifyPassword(password, salt, hash) {
  if (!salt || !hash) return false
  const candidate = Buffer.from(hashPassword(password, salt).hash, 'hex')
  const stored = Buffer.from(hash, 'hex')
  return stored.length === candidate.length && timingSafeEqual(stored, candidate)
}

function publicUser(user = {}) {
  const { passwordHash, passwordSalt, ...safeUser } = user
  return safeUser
}

function signSession(userId) {
  const payload = Buffer.from(JSON.stringify({ userId, exp: Date.now() + sessionMaxAge * 1000 })).toString('base64url')
  const signature = createHmac('sha256', sessionSecret).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

function readCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map((item) => item.trim()).filter(Boolean).map((item) => {
    const index = item.indexOf('=')
    return [decodeURIComponent(item.slice(0, index)), decodeURIComponent(item.slice(index + 1))]
  }))
}

function verifySession(value = '') {
  try {
    const [payload, signature] = value.split('.')
    if (!payload || !signature) return null
    const expected = createHmac('sha256', sessionSecret).update(payload).digest('base64url')
    const signatureBuffer = Buffer.from(signature)
    const expectedBuffer = Buffer.from(expected)
    const valid = signatureBuffer.length === expectedBuffer.length && timingSafeEqual(signatureBuffer, expectedBuffer)
    if (!valid) return null
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (!parsed.userId || parsed.exp < Date.now()) return null
    return parsed.userId
  } catch {
    return null
  }
}

function setSession(res, userId) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader('Set-Cookie', `${sessionCookie}=${encodeURIComponent(signSession(userId))}; HttpOnly; Path=/; Max-Age=${sessionMaxAge}; SameSite=Lax${secure}`)
}

function clearSession(res) {
  res.setHeader('Set-Cookie', `${sessionCookie}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`)
}

function normalizePhone(phone = '') {
  const digits = String(phone).replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('55')) return `+${digits}`
  return `+55${digits}`
}

function ensureName(payload, field = 'name') {
  if (!clean(payload[field])) {
    const error = new Error(`${field} is required`)
    error.status = 400
    throw error
  }
}

function findUserByLogin(data, login) {
  const value = clean(login || '').toLowerCase()
  if (value === 'admin') return data.users.find((item) => item.id === 'user_admin')
  return data.users.find((item) => item.email.toLowerCase() === value)
}

function seed() {
  const createdAt = '2026-05-20T12:00:00.000Z'
  const workspaceId = 'workspace_solution'
  const users = [
    { id: 'user_admin', workspaceId, name: 'Dra. Marina Costa', email: 'marina@clinicasolution.com', role: 'administrador', title: 'Diretora Clinica', departmentId: 'dep_consultorios', status: 'active', avatarUrl: '', specialty: 'Clínica Geral', crm: 'CRM-SP 184221', createdAt, updatedAt: createdAt },
    { id: 'user_ortopedia', workspaceId, name: 'Dr. Rafael Nunes', email: 'rafael@clinicasolution.com', role: 'medico', title: 'Medico Ortopedista', departmentId: 'dep_cirurgico', status: 'active', avatarUrl: '', specialty: 'Ortopedia', crm: 'CRM-SP 221450', createdAt, updatedAt: createdAt },
    { id: 'user_cardio', workspaceId, name: 'Dra. Helena Martins', email: 'helena@clinicasolution.com', role: 'medico', title: 'Medica Cardiologista', departmentId: 'dep_exames', status: 'active', avatarUrl: '', specialty: 'Cardiologia', crm: 'CRM-SP 198773', createdAt, updatedAt: createdAt },
    { id: 'user_recepcao', workspaceId, name: 'Ana Recepcao', email: 'recepcao@clinicasolution.com', role: 'atendente', title: 'Recepcao', departmentId: 'dep_recepcao', status: 'active', avatarUrl: '', specialty: '', crm: '', createdAt, updatedAt: createdAt },
  ]
  const departments = [
    ['dep_recepcao', 'Recepcao', 'blue', 'Entrada de pacientes, check-in e autorizacoes'],
    ['dep_triagem', 'Triagem', 'green', 'Classificacao inicial e sinais vitais'],
    ['dep_consultorios', 'Consultorios', 'purple', 'Consultas medicas e retornos'],
    ['dep_cirurgico', 'Centro Cirurgico', 'red', 'Procedimentos, cirurgias e pre-operatorio'],
    ['dep_exames', 'Exames e Diagnostico', 'orange', 'Exames, laudos e preparos'],
    ['dep_financeiro', 'Financeiro', 'gray', 'Guias, recebimentos e repasses'],
  ].map(([departmentId, name, color, description]) => ({ id: departmentId, workspaceId, name, color, description, createdAt, updatedAt: createdAt }))
  const channels = ['Robo WhatsApp', 'WhatsApp', 'Telefone', 'Site', 'Indicacao', 'Convenio', 'Presencial', 'Manual'].map((nameValue, index) => ({
    id: `channel_${index + 1}`,
    workspaceId,
    name: nameValue,
    type: nameValue.includes('WhatsApp') ? 'whatsapp' : 'manual',
    status: 'Simulado',
    createdAt,
    updatedAt: createdAt,
  }))
  const funnelId = 'funnel_gravacao'
  const stages = [
    ['stage_n8n', 'N8N / Robô', 'red'],
    ['stage_aulas', 'Triagem', 'blue'],
    ['stage_audio', 'Consulta marcada', 'purple'],
    ['stage_prova', 'Em tratamento', 'green'],
    ['stage_finalizada', 'Alta / concluido', 'orange'],
  ].map(([stageId, name, color], order) => ({ id: stageId, workspaceId, funnelId, name, color, order, createdAt, updatedAt: createdAt }))
  const tagNames = ['particular', 'convenio', 'retorno', 'pre-operatorio', 'prioritario']
  const tags = tagNames.map((nameValue, index) => ({ id: `tag_${index + 1}`, workspaceId, name: nameValue, color: Object.values(colors)[index], createdAt, updatedAt: createdAt }))
  const patientSeed = [
    ['contact_1', 'Camila Andrade', '+55 11 98222-1401', 'camila.andrade@email.com', 'channel_1', 'dep_recepcao', ['tag_2'], 'consulta'],
    ['contact_2', 'Joao Pedro Lima', '+55 11 97777-8831', 'joao.lima@email.com', 'channel_1', 'dep_consultorios', ['tag_3'], 'remarcacao'],
    ['contact_3', 'Marcia Figueiredo', '+55 11 96666-2209', 'marcia.fig@email.com', 'channel_2', 'dep_exames', ['tag_5'], 'exame'],
    ['contact_4', 'Roberto Santana', '+55 11 95555-0192', 'roberto.santana@email.com', 'channel_1', 'dep_cirurgico', ['tag_4'], 'cirurgia'],
    ['contact_5', 'Patricia Gomes', '+55 11 94444-7820', 'patricia.gomes@email.com', 'channel_1', 'dep_triagem', ['tag_1'], 'atendente'],
  ]
  const contacts = patientSeed.map(([contactId, name, phone, email, channelId, departmentId, tagIds]) => ({
    id: contactId,
    workspaceId,
    name,
    phone: normalizePhone(phone),
    email,
    avatarUrl: '',
    channelId,
    departmentId,
    tagIds,
    createdAt,
    updatedAt: createdAt,
  }))
  const cards = contacts.map((contact, index) => ({
    id: `card_${index + 1}`,
    workspaceId,
    title: `Paciente - ${contact.name}`,
    description: [
      'Robô iniciou triagem e paciente escolheu marcar consulta.',
      'Paciente pediu remarcação pelo menu automático.',
      'Paciente solicitou orientação para exame.',
      'Paciente confirmou dados para cirurgia.',
      'Paciente pediu falar com atendente humano.',
    ][index],
    contactId: contact.id,
    phone: contact.phone,
    funnelId,
    stageId: index === 0 || index === 4 ? 'stage_n8n' : index === 1 ? 'stage_audio' : index === 2 ? 'stage_aulas' : 'stage_prova',
    departmentId: contact.departmentId,
    channelId: contact.channelId,
    assignedUserId: index === 3 ? 'user_ortopedia' : index === 2 ? 'user_cardio' : 'user_admin',
    priority: index === 3 ? 'alta' : 'normal',
    status: 'aberto',
    value: 0,
    position: index,
    dueAt: '',
    lastMessageAt: createdAt,
    tagIds: contact.tagIds,
    createdAt,
    updatedAt: createdAt,
  }))
  const menu = 'Ola! Sou o assistente virtual da Clinica Vida Prime. Escolha uma das opcoes abaixo:\\n1 - Marcar consulta\\n2 - Remarcar consulta\\n3 - Confirmar consulta\\n4 - Exames e preparo\\n5 - Falar com atendente'
  const conversationSeed = [
    [
      ['outbound', menu],
      ['inbound', '1'],
      ['outbound', 'Perfeito. Para marcar consulta, escolha a especialidade:\\n1 - Clinica geral\\n2 - Cardiologia\\n3 - Ortopedia\\n4 - Dermatologia'],
      ['inbound', '2'],
      ['outbound', 'Tenho horários com a Dra. Helena amanhã às 09:00 ou 14:30. Responda 1 para 09:00 ou 2 para 14:30.'],
      ['inbound', '1'],
      ['outbound', 'Consulta cardiologica pre-agendada para amanha as 09:00. Enviaremos confirmacao final por aqui.'],
    ],
    [
      ['outbound', menu],
      ['inbound', '2'],
      ['outbound', 'Sem problema. Envie o numero da opcao da consulta que deseja remarcar:\\n1 - Consulta de hoje 16:00\\n2 - Retorno sexta 10:30'],
      ['inbound', '1'],
      ['outbound', 'Certo. Escolha o novo horário:\\n1 - Amanhã 11:00\\n2 - Quinta 15:00\\n3 - Sexta 08:30'],
      ['inbound', '2'],
      ['outbound', 'Remarcacao registrada para quinta as 15:00. Digite 9 se quiser falar com a recepcao.'],
    ],
    [
      ['outbound', menu],
      ['inbound', '4'],
      ['outbound', 'Para qual exame voce precisa de preparo?\\n1 - Eletrocardiograma\\n2 - Risco cirurgico\\n3 - Exames laboratoriais'],
      ['inbound', '2'],
      ['outbound', 'Preparo para risco cirurgico: leve exames anteriores, documento com foto e chegue 20 minutos antes. Deseja confirmar presenca?\\n1 - Sim\\n2 - Nao'],
      ['inbound', '1'],
      ['outbound', 'Presenca confirmada. Um lembrete sera enviado no dia anterior.'],
    ],
    [
      ['outbound', menu],
      ['inbound', '3'],
      ['outbound', 'Encontrei uma cirurgia de joelho agendada para sexta as 13:00 com Dr. Rafael. Deseja confirmar?\\n1 - Confirmar\\n2 - Falar com equipe cirurgica'],
      ['inbound', '1'],
      ['outbound', 'Cirurgia confirmada. Checklist pre-operatorio enviado: jejum de 8h, exames em maos e chegada as 11:30.'],
    ],
    [
      ['outbound', menu],
      ['inbound', '5'],
      ['outbound', 'Tudo bem. Vou transferir para a recepcao. Enquanto isso, diga em poucas palavras o que voce precisa.'],
      ['inbound', 'Quero saber se meu convenio cobre consulta com ortopedista.'],
      ['outbound', 'Recebido. A recepcao ja foi acionada e respondera por aqui.'],
    ],
  ]
  const messages = conversationSeed.flatMap((items, contactIndex) => items.map(([direction, body], messageIndex) => ({
    id: `msg_${contactIndex + 1}_${messageIndex + 1}`,
    workspaceId,
    contactId: contacts[contactIndex].id,
    cardId: cards[contactIndex].id,
    direction,
    body,
    provider: direction === 'outbound' ? 'mock-n8n' : 'whatsapp',
    status: direction === 'outbound' ? 'sent' : 'received',
    createdAt: new Date(new Date(createdAt).getTime() + (contactIndex * 20 + messageIndex) * 60000).toISOString(),
  })))
  const campaigns = []
  const appointmentsSeed = [
    ['Consulta cardiologica', 'Consulta', 'user_cardio', 'dep_consultorios', '2026-05-21', '09:00', '09:45'],
    ['Cirurgia de joelho', 'Cirurgia', 'user_ortopedia', 'dep_cirurgico', '2026-05-22', '13:00', '15:30'],
    ['Reuniao de equipe clinica', 'Reuniao', 'user_admin', 'dep_triagem', '2026-05-23', '08:00', '08:40'],
    ['Retorno pos-operatorio', 'Retorno', 'user_ortopedia', 'dep_consultorios', '2026-05-24', '10:30', '11:00'],
    ['Exame de risco cirurgico', 'Exame', 'user_cardio', 'dep_exames', '2026-05-25', '15:00', '15:30'],
  ]
  const appointments = appointmentsSeed.map(([nameValue, type, assignedUserId, departmentId, date, startTime, endTime], index) => ({
    id: `appointment_${index + 1}`,
    workspaceId,
    title: nameValue,
    type,
    description: 'Agenda medica demonstrativa, sem paciente vinculado.',
    date,
    startTime,
    endTime,
    contactId: '',
    cardId: '',
    departmentId,
    assignedUserId,
    room: index === 1 ? 'Sala cirurgica 2' : `Consultorio ${index + 1}`,
    status: index === 1 ? 'confirmado' : 'pendente',
    reminderMinutes: 30,
    notes: '',
    createdAt,
    updatedAt: createdAt,
  }))
  const emails = [
    {
      id: 'email_1',
      workspaceId,
      contactId: 'contact_1',
      ownerUserId: 'user_cardio',
      assignedUserId: 'user_cardio',
      from: 'camila.andrade@email.com',
      to: 'helena@clinicasolution.com',
      subject: 'Duvida sobre preparo para consulta',
      body: 'Dra. Helena, devo levar exames anteriores para a consulta cardiologica?',
      direction: 'inbound',
      status: 'unread',
      createdAt: '2026-05-20T15:12:00.000Z',
      updatedAt: '2026-05-20T15:12:00.000Z',
    },
    {
      id: 'email_2',
      workspaceId,
      contactId: 'contact_4',
      ownerUserId: 'user_ortopedia',
      assignedUserId: 'user_ortopedia',
      from: 'roberto.santana@email.com',
      to: 'rafael@clinicasolution.com',
      subject: 'Confirmacao da cirurgia',
      body: 'Dr. Rafael, confirmo minha cirurgia e gostaria de receber novamente o checklist.',
      direction: 'inbound',
      status: 'unread',
      createdAt: '2026-05-20T16:30:00.000Z',
      updatedAt: '2026-05-20T16:30:00.000Z',
    },
    {
      id: 'email_3',
      workspaceId,
      contactId: 'contact_3',
      ownerUserId: 'user_cardio',
      assignedUserId: 'user_cardio',
      from: 'helena@clinicasolution.com',
      to: 'marcia.fig@email.com',
      subject: 'Orientacoes para exame',
      body: 'Ola Marcia, seu exame esta confirmado. Leve documento com foto e chegue 20 minutos antes.',
      direction: 'outbound',
      status: 'sent',
      createdAt: '2026-05-20T17:10:00.000Z',
      updatedAt: '2026-05-20T17:10:00.000Z',
    },
  ]
  const emailTemplates = [
    {
      id: 'template_1',
      workspaceId,
      ownerUserId: 'user_cardio',
      name: 'Orientacoes cardiologia',
      subject: 'Orientacoes para sua consulta',
      body: 'Ola {{nome}}, sua consulta com {{medico}} esta confirmada. Traga exames anteriores e lista de medicamentos em uso.',
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 'template_2',
      workspaceId,
      ownerUserId: 'user_ortopedia',
      name: 'Checklist cirurgia',
      subject: 'Checklist pre-operatorio',
      body: 'Ola {{nome}}, seguem as orientacoes de {{medico}}: jejum de 8 horas, documentos, exames em maos e chegada com antecedencia.',
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 'template_3',
      workspaceId,
      ownerUserId: 'user_admin',
      name: 'Retorno administrativo',
      subject: 'Retorno da Clinica Solution',
      body: 'Ola {{nome}}, recebemos sua solicitacao e nossa equipe retornara em breve.',
      createdAt,
      updatedAt: createdAt,
    },
  ]
  return {
    workspaces: [{ id: workspaceId, name: 'Clinica Solution', email: 'contato@clinicasolution.com', phone: '+554999999999', createdAt, updatedAt: createdAt }],
    users,
    departments,
    channels,
    funnels: [{ id: funnelId, workspaceId, name: 'Gravacao', status: 'active', createdAt, updatedAt: createdAt }],
    stages,
    contacts,
    tags,
    cards,
    messages,
    emails,
    emailTemplates,
    appointments,
    campaigns,
    campaignRecipients: [],
    groups: [],
    groupContacts: [],
    automationBots: [
      { id: 'bot_1', workspaceId, name: 'Confirmacao de consulta', trigger: 'agendamento proximo', condition: 'tipo = Consulta', action: 'enviar mensagem', status: 'active', createdAt, updatedAt: createdAt },
      { id: 'bot_2', workspaceId, name: 'Checklist pre-cirurgico', trigger: 'card entrou na etapa', condition: 'etapa = Consulta marcada', action: 'adicionar tag', status: 'inactive', createdAt, updatedAt: createdAt },
    ],
    activityLogs: [
      { id: 'act_1', type: 'seed', entityType: 'workspace', entityId: workspaceId, description: 'Workspace Clinica Solution criado com conversas exemplo do robo', userId: 'user_admin', createdAt },
    ],
    settings: [{
      id: 'settings_main',
      workspaceId,
      companyName: 'Clinica Solution',
      email: 'contato@clinicasolution.com',
      phone: '+554999999999',
      timezone: 'America/Sao_Paulo',
      language: 'pt-BR',
      theme: 'light',
      density: 'comfortable',
      primaryColor: '#ef5a3c',
      integrations: {
        gupshup: { status: 'Simulado', tokenMasked: '********' },
        meta: { status: 'Simulado', tokenMasked: '********' },
        ihelp: { status: 'Simulado', tokenMasked: '********' },
        webhook: { status: 'Simulado', url: '/api/webhooks/inbound-message' },
      },
      profile: {
        name: 'Dra. Marina Costa',
        email: 'marina@clinicasolution.com',
        whatsapp: '+55',
        title: 'Diretora Clinica',
        notifications: true,
        twoFactor: false,
        memberSince: 'fevereiro de 2026',
      },
      createdAt,
      updatedAt: createdAt,
    }],
  }
}

async function readDb() {
  try {
    const raw = await fs.readFile(dbFile, 'utf8')
    const data = JSON.parse(raw)
    const defaults = seed()
    for (const collection of collections) data[collection] ||= defaults[collection] || []
    return migrateDisplayData(data)
  } catch {
    const data = migrateDisplayData(seed())
    await writeDb(data)
    return data
  }
}

async function writeDb(data) {
  await fs.mkdir(dbDir, { recursive: true })
  await fs.writeFile(dbFile, JSON.stringify(data, null, 2))
}

function activity(data, type, entityType, entityId, description, userId = 'user_admin') {
  data.activityLogs.unshift({ id: id('act'), type, entityType, entityId, description, userId, createdAt: now() })
}

function byId(list, itemId) {
  return list.find((item) => item.id === itemId)
}

function migrateDisplayData(data) {
  data.workspaces.forEach((workspace) => {
    if (workspace.name === 'Clinica Solution') workspace.name = 'Clínica Solution'
  })
  data.settings.forEach((setting) => {
    if (setting.companyName === 'Clinica Solution') setting.companyName = 'Clínica Solution'
  })
  const admin = byId(data.users, 'user_admin')
  if (admin) Object.assign(admin, { name: 'Admin', email: 'admin@clinicasolution.com', title: 'Administrador', specialty: 'Administração', crm: '' })
  const names = {
    dep_recepcao: ['Recepção', 'Entrada de pacientes, check-in e autorizações'],
    dep_triagem: ['Triagem', 'Classificação inicial e sinais vitais'],
    dep_consultorios: ['Consultórios', 'Consultas médicas e retornos'],
    dep_cirurgico: ['Centro Cirúrgico', 'Procedimentos, cirurgias e pré-operatório'],
    dep_exames: ['Exames e Diagnóstico', 'Exames, laudos e preparos'],
  }
  data.departments.forEach((department) => {
    const next = names[department.id]
    if (next) [department.name, department.description] = next
  })
  const channelNames = ['Robô WhatsApp', 'WhatsApp', 'Telefone', 'Site', 'Indicação', 'Convênio', 'Presencial', 'Manual']
  data.channels.forEach((channel, index) => {
    channel.name = channelNames[index] || channel.name
  })
  const robotStage = byId(data.stages, 'stage_n8n')
  if (robotStage) robotStage.name = 'N8N / Robô'
  return data
}

function reportData(data) {
  const openCards = data.cards.filter((card) => card.status !== 'concluido')
  const closedCards = data.cards.filter((card) => card.status === 'concluido')
  const today = new Date().toISOString().slice(0, 10)
  const byDepartment = data.departments.map((department) => ({
    name: department.name,
    total: data.cards.filter((card) => card.departmentId === department.id).length + data.contacts.filter((contact) => contact.departmentId === department.id).length,
  }))
  const byStage = data.stages.map((stage) => ({ name: stage.name, cards: data.cards.filter((card) => card.stageId === stage.id).length, color: colors[stage.color] || stage.color }))
  const byChannel = data.channels.map((channel) => ({ name: channel.name, total: data.cards.filter((card) => card.channelId === channel.id).length }))
  const campaignPerformance = data.campaigns.map((campaign) => ({ name: campaign.name, entregues: campaign.deliveredCount, lidas: campaign.readCount, respostas: campaign.repliedCount }))
  const appointmentsWeek = data.appointments.slice(0, 7).map((appointment) => ({ name: appointment.date.slice(5), total: data.appointments.filter((item) => item.date === appointment.date).length }))
  const table = data.cards.map((card) => {
    const contact = byId(data.contacts, card.contactId) || {}
    return {
      id: card.id,
      contact: contact.name || card.title,
      phone: card.phone,
      channel: byId(data.channels, card.channelId)?.name || 'N/D',
      department: byId(data.departments, card.departmentId)?.name || 'N/D',
      responsible: byId(data.users, card.assignedUserId)?.name || 'N/D',
      status: card.status,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
      openTime: card.status === 'concluido' ? 'Encerrado' : '02:16:58',
      stage: byId(data.stages, card.stageId)?.name || 'N/D',
    }
  })
  return {
    summary: {
      contacts: data.contacts.length,
      openAttendances: openCards.length,
      cards: data.cards.length,
      appointmentsToday: data.appointments.filter((item) => item.date === today).length,
      activeCampaigns: data.campaigns.filter((item) => ['Agendado', 'Em andamento'].includes(item.status)).length,
      departments: data.departments.length,
      users: data.users.length,
      conversionRate: data.cards.length ? Math.round((closedCards.length / data.cards.length) * 100) : 0,
      closedAttendances: closedCards.length,
      totalAttendances: data.cards.length,
      active: openCards.filter((card) => card.lastMessageAt).length,
      receptive: data.messages.filter((message) => message.direction === 'inbound').length,
      waiting: openCards.length,
      avgWait: '02:16:58',
      avgService: '232:25:04',
      activeWait: '12:59:00',
      cardsCreated: data.cards.length,
      cardsWon: closedCards.length,
      campaignsSent: data.campaigns.reduce((sum, campaign) => sum + campaign.sentCount, 0),
      appointmentsDone: data.appointments.filter((item) => item.status === 'concluido').length,
    },
    charts: { byDepartment, byStage, byChannel, campaignPerformance, appointmentsWeek },
    table,
  }
}

app.get('/api/health', (_req, res) => res.json({ ok: true, provider: provider.constructor.name }))

app.get('/api/auth/me', async (req, res, next) => {
  try {
    const data = await readDb()
    const userId = verifySession(readCookies(req)[sessionCookie])
    const user = userId ? byId(data.users, userId) : null
    if (!user) return res.status(401).json({ error: 'Sessao expirada' })
    res.json({ user: publicUser(user) })
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const data = await readDb()
    const login = clean(req.body.email || req.body.login || '')
    const password = String(req.body.password || '')
    const user = findUserByLogin(data, login)
    const isAdminShortcut = user?.id === 'user_admin' && login.toLowerCase() === 'admin' && password === 'admin'
    const validPassword = user && (isAdminShortcut || verifyPassword(password, user.passwordSalt, user.passwordHash))
    if (!user || !validPassword) {
      return res.status(401).json({ error: 'Email ou senha inválidos' })
    }
    setSession(res, user.id)
    res.json({ user: publicUser(user) })
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const data = await readDb()
    const payload = cleanObject(req.body)
    const email = clean(payload.email || '').toLowerCase()
    const password = String(payload.password || '')
    if (!clean(payload.name) || !email || password.length < 6) {
      return res.status(400).json({ error: 'Nome, email e senha com pelo menos 6 caracteres são obrigatórios' })
    }
    if (data.users.some((user) => user.email.toLowerCase() === email)) {
      return res.status(409).json({ error: 'Este email já possui cadastro' })
    }
    const title = clean(payload.title || 'Profissional')
    const specialty = clean(payload.specialty || '')
    const medicalText = `${title} ${specialty}`.toLowerCase()
    const role = medicalText.includes('medic') || medicalText.includes('médic') || specialty ? 'medico' : 'atendente'
    const passwordData = hashPassword(password)
    const user = {
      id: id('user'),
      workspaceId: 'workspace_solution',
      name: payload.name,
      email,
      role,
      title,
      departmentId: payload.departmentId || 'dep_consultorios',
      status: 'active',
      avatarUrl: '',
      specialty,
      crm: clean(payload.crm || ''),
      passwordSalt: passwordData.salt,
      passwordHash: passwordData.hash,
      createdAt: now(),
      updatedAt: now(),
    }
    data.users.push(user)
    activity(data, 'created', 'users', user.id, `Usuário criado: ${user.name}`, user.id)
    await writeDb(data)
    setSession(res, user.id)
    res.status(201).json({ user: publicUser(user) })
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/logout', (_req, res) => {
  clearSession(res)
  res.json({ ok: true })
})

app.get('/api/bootstrap', async (_req, res, next) => {
  try {
    const data = await readDb()
    res.json({ ...data, users: data.users.map(publicUser), reports: reportData(data) })
  } catch (error) {
    next(error)
  }
})

function crudRoutes(pathName, collection, { required = 'name', beforeCreate, beforeUpdate } = {}) {
  app.get(`/api/${pathName}`, async (_req, res, next) => {
    try {
      const data = await readDb()
      res.json(data[collection])
    } catch (error) {
      next(error)
    }
  })
  app.post(`/api/${pathName}`, async (req, res, next) => {
    try {
      const data = await readDb()
      const payload = cleanObject(req.body)
      if (required) ensureName(payload, required)
      const item = { ...payload, id: payload.id || id(collection.slice(0, -1)), workspaceId: payload.workspaceId || 'workspace_solution', createdAt: now(), updatedAt: now() }
      if (beforeCreate) beforeCreate(item, data)
      data[collection].push(item)
      activity(data, 'created', collection, item.id, `${collection} criado: ${item.name || item.title || item.subject || item.id}`)
      await writeDb(data)
      res.status(201).json(item)
    } catch (error) {
      next(error)
    }
  })
  app.put(`/api/${pathName}/:id`, async (req, res, next) => {
    try {
      const data = await readDb()
      const item = byId(data[collection], req.params.id)
      if (!item) return res.status(404).json({ error: 'Registro nao encontrado' })
      const payload = cleanObject(req.body)
      if (required && payload[required] !== undefined) ensureName(payload, required)
      Object.assign(item, payload, { updatedAt: now() })
      if (beforeUpdate) beforeUpdate(item, data)
      activity(data, 'updated', collection, item.id, `${collection} atualizado: ${item.name || item.title || item.subject || item.id}`)
      await writeDb(data)
      res.json(item)
    } catch (error) {
      next(error)
    }
  })
  app.delete(`/api/${pathName}/:id`, async (req, res, next) => {
    try {
      const data = await readDb()
      const index = data[collection].findIndex((item) => item.id === req.params.id)
      if (index === -1) return res.status(404).json({ error: 'Registro nao encontrado' })
      const [removed] = data[collection].splice(index, 1)
      activity(data, 'deleted', collection, removed.id, `${collection} excluido: ${removed.name || removed.title || removed.subject || removed.id}`)
      await writeDb(data)
      res.json({ ok: true })
    } catch (error) {
      next(error)
    }
  })
}

crudRoutes('funnels', 'funnels', {
  beforeCreate(item, data) {
    item.status ||= 'active'
    if (!data.stages.some((stage) => stage.funnelId === item.id)) {
      data.stages.push({ id: id('stage'), workspaceId: item.workspaceId, funnelId: item.id, name: 'Nova etapa', color: 'blue', order: 0, createdAt: now(), updatedAt: now() })
    }
  },
})
crudRoutes('stages', 'stages', {
  beforeCreate(item, data) {
    ensureName(item)
    if (!item.funnelId || !byId(data.funnels, item.funnelId)) throw Object.assign(new Error('Funil valido e obrigatorio'), { status: 400 })
    item.color ||= 'blue'
    item.order = Number.isFinite(Number(item.order)) ? Number(item.order) : data.stages.filter((stage) => stage.funnelId === item.funnelId).length
  },
})
crudRoutes('cards', 'cards', {
  required: 'title',
  beforeCreate(item, data) {
    if (!item.stageId || !byId(data.stages, item.stageId)) throw Object.assign(new Error('Etapa valida e obrigatoria'), { status: 400 })
    item.phone = normalizePhone(item.phone)
    item.position = Number.isFinite(Number(item.position)) ? Number(item.position) : data.cards.filter((card) => card.stageId === item.stageId).length
    item.status ||= 'aberto'
  },
})
crudRoutes('departments', 'departments')
crudRoutes('contacts', 'contacts', {
  beforeCreate(item) {
    item.phone = normalizePhone(item.phone)
    item.tagIds ||= []
  },
  beforeUpdate(item) {
    item.phone = normalizePhone(item.phone)
  },
})
crudRoutes('appointments', 'appointments', {
  required: 'title',
  beforeCreate(item) {
    if (!item.date || !item.startTime || !item.endTime) throw Object.assign(new Error('Data, hora inicial e hora final sao obrigatorias'), { status: 400 })
    item.status ||= 'pendente'
    item.type ||= 'Consulta'
    item.room ||= ''
  },
})
crudRoutes('campaigns', 'campaigns', {
  beforeCreate(item) {
    item.status ||= 'Rascunho'
    item.sentCount ||= 0
    item.deliveredCount ||= 0
    item.readCount ||= 0
    item.repliedCount ||= 0
    item.failedCount ||= 0
  },
})
crudRoutes('emails', 'emails', {
  required: 'subject',
  beforeCreate(item) {
    item.direction ||= 'outbound'
    item.status ||= item.direction === 'inbound' ? 'unread' : 'sent'
    item.body ||= ''
    item.from ||= ''
    item.to ||= ''
    item.ownerUserId ||= item.assignedUserId || 'user_admin'
    item.assignedUserId ||= item.ownerUserId
    item.contactId ||= ''
  },
})
crudRoutes('email-templates', 'emailTemplates', {
  required: 'name',
  beforeCreate(item) {
    item.ownerUserId ||= 'user_admin'
    item.subject ||= item.name
    item.body ||= ''
  },
})
crudRoutes('users', 'users')
crudRoutes('groups', 'groups')
crudRoutes('bots', 'automationBots')

app.put('/api/cards/:id/move', async (req, res, next) => {
  try {
    const data = await readDb()
    const card = byId(data.cards, req.params.id)
    if (!card) return res.status(404).json({ error: 'Card nao encontrado' })
    const stage = byId(data.stages, req.body.stageId)
    if (!stage) return res.status(400).json({ error: 'Etapa invalida' })
    card.stageId = stage.id
    card.position = Number(req.body.position || 0)
    card.updatedAt = now()
    activity(data, 'moved', 'cards', card.id, `Card movido para ${stage.name}`)
    await writeDb(data)
    res.json(card)
  } catch (error) {
    next(error)
  }
})

app.post('/api/funnels/:id/duplicate', async (req, res, next) => {
  try {
    const data = await readDb()
    const source = byId(data.funnels, req.params.id)
    if (!source) return res.status(404).json({ error: 'Funil nao encontrado' })
    const newFunnel = { ...source, id: id('funnel'), name: `${source.name} copia`, createdAt: now(), updatedAt: now() }
    data.funnels.push(newFunnel)
    data.stages.filter((stage) => stage.funnelId === source.id).forEach((stage) => data.stages.push({ ...stage, id: id('stage'), funnelId: newFunnel.id, createdAt: now(), updatedAt: now() }))
    activity(data, 'duplicated', 'funnels', newFunnel.id, `Funil duplicado: ${newFunnel.name}`)
    await writeDb(data)
    res.status(201).json(newFunnel)
  } catch (error) {
    next(error)
  }
})

app.post('/api/campaigns/:id/send-test', async (req, res, next) => {
  try {
    const data = await readDb()
    const campaign = byId(data.campaigns, req.params.id)
    if (!campaign) return res.status(404).json({ error: 'Campanha nao encontrada' })
    const result = await provider.sendMessage({ phone: normalizePhone(req.body.phone || '+554999999999'), body: campaign.message })
    activity(data, 'test_sent', 'campaigns', campaign.id, `Teste enviado para campanha ${campaign.name}`)
    await writeDb(data)
    res.json(result)
  } catch (error) {
    next(error)
  }
})

app.post('/api/campaigns/:id/simulate-send', async (req, res, next) => {
  try {
    const data = await readDb()
    const campaign = byId(data.campaigns, req.params.id)
    if (!campaign) return res.status(404).json({ error: 'Campanha nao encontrada' })
    const base = Math.max(25, data.contacts.length * 18)
    campaign.status = 'Completo'
    campaign.sentCount += base
    campaign.deliveredCount += Math.round(base * 0.92)
    campaign.readCount += Math.round(base * 0.54)
    campaign.repliedCount += Math.round(base * 0.11)
    campaign.failedCount += Math.round(base * 0.03)
    campaign.updatedAt = now()
    activity(data, 'campaign_sent', 'campaigns', campaign.id, `Campanha simulada: ${campaign.name}`)
    await writeDb(data)
    res.json(campaign)
  } catch (error) {
    next(error)
  }
})

app.get('/api/reports/summary', async (_req, res, next) => {
  try {
    res.json(reportData(await readDb()).summary)
  } catch (error) {
    next(error)
  }
})
app.get('/api/reports/charts', async (_req, res, next) => {
  try {
    res.json(reportData(await readDb()).charts)
  } catch (error) {
    next(error)
  }
})
app.get('/api/reports/table', async (_req, res, next) => {
  try {
    res.json(reportData(await readDb()).table)
  } catch (error) {
    next(error)
  }
})

app.get('/api/settings', async (_req, res, next) => {
  try {
    const data = await readDb()
    res.json(data.settings[0])
  } catch (error) {
    next(error)
  }
})

app.put('/api/settings', async (req, res, next) => {
  try {
    const data = await readDb()
    data.settings[0] = { ...data.settings[0], ...cleanObject(req.body), updatedAt: now() }
    const workspace = byId(data.workspaces, data.settings[0].workspaceId)
    if (workspace && req.body.companyName) {
      workspace.name = clean(req.body.companyName)
      workspace.updatedAt = now()
    }
    activity(data, 'updated', 'settings', data.settings[0].id, 'Configurações atualizadas')
    await writeDb(data)
    res.json(data.settings[0])
  } catch (error) {
    next(error)
  }
})

app.post('/api/messages/send', async (req, res, next) => {
  try {
    const data = await readDb()
    const body = clean(req.body.body)
    const phone = normalizePhone(req.body.phone)
    if (!body) return res.status(400).json({ error: 'Mensagem obrigatoria' })
    if (!phone) return res.status(400).json({ error: 'Telefone obrigatorio' })
    const result = await provider.sendMessage({ phone, body })
    const message = { id: id('msg'), workspaceId: 'workspace_solution', contactId: req.body.contactId, cardId: req.body.cardId, direction: 'outbound', body, provider: result.provider, status: result.status, createdAt: now() }
    data.messages.push(message)
    const card = byId(data.cards, req.body.cardId)
    if (card) Object.assign(card, { lastMessageAt: message.createdAt, updatedAt: now() })
    activity(data, 'message_sent', 'messages', message.id, `Mensagem enviada para ${phone}`)
    await writeDb(data)
    res.status(201).json(message)
  } catch (error) {
    next(error)
  }
})

app.post('/api/webhooks/inbound-message', async (req, res, next) => {
  try {
    const data = await readDb()
    const phone = normalizePhone(req.body.phone)
    const body = clean(req.body.body)
    if (!phone || !body) return res.status(400).json({ error: 'phone e body sao obrigatorios' })
    let contact = data.contacts.find((item) => item.phone === phone)
    if (!contact) {
      contact = { id: id('contact'), workspaceId: 'workspace_solution', name: phone, phone, email: '', avatarUrl: '', channelId: 'channel_7', departmentId: 'dep_atendimento', tagIds: [], createdAt: now(), updatedAt: now() }
      data.contacts.push(contact)
    }
    const message = { id: id('msg'), workspaceId: 'workspace_solution', contactId: contact.id, cardId: req.body.cardId || '', direction: 'inbound', body, provider: req.body.provider || 'webhook', status: 'received', createdAt: now() }
    data.messages.push(message)
    activity(data, 'message_received', 'messages', message.id, `Mensagem recebida de ${phone}`)
    await writeDb(data)
    res.status(201).json(message)
  } catch (error) {
    next(error)
  }
})

app.use(express.static(clientDist))

app.get('/{*splat}', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next()
  res.sendFile(path.join(clientDist, 'index.html'))
})

app.use((error, _req, res, _next) => {
  res.status(error.status || 500).json({ error: error.message || 'Erro interno' })
})

const port = process.env.PORT || 4000
app.listen(port, () => {
  console.log(`Solution CRM API running on http://localhost:${port}`)
})
