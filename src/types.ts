export type EntityId = string

export interface Workspace {
  id: EntityId
  name: string
  email: string
  phone: string
  createdAt: string
  updatedAt: string
}

export interface User {
  id: EntityId
  workspaceId: EntityId
  name: string
  email: string
  title: string
  role: 'administrador' | 'supervisor' | 'atendente' | string
  departmentId: EntityId
  status: 'active' | 'inactive' | string
  avatarUrl?: string
  specialty?: string
  crm?: string
  createdAt: string
  updatedAt: string
}

export interface Department {
  id: EntityId
  workspaceId: EntityId
  name: string
  color: string
  description: string
  createdAt: string
  updatedAt: string
}

export interface Channel {
  id: EntityId
  workspaceId: EntityId
  name: string
  type: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface Funnel {
  id: EntityId
  workspaceId: EntityId
  name: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface Stage {
  id: EntityId
  workspaceId: EntityId
  funnelId: EntityId
  name: string
  color: string
  order: number
  createdAt: string
  updatedAt: string
}

export interface Tag {
  id: EntityId
  workspaceId: EntityId
  name: string
  color: string
  createdAt: string
  updatedAt: string
}

export interface Contact {
  id: EntityId
  workspaceId: EntityId
  name: string
  phone: string
  email: string
  avatarUrl?: string
  channelId: EntityId
  departmentId: EntityId
  tagIds: EntityId[]
  createdAt: string
  updatedAt: string
}

export interface CrmCard {
  id: EntityId
  workspaceId: EntityId
  title: string
  description: string
  contactId: EntityId
  phone: string
  funnelId: EntityId
  stageId: EntityId
  departmentId: EntityId
  channelId: EntityId
  assignedUserId: EntityId
  priority: string
  status: string
  value: number
  position: number
  dueAt?: string
  lastMessageAt?: string
  tagIds: EntityId[]
  createdAt: string
  updatedAt: string
}

export interface Message {
  id: EntityId
  workspaceId: EntityId
  contactId: EntityId
  cardId: EntityId
  direction: 'inbound' | 'outbound'
  body: string
  provider: string
  status: string
  createdAt: string
}

export interface Appointment {
  id: EntityId
  workspaceId: EntityId
  title: string
  type?: string
  description: string
  date: string
  startTime: string
  endTime: string
  contactId: EntityId
  cardId: EntityId
  departmentId: EntityId
  assignedUserId: EntityId
  status: string
  reminderMinutes: number
  notes: string
  room?: string
  createdAt: string
  updatedAt: string
}

export interface Campaign {
  id: EntityId
  workspaceId: EntityId
  name: string
  channelId: EntityId
  message: string
  status: string
  scheduledAt: string
  sentCount: number
  deliveredCount: number
  readCount: number
  repliedCount: number
  failedCount: number
  tagIds: EntityId[]
  createdAt: string
  updatedAt: string
}

export interface ContactGroup {
  id: EntityId
  workspaceId: EntityId
  name: string
  description: string
  contactIds: EntityId[]
  createdAt: string
  updatedAt: string
}

export interface AutomationBot {
  id: EntityId
  workspaceId: EntityId
  name: string
  trigger: string
  condition: string
  action: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface ActivityLog {
  id: EntityId
  type: string
  entityType: string
  entityId: EntityId
  description: string
  userId: EntityId
  createdAt: string
}

export interface Setting {
  id: EntityId
  workspaceId: EntityId
  companyName: string
  email: string
  phone: string
  timezone: string
  language: string
  theme: string
  density: string
  primaryColor: string
  integrations: Record<string, { status: string; tokenMasked?: string; url?: string }>
  profile: {
    name: string
    email: string
    whatsapp: string
    title: string
    notifications: boolean
    twoFactor: boolean
    memberSince: string
  }
  createdAt: string
  updatedAt: string
}

export interface Reports {
  summary: Record<string, number | string>
  charts: {
    byDepartment: Array<{ name: string; total: number }>
    byStage: Array<{ name: string; cards: number; color: string }>
    byChannel: Array<{ name: string; total: number }>
    campaignPerformance: Array<{ name: string; entregues: number; lidas: number; respostas: number }>
    appointmentsWeek: Array<{ name: string; total: number }>
  }
  table: Array<Record<string, string | number>>
}

export interface BootstrapData {
  workspaces: Workspace[]
  users: User[]
  departments: Department[]
  channels: Channel[]
  funnels: Funnel[]
  stages: Stage[]
  contacts: Contact[]
  tags: Tag[]
  cards: CrmCard[]
  messages: Message[]
  appointments: Appointment[]
  campaigns: Campaign[]
  groups: ContactGroup[]
  automationBots: AutomationBot[]
  activityLogs: ActivityLog[]
  settings: Setting[]
  reports: Reports
}
