import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  DndContext,
  type DragEndEvent,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  Activity,
  BarChart3,
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  ClipboardList,
  Clock3,
  Download,
  Eye,
  Filter,
  Gauge,
  Grid2X2,
  Headphones,
  Inbox,
  LayoutDashboard,
  List,
  Lock,
  LogOut,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart as RePieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from './services/api'
import {
  Badge,
  Button,
  ChartCard,
  ConfirmDialog,
  DataTable,
  Drawer,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  SearchBar,
  Select,
  Skeleton,
  StatCard,
  TextArea,
  ToastProvider,
  useToast,
} from './components/ui'
import type {
  Appointment,
  AutomationBot,
  BootstrapData,
  Campaign,
  Channel,
  Contact,
  ContactGroup,
  CrmCard,
  Department,
  EntityId,
  Funnel,
  Message,
  Stage,
  User,
} from './types'
import { csv, formatDate, formatDateTime, initials, normalizePhone } from './utils/format'
import './App.css'

type Page =
  | 'atendimento'
  | 'crm'
  | 'robos'
  | 'campanhas'
  | 'agendamentos'
  | 'contatos'
  | 'grupos'
  | 'relatorios'
  | 'dashboard'
  | 'departamentos'
  | 'usuarios'
  | 'configuracoes'
  | 'perfil'

type FormMode = 'card' | 'stage' | 'funnel' | 'campaign' | 'appointment' | 'contact' | 'department' | 'user' | 'group' | 'bot' | 'profile' | 'settings'

type FormState = Record<string, unknown>

const stageColors: Record<string, string> = {
  red: '#ef4444',
  blue: '#3498db',
  green: '#22c55e',
  orange: '#f59e0b',
  purple: '#8b5cf6',
  gray: '#64748b',
}

const pageTitles: Record<Page, string> = {
  atendimento: 'Atendimento',
  crm: 'CRM',
  robos: 'Robos',
  campanhas: 'Campanhas',
  agendamentos: 'Agendamentos',
  contatos: 'Contatos',
  grupos: 'Grupos',
  relatorios: 'Relatorios',
  dashboard: 'Dashboard',
  departamentos: 'Departamentos',
  usuarios: 'Usuarios',
  configuracoes: 'Configuracoes',
  perfil: 'Meu Perfil',
}

const sessionKey = 'solution-crm-user'

function isAdmin(user?: User | null) {
  return user?.role === 'administrador'
}

function allowedPagesFor(user: User): Page[] {
  if (isAdmin(user)) return Object.keys(pageTitles) as Page[]
  return ['atendimento', 'crm', 'agendamentos', 'relatorios', 'dashboard', 'perfil']
}

function cleanMessageBody(body = '') {
  return body.replace(/\\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

function messagePreview(body = '') {
  return cleanMessageBody(body).replace(/\s+/g, ' ')
}

function parseBotOptions(body: string) {
  const lines = cleanMessageBody(body).split('\n').map((line) => line.trim()).filter(Boolean)
  const options = lines
    .map((line) => line.match(/^(\d+)\s*[-.)]\s*(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({ value: match[1], label: match[2] }))
  const intro = lines.filter((line) => !/^(\d+)\s*[-.)]\s*(.+)$/.test(line)).join(' ')
  return { intro, options }
}

function MessageBody({ body, compact = false }: { body: string; compact?: boolean }) {
  const { intro, options } = parseBotOptions(body)
  if (!options.length) {
    return <p className="message-text">{cleanMessageBody(body)}</p>
  }
  return (
    <div className={compact ? 'bot-message compact' : 'bot-message'}>
      {intro ? <p>{intro}</p> : null}
      <details open={!compact} className="bot-options">
        <summary>{options.length} opcoes disponiveis</summary>
        <div>
          {options.map((option) => (
            <button type="button" key={`${option.value}-${option.label}`}>
              <strong>{option.value}</strong>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </details>
    </div>
  )
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(year, monthNumber - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

function monthDays(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const total = new Date(year, monthNumber, 0).getDate()
  return Array.from({ length: total }, (_, index) => `${year}-${String(monthNumber).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`)
}

function reportData(data: BootstrapData): BootstrapData['reports'] {
  const openCards = data.cards.filter((card) => card.status !== 'concluido')
  const closedCards = data.cards.filter((card) => card.status === 'concluido')
  const today = new Date().toISOString().slice(0, 10)
  const byDepartment = data.departments.map((department) => ({
    name: department.name,
    total: data.cards.filter((card) => card.departmentId === department.id).length + data.contacts.filter((contact) => contact.departmentId === department.id).length,
  }))
  const byStage = data.stages.map((stage) => ({ name: stage.name, cards: data.cards.filter((card) => card.stageId === stage.id).length, color: stageColors[stage.color] || stage.color }))
  const byChannel = data.channels.map((channel) => ({ name: channel.name, total: data.cards.filter((card) => card.channelId === channel.id).length }))
  const campaignPerformance = data.campaigns.map((campaign) => ({ name: campaign.name, entregues: campaign.deliveredCount, lidas: campaign.readCount, respostas: campaign.repliedCount }))
  const appointmentsWeek = data.appointments.slice(0, 7).map((appointment) => ({ name: appointment.date.slice(5), total: data.appointments.filter((item) => item.date === appointment.date).length }))
  const table = data.cards.map((card) => {
    const contact = data.contacts.find((item) => item.id === card.contactId)
    return {
      id: card.id,
      contact: contact?.name || card.title,
      phone: card.phone,
      channel: data.channels.find((item) => item.id === card.channelId)?.name || 'N/D',
      department: data.departments.find((item) => item.id === card.departmentId)?.name || 'N/D',
      responsible: data.users.find((item) => item.id === card.assignedUserId)?.name || 'N/D',
      status: card.status,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
      openTime: card.status === 'concluido' ? 'Encerrado' : '02:16:58',
      stage: data.stages.find((item) => item.id === card.stageId)?.name || 'N/D',
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

function scopeDataForUser(data: BootstrapData, user: User): BootstrapData {
  if (isAdmin(user)) return data
  const cards = data.cards.filter((card) => card.assignedUserId === user.id)
  const appointments = data.appointments.filter((appointment) => appointment.assignedUserId === user.id)
  const contactIds = new Set([...cards.map((card) => card.contactId), ...appointments.map((appointment) => appointment.contactId)].filter(Boolean))
  const cardIds = new Set(cards.map((card) => card.id))
  const contacts = data.contacts.filter((contact) => contactIds.has(contact.id))
  const messages = data.messages.filter((message) => contactIds.has(message.contactId) || cardIds.has(message.cardId))
  const scoped: BootstrapData = { ...data, cards, appointments, contacts, messages, campaigns: [], automationBots: data.automationBots.filter((bot) => bot.status === 'active'), activityLogs: data.activityLogs.filter((log) => log.userId === user.id).slice(0, 8) }
  return { ...scoped, reports: reportData(scoped) }
}

function App() {
  return (
    <ToastProvider>
      <SolutionCrm />
    </ToastProvider>
  )
}

function SolutionCrm() {
  const toast = useToast()
  const [data, setData] = useState<BootstrapData | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const raw = window.localStorage.getItem(sessionKey)
    if (!raw) return null
    try {
      return JSON.parse(raw) as User
    } catch {
      return null
    }
  })
  const [activePage, setActivePage] = useState<Page>('atendimento')
  const [collapsed, setCollapsed] = useState(false)
  const [selectedFunnelId, setSelectedFunnelId] = useState('funnel_gravacao')
  const [selectedContactId, setSelectedContactId] = useState<EntityId>('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [channelFilter, setChannelFilter] = useState('Todos')
  const [channelsOpen, setChannelsOpen] = useState(true)
  const [formMode, setFormMode] = useState<FormMode | null>(null)
  const [editingId, setEditingId] = useState('')
  const [form, setForm] = useState<FormState>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState<{ resource: string; id: string; title: string; description: string } | null>(null)
  const [drawer, setDrawer] = useState<{ type: 'contact' | 'appointment' | 'stage' | 'campaign'; id?: string } | null>(null)
  const [messageText, setMessageText] = useState('')

  async function login(email: string, password: string) {
    const result = await api.login({ email, password })
    setCurrentUser(result.user)
    window.localStorage.setItem(sessionKey, JSON.stringify(result.user))
    toast.push({ type: 'success', title: `Bem-vindo, ${result.user.name}` })
  }

  function logout() {
    window.localStorage.removeItem(sessionKey)
    setCurrentUser(null)
    setActivePage('atendimento')
    setSelectedContactId('')
  }

  async function refresh() {
    const next = await api.bootstrap()
    setData(next)
    if (!selectedFunnelId && next.funnels[0]) setSelectedFunnelId(next.funnels[0].id)
  }

  useEffect(() => {
    let active = true
    api.bootstrap()
      .then((next) => {
        if (active) setData(next)
      })
      .catch((error) => toast.push({ type: 'error', title: 'Falha ao carregar', message: error.message }))
    return () => {
      active = false
    }
  }, [toast])

  useEffect(() => {
    if (!currentUser) return
    const allowed = allowedPagesFor(currentUser)
    if (!allowed.includes(activePage)) setActivePage('atendimento')
  }, [activePage, currentUser])

  const lookup = useMemo(() => {
    const map = <T extends { id: string }>(items: T[]) => Object.fromEntries(items.map((item) => [item.id, item])) as Record<string, T>
    return data
      ? {
          contacts: map(data.contacts),
          departments: map(data.departments),
          channels: map(data.channels),
          users: map(data.users),
          stages: map(data.stages),
          funnels: map(data.funnels),
          tags: map(data.tags),
        }
      : null
  }, [data])

  if (!data || !lookup) {
    return <Skeleton />
  }

  if (!currentUser) {
    return <LoginPage data={data} onLogin={login} />
  }

  const visibleData = scopeDataForUser(data, currentUser)
  const visibleLookup = {
    ...lookup,
    contacts: Object.fromEntries(visibleData.contacts.map((item) => [item.id, item])) as Record<string, Contact>,
  }
  const selectedFunnel = visibleData.funnels.find((funnel) => funnel.id === selectedFunnelId) || visibleData.funnels[0]
  const funnelStages = visibleData.stages.filter((stage) => stage.funnelId === selectedFunnel?.id).sort((a, b) => a.order - b.order)
  const selectedContact = visibleData.contacts.find((contact) => contact.id === selectedContactId) || visibleData.contacts[0]
  const selectedCard = visibleData.cards.find((card) => card.contactId === selectedContact?.id)
  const selectedMessages = visibleData.messages.filter((message) => message.contactId === selectedContact?.id)
  const settings = data.settings[0]
  const profileView = {
    ...settings.profile,
    id: currentUser.id,
    name: currentUser.name,
    email: currentUser.email,
    title: currentUser.title,
  }
  const accountScope = isAdmin(currentUser) ? 'Administradora' : currentUser.specialty || currentUser.title || 'Medico'

  function openCreate(mode: FormMode, seed: FormState = {}) {
    setEditingId('')
    setErrors({})
    setForm(defaultForm(mode, seed))
    setFormMode(mode)
  }

  function openEdit(mode: FormMode, item: object & { id?: string }) {
    setEditingId(String(item.id || ''))
    setErrors({})
    setForm(defaultForm(mode, item))
    setFormMode(mode)
  }

  function validate(mode: FormMode, values: FormState) {
    const next: Record<string, string> = {}
    const required: Record<FormMode, string[]> = {
      card: ['title', 'stageId'],
      stage: ['name', 'funnelId'],
      funnel: ['name'],
      campaign: ['name', 'message'],
      appointment: ['title', 'date', 'startTime', 'endTime', 'assignedUserId'],
      contact: ['name', 'phone'],
      department: ['name'],
      user: ['name', 'email'],
      group: ['name'],
      bot: ['name', 'trigger', 'action'],
      profile: ['name', 'email'],
      settings: ['companyName', 'email'],
    }
    required[mode].forEach((field) => {
      const value = values[field]
      if (typeof value === 'string' && !value.trim()) next[field] = 'Campo obrigatorio'
      if (value === undefined || value === null) next[field] = 'Campo obrigatorio'
    })
    if (mode === 'appointment' && values.startTime && values.endTime && String(values.endTime) <= String(values.startTime)) {
      next.endTime = 'Hora final precisa ser maior que a inicial'
    }
    if ((mode === 'card' || mode === 'contact') && values.phone && normalizePhone(String(values.phone)).length < 6) {
      next.phone = 'Telefone invalido'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function submitForm() {
    if (!formMode || !validate(formMode, form)) return
    setSaving(true)
    try {
      const payload = normalizePayload(formMode, form)
      if (formMode === 'profile') {
        const settings = data!.settings[0]
        if (currentUser) {
          const updatedUser = await api.update<User>('users', currentUser.id, payload)
          setCurrentUser(updatedUser)
          window.localStorage.setItem(sessionKey, JSON.stringify(updatedUser))
        }
        if (currentUser && isAdmin(currentUser)) {
          await api.updateSettings({ profile: { ...settings.profile, ...payload } })
        }
      } else if (formMode === 'settings') {
        await api.updateSettings(payload)
      } else {
        const resource = resourceForMode(formMode)
        if (editingId) await api.update(resource, editingId, payload)
        else await api.create(resource, payload)
      }
      await refresh()
      setFormMode(null)
      toast.push({ type: 'success', title: 'Alteracoes salvas' })
    } catch (error) {
      toast.push({ type: 'error', title: 'Nao foi possivel salvar', message: error instanceof Error ? error.message : 'Erro desconhecido' })
    } finally {
      setSaving(false)
    }
  }

  async function removeConfirmed() {
    if (!confirm) return
    try {
      await api.remove(confirm.resource, confirm.id)
      setConfirm(null)
      await refresh()
      toast.push({ type: 'success', title: 'Registro removido' })
    } catch (error) {
      toast.push({ type: 'error', title: 'Nao foi possivel remover', message: error instanceof Error ? error.message : 'Erro desconhecido' })
    }
  }

  async function sendMessage() {
    if (!messageText.trim() || !selectedContact) return
    try {
      await api.sendMessage({ phone: selectedContact.phone, body: messageText, contactId: selectedContact.id, cardId: selectedCard?.id || '' })
      setMessageText('')
      await refresh()
      toast.push({ type: 'success', title: 'Mensagem enviada' })
    } catch (error) {
      toast.push({ type: 'error', title: 'Falha no envio', message: error instanceof Error ? error.message : 'Erro desconhecido' })
    }
  }

  async function onDragEnd(event: DragEndEvent) {
    const cardId = String(event.active.id)
    const stageId = String(event.over?.id || '')
    if (!stageId || !data!.stages.some((stage) => stage.id === stageId)) return
    try {
      await api.moveCard(cardId, { stageId, position: data!.cards.filter((card) => card.stageId === stageId).length })
      await refresh()
    } catch (error) {
      toast.push({ type: 'error', title: 'Nao foi possivel mover o card', message: error instanceof Error ? error.message : 'Erro desconhecido' })
    }
  }

  async function duplicateFunnel() {
    try {
      await api.duplicateFunnel(selectedFunnel.id)
      await refresh()
      toast.push({ type: 'success', title: 'Funil duplicado' })
    } catch (error) {
      toast.push({ type: 'error', title: 'Falha ao duplicar', message: error instanceof Error ? error.message : 'Erro desconhecido' })
    }
  }

  function downloadReport() {
    const reportSource = currentUser && data ? scopeDataForUser(data, currentUser) : data!
    const blob = new Blob([csv(reportSource.reports.table)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'solution-crm-relatorio.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div
      className={collapsed ? 'app-shell collapsed' : 'app-shell'}
      data-theme={settings.theme}
      style={{ ['--primary' as string]: settings.primaryColor || '#ef5a3c' }}
    >
      <Sidebar activePage={activePage} collapsed={collapsed} accountName={settings.companyName} profileName={currentUser.name} accountScope={accountScope} allowedPages={allowedPagesFor(currentUser)} onNavigate={setActivePage} onToggle={() => setCollapsed((value) => !value)} />
      <main className="main">
        <Topbar title={pageTitles[activePage]} accountName={settings.companyName} currentUser={currentUser} onOpenProfile={() => setActivePage('perfil')} onLogout={logout} />
        {activePage === 'atendimento' ? (
          <AttendancePage
            data={visibleData}
            lookup={visibleLookup}
            selectedContact={selectedContact}
            selectedCard={selectedCard}
            messages={selectedMessages}
            search={search}
            setSearch={setSearch}
            channelFilter={channelFilter}
            setChannelFilter={setChannelFilter}
            onSelectContact={setSelectedContactId}
            messageText={messageText}
            setMessageText={setMessageText}
            onSend={sendMessage}
            onNewContact={() => openCreate('contact')}
            onNewAppointment={() => openCreate('appointment', { contactId: selectedContact?.id, cardId: selectedCard?.id, assignedUserId: currentUser.id })}
            onNewCard={() => openCreate('card', { contactId: selectedContact?.id, phone: selectedContact?.phone, assignedUserId: currentUser.id })}
            onOpenContact={() => setDrawer({ type: 'contact', id: selectedContact?.id })}
          />
        ) : null}
        {activePage === 'crm' ? (
          <CrmPage
            data={visibleData}
            lookup={visibleLookup}
            funnel={selectedFunnel}
            stages={funnelStages}
            search={search}
            setSearch={setSearch}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            channelFilter={channelFilter}
            setChannelFilter={setChannelFilter}
            channelsOpen={channelsOpen}
            setChannelsOpen={setChannelsOpen}
            onFunnelChange={setSelectedFunnelId}
            onDragEnd={onDragEnd}
            onNewCard={(stageId) => openCreate('card', { funnelId: selectedFunnel.id, stageId })}
            onNewStage={() => openCreate('stage', { funnelId: selectedFunnel.id })}
            onNewFunnel={() => openCreate('funnel')}
            onEditStage={(stage) => openEdit('stage', stage)}
            onEditFunnel={() => openEdit('funnel', selectedFunnel)}
            onDuplicateFunnel={duplicateFunnel}
            onDeleteStage={(stage) => setConfirm({ resource: 'stages', id: stage.id, title: 'Excluir etapa', description: `Deseja excluir a etapa ${stage.name}? Cards vinculados devem ser movidos antes em um ambiente real.` })}
            onDeleteFunnel={() => setConfirm({ resource: 'funnels', id: selectedFunnel.id, title: 'Excluir funil', description: `Deseja excluir o funil ${selectedFunnel.name}?` })}
          />
        ) : null}
        {activePage === 'dashboard' ? <DashboardPage data={visibleData} lookup={visibleLookup} /> : null}
        {activePage === 'campanhas' ? (
          <CampaignsPage
            data={visibleData}
            search={search}
            setSearch={setSearch}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            onCreate={() => openCreate('campaign')}
            onEdit={(campaign) => openEdit('campaign', campaign)}
            onDelete={(campaign) => setConfirm({ resource: 'campaigns', id: campaign.id, title: 'Excluir campanha', description: `Deseja excluir ${campaign.name}?` })}
            onSimulate={async (campaign) => {
              await api.simulateCampaign(campaign.id)
              await refresh()
              toast.push({ type: 'success', title: 'Campanha simulada' })
            }}
          />
        ) : null}
        {activePage === 'agendamentos' ? (
          <AppointmentsPage
            data={visibleData}
            lookup={visibleLookup}
            currentUser={currentUser}
            onCreate={(seed) => openCreate('appointment', seed || {})}
            onCreateDoctor={() => openCreate('user', { role: 'medico', title: 'Medico(a)', departmentId: 'dep_consultorios' })}
            onEdit={(appointment) => openEdit('appointment', appointment)}
            onDelete={(appointment) => setConfirm({ resource: 'appointments', id: appointment.id, title: 'Excluir agendamento', description: `Deseja excluir ${appointment.title}?` })}
            onOpen={(appointment) => setDrawer({ type: 'appointment', id: appointment.id })}
          />
        ) : null}
        {activePage === 'relatorios' ? <ReportsPage data={visibleData} onExport={downloadReport} /> : null}
        {activePage === 'contatos' ? (
          <ContactsPage data={visibleData} lookup={visibleLookup} search={search} setSearch={setSearch} onCreate={() => openCreate('contact')} onEdit={(contact) => openEdit('contact', contact)} />
        ) : null}
        {activePage === 'grupos' ? (
          <GroupsPage data={visibleData} onCreate={() => openCreate('group')} onEdit={(group) => openEdit('group', group)} onDelete={(group) => setConfirm({ resource: 'groups', id: group.id, title: 'Excluir grupo', description: `Deseja excluir ${group.name}?` })} />
        ) : null}
        {activePage === 'departamentos' ? (
          <DepartmentsPage data={visibleData} onCreate={() => openCreate('department')} onEdit={(department) => openEdit('department', department)} onDelete={(department) => setConfirm({ resource: 'departments', id: department.id, title: 'Excluir departamento', description: `Deseja excluir ${department.name}? Escolha mover vinculos para outro setor em uma evolucao com banco relacional.` })} />
        ) : null}
        {activePage === 'usuarios' ? (
          <UsersPage data={visibleData} lookup={visibleLookup} onCreate={() => openCreate('user')} onEdit={(user) => openEdit('user', user)} onDelete={(user) => setConfirm({ resource: 'users', id: user.id, title: 'Remover usuario', description: `Deseja remover ${user.name}?` })} />
        ) : null}
        {activePage === 'robos' ? <BotsPage data={visibleData} onCreate={() => openCreate('bot')} onEdit={(bot) => openEdit('bot', bot)} /> : null}
        {activePage === 'configuracoes' ? <SettingsPage data={data} onEdit={() => openEdit('settings', data.settings[0])} /> : null}
        {activePage === 'perfil' ? <ProfilePage data={data} profile={profileView} onBack={() => setActivePage('dashboard')} onEdit={() => openEdit('profile', profileView)} /> : null}
      </main>

      <FormModal
        mode={formMode}
        form={form}
        errors={errors}
        data={visibleData}
        saving={saving}
        editing={Boolean(editingId)}
        onChange={(key, value) => setForm((current) => ({ ...current, [key]: value }))}
        onClose={() => setFormMode(null)}
        onSubmit={submitForm}
      />
      <ConfirmDialog open={Boolean(confirm)} title={confirm?.title || ''} description={confirm?.description || ''} danger onCancel={() => setConfirm(null)} onConfirm={removeConfirmed} confirmText="Excluir" />
      <EntityDrawer drawer={drawer} data={visibleData} lookup={visibleLookup} onClose={() => setDrawer(null)} onEdit={(mode, item) => openEdit(mode, item)} />
    </div>
  )
}

function LoginPage({ data, onLogin }: { data: BootstrapData; onLogin: (email: string, password: string) => Promise<void> }) {
  const toast = useToast()
  const [email, setEmail] = useState('marina@clinicasolution.com')
  const [password, setPassword] = useState('123456')
  const [loading, setLoading] = useState(false)
  const demoUsers = data.users.filter((user) => user.role === 'administrador' || user.role === 'medico')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    try {
      await onLogin(email, password)
    } catch (error) {
      toast.push({ type: 'error', title: 'Nao foi possivel entrar', message: error instanceof Error ? error.message : 'Erro desconhecido' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-shell">
      <section className="login-branding">
        <div className="brand-mark"><Activity size={22} /></div>
        <span className="eyebrow">Solution CRM</span>
        <h1>Atendimento clinico com acesso por perfil.</h1>
        <p>Administradores acompanham toda a operacao. Medicos entram direto nos atendimentos, agenda e relatorios vinculados a eles.</p>
        <div className="login-preview">
          <div><strong>{data.cards.length}</strong><span>atendimentos</span></div>
          <div><strong>{data.appointments.length}</strong><span>agendamentos</span></div>
          <div><strong>{data.users.filter((user) => user.role === 'medico').length}</strong><span>medicos</span></div>
        </div>
      </section>
      <section className="login-panel">
        <div>
          <span className="eyebrow">Acesso seguro</span>
          <h2>Entrar no CRM</h2>
          <p className="muted">Use uma das contas de demonstracao. Senha: 123456.</p>
        </div>
        <form onSubmit={submit} className="login-form">
          <Field label="Email">
            <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" />
          </Field>
          <Field label="Senha">
            <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" />
          </Field>
          <Button loading={loading} type="submit">Entrar</Button>
        </form>
        <div className="login-users">
          {demoUsers.map((user) => (
            <button type="button" key={user.id} onClick={() => { setEmail(user.email); setPassword('123456') }}>
              <span className="avatar">{initials(user.name)}</span>
              <strong>{user.name}</strong>
              <small>{user.role === 'administrador' ? 'Administradora - ve tudo' : `${user.specialty || user.title} - ve apenas seus atendimentos`}</small>
            </button>
          ))}
        </div>
      </section>
    </main>
  )
}

function Sidebar({ activePage, collapsed, accountName, profileName, accountScope, allowedPages, onNavigate, onToggle }: { activePage: Page; collapsed: boolean; accountName: string; profileName: string; accountScope: string; allowedPages: Page[]; onNavigate: (page: Page) => void; onToggle: () => void }) {
  const baseSections: Array<{ title: string; items: Array<{ page: Page; icon: ReactNode; label: string }> }> = [
    { title: 'PRINCIPAL', items: [{ page: 'atendimento', icon: <MessageCircle />, label: 'Atendimento' }, { page: 'crm', icon: <BriefcaseBusiness />, label: 'CRM' }, { page: 'robos', icon: <Bot />, label: 'Robos' }] },
    { title: 'OPERACOES', items: [{ page: 'campanhas', icon: <Send />, label: 'Campanhas' }, { page: 'agendamentos', icon: <CalendarDays />, label: 'Agendamentos' }, { page: 'contatos', icon: <ClipboardList />, label: 'Contatos' }, { page: 'grupos', icon: <Users />, label: 'Grupos' }] },
    { title: 'DADOS', items: [{ page: 'relatorios', icon: <BarChart3 />, label: 'Relatorios' }, { page: 'dashboard', icon: <LayoutDashboard />, label: 'Dashboard' }] },
    { title: 'SISTEMA', items: [{ page: 'departamentos', icon: <Inbox />, label: 'Departamentos' }, { page: 'usuarios', icon: <UserPlus />, label: 'Usuarios' }, { page: 'configuracoes', icon: <Settings />, label: 'Configuracoes' }, { page: 'perfil', icon: <CircleUserRound />, label: 'Meu Perfil' }] },
  ]
  const sections = baseSections.map((section) => ({ ...section, items: section.items.filter((item) => allowedPages.includes(item.page)) })).filter((section) => section.items.length)
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><Activity size={20} /></div>
        {!collapsed ? <strong>{accountName || 'Solution CRM'}</strong> : null}
        <IconButton aria-label="Recolher menu" onClick={onToggle}>{collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}</IconButton>
      </div>
      <nav className="side-nav">
        {sections.map((section) => (
          <div key={section.title} className="side-group">
            {!collapsed ? <span className="side-title">{section.title}</span> : null}
            {section.items.map((item) => (
              <button key={item.page} className={activePage === item.page ? 'side-item active' : 'side-item'} onClick={() => onNavigate(item.page)} title={item.label}>
                {item.icon}
                {!collapsed ? <span>{item.label}</span> : null}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="side-profile">
        <div className="avatar">{initials(profileName)}</div>
        {!collapsed ? <div><strong>{profileName}</strong><span>{accountScope}</span></div> : null}
        {!collapsed ? <MoreHorizontal size={18} /> : null}
      </div>
    </aside>
  )
}

function Topbar({ title, accountName, currentUser, onOpenProfile, onLogout }: { title: string; accountName: string; currentUser: User; onOpenProfile: () => void; onLogout: () => void }) {
  return (
    <header className="topbar">
      <div>
        <span className="eyebrow">{accountName || 'Solution CRM'}</span>
        <h1>{title}</h1>
      </div>
      <div className="top-actions">
        <span className="session-chip">{currentUser.role === 'administrador' ? 'Visao geral' : 'Meus atendimentos'}</span>
        <Button variant="secondary"><Search size={16} /> Busca global</Button>
        <IconButton aria-label="Abrir perfil" onClick={onOpenProfile}><CircleUserRound size={22} /></IconButton>
        <IconButton aria-label="Sair" onClick={onLogout}><LogOut size={20} /></IconButton>
      </div>
    </header>
  )
}

function AttendancePage(props: {
  data: BootstrapData
  lookup: Lookup
  selectedContact?: Contact
  selectedCard?: CrmCard
  messages: Message[]
  search: string
  setSearch: (value: string) => void
  channelFilter: string
  setChannelFilter: (value: string) => void
  onSelectContact: (id: string) => void
  messageText: string
  setMessageText: (value: string) => void
  onSend: () => void
  onNewContact: () => void
  onNewAppointment: () => void
  onNewCard: () => void
  onOpenContact: () => void
}) {
  const { data, lookup } = props
  const contacts = data.contacts.filter((contact) => {
    const matchesSearch = `${contact.name} ${contact.phone}`.toLowerCase().includes(props.search.toLowerCase())
    const channel = lookup.channels[contact.channelId]?.name || ''
    return matchesSearch && (props.channelFilter === 'Todos' || channel === props.channelFilter)
  })
  return (
    <section className="attendance-grid">
      <div className="attendance-left">
        <div className="channel-pills">
          {['Meus', 'Robô WhatsApp', 'Triagem', 'Consultas', 'Remarcação', 'Cirurgias', 'Exames', 'Finalizados'].map((pill, index) => (
            <button className={index === 0 ? 'pill active' : 'pill'} key={pill}>{pill}<span>{index === 1 ? contacts.length : index}</span></button>
          ))}
        </div>
        <div className="filters-line">
          <SearchBar value={props.search} onChange={props.setSearch} placeholder="Buscar atendimento" />
          <Select value={props.channelFilter} onChange={(event) => props.setChannelFilter(event.target.value)}>
            <option>Todos</option>
            {data.channels.map((channel) => <option key={channel.id}>{channel.name}</option>)}
          </Select>
        </div>
        <div className="attendance-list">
          {contacts.map((contact, index) => (
            <button className={props.selectedContact?.id === contact.id ? 'attendance-item active' : 'attendance-item'} key={contact.id} onClick={() => props.onSelectContact(contact.id)}>
              <div className="avatar">{initials(contact.name)}</div>
              <div>
                <strong>{contact.name || contact.phone}</strong>
                <span>{messagePreview(data.messages.find((message) => message.contactId === contact.id)?.body || 'Sem mensagens')}</span>
                <small>{lookup.departments[contact.departmentId]?.name} - {lookup.channels[contact.channelId]?.name}</small>
              </div>
              <aside><small>20:{20 + index}</small><Badge color="#dcfce7">{index + 1}</Badge></aside>
            </button>
          ))}
        </div>
      </div>
      <div className="conversation-panel">
        {props.selectedContact ? (
          <>
            <header className="conversation-head">
              <div className="avatar">{initials(props.selectedContact.name)}</div>
              <div><strong>{props.selectedContact.name}</strong><span>{props.selectedContact.phone} - {lookup.channels[props.selectedContact.channelId]?.name}</span></div>
              <Button variant="secondary" onClick={props.onOpenContact}><CircleUserRound size={16} /> Dados</Button>
              <Button variant="secondary"><BriefcaseBusiness size={16} /> Transferir</Button>
              <Button variant="secondary" onClick={props.onNewAppointment}><CalendarDays size={16} /> Agendar</Button>
              <Button variant="secondary" onClick={props.onNewCard}><Grid2X2 size={16} /> Mover para Funil</Button>
            </header>
            <div className="messages">
              {props.messages.map((message) => (
                <div className={message.direction === 'outbound' ? 'bubble outbound' : 'bubble'} key={message.id}>
                  <MessageBody body={message.body} />
                  <small>{formatDateTime(message.createdAt)}</small>
                </div>
              ))}
            </div>
            <footer className="composer">
              <IconButton aria-label="Anexar arquivo"><Paperclip size={18} /></IconButton>
              <input value={props.messageText} onChange={(event) => props.setMessageText(event.target.value)} placeholder="Digite uma mensagem" onKeyDown={(event) => { if (event.key === 'Enter') props.onSend() }} />
              <Button onClick={props.onSend}><Send size={16} /> Enviar</Button>
            </footer>
          </>
        ) : (
          <EmptyState icon={<MessageCircle />} title="Selecione um atendimento ou inicie um novo" description="Escolha um contato na lista para abrir a conversa." action={<Button onClick={props.onNewContact}><Plus size={16} /> Iniciar um novo atendimento</Button>} />
        )}
      </div>
      <aside className="contact-aside">
        {props.selectedContact ? (
          <>
            <div className="avatar big">{initials(props.selectedContact.name)}</div>
            <h3>{props.selectedContact.name}</h3>
            <p>{props.selectedContact.email}</p>
            <Badge color="#fee2e2">{lookup.departments[props.selectedContact.departmentId]?.name}</Badge>
            <h4>Historico</h4>
            {props.messages.slice(-4).map((message) => <div className="history-line" key={message.id}><MessageBody body={message.body} compact /></div>)}
            <h4>Cards vinculados</h4>
            <p>{props.selectedCard?.title || 'Nenhum card vinculado'}</p>
          </>
        ) : null}
      </aside>
    </section>
  )
}

function CrmPage(props: {
  data: BootstrapData
  lookup: Lookup
  funnel: Funnel
  stages: Stage[]
  search: string
  setSearch: (value: string) => void
  statusFilter: string
  setStatusFilter: (value: string) => void
  channelFilter: string
  setChannelFilter: (value: string) => void
  channelsOpen: boolean
  setChannelsOpen: (value: boolean) => void
  onFunnelChange: (id: string) => void
  onDragEnd: (event: DragEndEvent) => void
  onNewCard: (stageId?: string) => void
  onNewStage: () => void
  onNewFunnel: () => void
  onEditStage: (stage: Stage) => void
  onEditFunnel: () => void
  onDuplicateFunnel: () => void
  onDeleteStage: (stage: Stage) => void
  onDeleteFunnel: () => void
}) {
  const cards = props.data.cards.filter((card) => {
    const channel = props.lookup.channels[card.channelId]?.name || ''
    return card.funnelId === props.funnel.id
      && `${card.title} ${card.description}`.toLowerCase().includes(props.search.toLowerCase())
      && (props.statusFilter === 'Todos' || card.status === props.statusFilter)
      && (props.channelFilter === 'Todos' || channel === props.channelFilter)
  })
  return (
    <section className="crm-page">
      <div className="crm-toolbar">
        <div className="funnel-title">
          <Select value={props.funnel.id} onChange={(event) => props.onFunnelChange(event.target.value)}>{props.data.funnels.map((funnel) => <option key={funnel.id} value={funnel.id}>{funnel.name}</option>)}</Select>
          <Badge color="#e0f2fe">{props.stages.length} etapas</Badge>
          <IconButton aria-label="Editar funil" onClick={props.onEditFunnel}><Settings size={17} /></IconButton>
          <IconButton aria-label="Duplicar funil" onClick={props.onDuplicateFunnel}><Download size={17} /></IconButton>
          <IconButton aria-label="Excluir funil" onClick={props.onDeleteFunnel}><Trash2 size={17} /></IconButton>
          <IconButton aria-label="Atualizar"><RefreshCw size={17} /></IconButton>
        </div>
        <div className="toolbar-actions">
          <Badge color="#fee2e2"><Grid2X2 size={14} /> Kanban</Badge>
          <Button variant="secondary" onClick={props.onNewFunnel}><Plus size={16} /> Novo Funil</Button>
          <Button variant="secondary" onClick={props.onNewStage}><Plus size={16} /> Nova Etapa</Button>
          <Button onClick={() => props.onNewCard()}><Plus size={16} /> Novo Card</Button>
        </div>
      </div>
      <div className="filters-line">
        <SearchBar value={props.search} onChange={props.setSearch} placeholder="Busque pelo card" />
        <Select value={props.statusFilter} onChange={(event) => props.setStatusFilter(event.target.value)}>
          <option>Todos</option><option>aberto</option><option>concluido</option>
        </Select>
        <Badge color="#f1f5f9">{cards.length} cards</Badge>
      </div>
      <div className={props.channelsOpen ? 'channel-drawer open' : 'channel-drawer'}>
        <button className="drawer-tab" onClick={() => props.setChannelsOpen(!props.channelsOpen)} aria-label="Abrir canais">{props.channelsOpen ? <ChevronLeft /> : <ChevronRight />}</button>
        {props.channelsOpen ? (
          <div>
            <h3>Canais</h3>
            <button className={props.channelFilter === 'Todos' ? 'channel-filter active' : 'channel-filter'} onClick={() => props.setChannelFilter('Todos')}>Todos <span>{props.data.cards.length}</span></button>
            {props.data.channels.map((channel) => (
              <button className={props.channelFilter === channel.name ? 'channel-filter active' : 'channel-filter'} key={channel.id} onClick={() => props.setChannelFilter(channel.name)}>
                {channel.name}<span>{props.data.cards.filter((card) => card.channelId === channel.id).length}</span>
              </button>
            ))}
            <Button variant="secondary"><Plus size={15} /> Adicionar Lista</Button>
          </div>
        ) : null}
      </div>
      <DndContext onDragEnd={props.onDragEnd}>
        <div className="kanban">
          {props.stages.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              cards={cards.filter((card) => card.stageId === stage.id).sort((a, b) => a.position - b.position)}
              lookup={props.lookup}
              onAdd={() => props.onNewCard(stage.id)}
              onEdit={() => props.onEditStage(stage)}
              onDelete={() => props.onDeleteStage(stage)}
            />
          ))}
        </div>
      </DndContext>
    </section>
  )
}

type Lookup = {
  contacts: Record<string, Contact>
  departments: Record<string, Department>
  channels: Record<string, Channel>
  users: Record<string, User>
  stages: Record<string, Stage>
  funnels: Record<string, Funnel>
  tags: Record<string, { id: string; name: string; color: string }>
}

function KanbanColumn({ stage, cards, lookup, onAdd, onEdit, onDelete }: { stage: Stage; cards: CrmCard[]; lookup: Lookup; onAdd: () => void; onEdit: () => void; onDelete: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })
  const color = stageColors[stage.color] || stage.color
  return (
    <section className={isOver ? 'kanban-column over' : 'kanban-column'} ref={setNodeRef} style={{ ['--stage' as string]: color }}>
      <header>
        <div><span className="stage-dot" /><strong>{stage.name}</strong><Badge color="#fff1f2">{cards.length}</Badge></div>
        <div><IconButton aria-label="Adicionar card" onClick={onAdd}><Plus size={17} /></IconButton><IconButton aria-label="Editar etapa" onClick={onEdit}><MoreHorizontal size={17} /></IconButton><IconButton aria-label="Excluir etapa" onClick={onDelete}><Trash2 size={15} /></IconButton></div>
      </header>
      <div className="kanban-cards">
        {cards.length ? cards.map((card) => <KanbanCardItem key={card.id} card={card} lookup={lookup} />) : (
          <EmptyState icon={<Inbox />} title="Nenhum card" description="Arraste cards para esta coluna ou adicione um novo" action={<Button onClick={onAdd}><Plus size={15} /> Adicionar Card</Button>} />
        )}
      </div>
    </section>
  )
}

function KanbanCardItem({ card, lookup }: { card: CrmCard; lookup: Lookup }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id })
  const style = { transform: CSS.Translate.toString(transform) }
  return (
    <article className={isDragging ? 'kanban-card dragging' : 'kanban-card'} ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <header><strong>{card.title}</strong><MoreHorizontal size={16} /></header>
      <p>{card.description || 'Sem resumo'}</p>
      <div className="card-meta"><Badge color="#f8fafc">N/D</Badge><span>{lookup.contacts[card.contactId]?.phone || card.phone}</span></div>
      <div className="tag-row">
        <Badge color="#eff6ff">{lookup.departments[card.departmentId]?.name || 'Sem setor'}</Badge>
        <Badge color="#fef3c7">{lookup.channels[card.channelId]?.name || 'Manual'}</Badge>
      </div>
      <footer><span>{lookup.users[card.assignedUserId]?.name || 'Sem responsavel'}</span><small>{formatDate(card.updatedAt)}</small></footer>
    </article>
  )
}

function DashboardPage({ data }: { data: BootstrapData; lookup: Lookup }) {
  const s = data.reports.summary
  return (
    <section className="page-flow">
      <div className="stat-grid">
        <StatCard label="Total de contatos" value={s.contacts} icon={<Users />} />
        <StatCard label="Atendimentos abertos" value={s.openAttendances} icon={<Headphones />} accent="#22c55e" />
        <StatCard label="Cards no Funil" value={s.cards} icon={<Grid2X2 />} accent="#3498db" />
        <StatCard label="Agendamentos hoje" value={s.appointmentsToday} icon={<CalendarDays />} accent="#f59e0b" />
        <StatCard label="Campanhas ativas" value={s.activeCampaigns} icon={<Send />} />
        <StatCard label="Departamentos" value={s.departments} icon={<Inbox />} accent="#8b5cf6" />
        <StatCard label="Usuarios" value={s.users} icon={<CircleUserRound />} />
        <StatCard label="Taxa de conversao" value={`${s.conversionRate}%`} icon={<Gauge />} accent="#22c55e" />
      </div>
      <div className="chart-grid">
        <SimpleBar title="Cards por etapa" data={data.reports.charts.byStage} dataKey="cards" />
        <SimpleBar title="Atendimentos por canal" data={data.reports.charts.byChannel} dataKey="total" />
        <SimpleBar title="Agendamentos da semana" data={data.reports.charts.appointmentsWeek} dataKey="total" />
      </div>
      <section className="panel">
        <h2>Atividades recentes</h2>
        {data.activityLogs.slice(0, 8).map((activity) => (
          <div className="activity-row" key={activity.id}><Activity size={16} /><span>{activity.description}</span><small>{formatDateTime(activity.createdAt)}</small></div>
        ))}
      </section>
    </section>
  )
}

function CampaignsPage({ data, search, setSearch, statusFilter, setStatusFilter, onCreate, onEdit, onDelete, onSimulate }: { data: BootstrapData; search: string; setSearch: (value: string) => void; statusFilter: string; setStatusFilter: (value: string) => void; onCreate: () => void; onEdit: (item: Campaign) => void; onDelete: (item: Campaign) => void; onSimulate: (item: Campaign) => void }) {
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const campaigns = data.campaigns.filter((campaign) => campaign.name.toLowerCase().includes(search.toLowerCase()) && (statusFilter === 'Todos' || campaign.status === statusFilter))
  return (
    <section className="page-flow">
      <PageIntro title="Campanhas" subtitle="Gerencie e acompanhe suas campanhas de marketing." />
      <div className="filters-line panel">
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar campanhas..." />
        <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>{['Todos', 'Rascunho', 'Agendado', 'Em andamento', 'Completo', 'Pausado'].map((status) => <option key={status}>{status}</option>)}</Select>
        <div className="segmented"><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}><List size={16} /></button><button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')}><Grid2X2 size={16} /></button></div>
      </div>
      <div className={view === 'grid' ? 'campaign-grid' : 'campaign-list'}>
        <button className="new-campaign" onClick={onCreate}><Plus size={28} /><strong>Nova campanha</strong></button>
        {campaigns.map((campaign) => (
          <article className="campaign-card" key={campaign.id}>
            <header><strong>{campaign.name}</strong><IconButton aria-label="Editar campanha" onClick={() => onEdit(campaign)}><MoreHorizontal size={17} /></IconButton></header>
            <span><CalendarDays size={16} /> {formatDateTime(campaign.scheduledAt)}</span>
            <Badge color={campaign.status === 'Completo' ? '#dcfce7' : '#fef3c7'}>{campaign.status}</Badge>
            <div className="campaign-metrics">
              <span><Clock3 size={15} /> {campaign.failedCount}</span>
              <span><CheckCircle2 size={15} /> {campaign.deliveredCount}</span>
              <span><Eye size={15} /> {campaign.readCount}</span>
              <span><MessageCircle size={15} /> {campaign.repliedCount}</span>
            </div>
            <footer><Button variant="secondary" onClick={() => onSimulate(campaign)}>Simular disparo</Button><Button variant="danger" onClick={() => onDelete(campaign)}><Trash2 size={15} /></Button></footer>
          </article>
        ))}
      </div>
    </section>
  )
}

function AppointmentsPage({ data, lookup, currentUser, onCreate, onCreateDoctor, onEdit, onDelete, onOpen }: { data: BootstrapData; lookup: Lookup; currentUser: User; onCreate: (seed?: FormState) => void; onCreateDoctor: () => void; onEdit: (item: Appointment) => void; onDelete: (item: Appointment) => void; onOpen: (item: Appointment) => void }) {
  const [view, setView] = useState<'mes' | 'semana' | 'lista'>('mes')
  const canManageDoctors = isAdmin(currentUser)
  const [doctorFilter, setDoctorFilter] = useState(canManageDoctors ? 'Todos' : currentUser.id)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const nextAppointment = data.appointments.map((item) => item.date).sort()[0]
    return (nextAppointment || new Date().toISOString().slice(0, 10)).slice(0, 7)
  })
  const doctors = canManageDoctors ? data.users.filter((user) => user.role === 'medico' || user.title.toLowerCase().includes('medic') || user.title.toLowerCase().includes('médic')) : [currentUser]
  const appointments = data.appointments.filter((appointment) => doctorFilter === 'Todos' || appointment.assignedUserId === doctorFilter)
  const visibleAppointments = appointments.filter((appointment) => view === 'lista' || appointment.date.startsWith(selectedMonth))
  const defaultDoctorId = doctorFilter !== 'Todos' ? doctorFilter : doctors[0]?.id || ''
  const typeColors: Record<string, string> = { Consulta: '#e0f2fe', Cirurgia: '#fee2e2', Reuniao: '#ede9fe', Retorno: '#dcfce7', Exame: '#fef3c7' }
  const surgicalToday = visibleAppointments.filter((item) => item.type === 'Cirurgia').length
  const confirmed = visibleAppointments.filter((item) => item.status === 'confirmado').length
  const days = monthDays(selectedMonth)
  const shiftMonth = (amount: number) => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const next = new Date(year, month - 1 + amount, 1)
    setSelectedMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`)
  }
  return (
    <section className="page-flow">
      <div className="page-head">
        <PageIntro title="Agenda medica" subtitle="Controle consultas, cirurgias, exames, retornos e reunioes por medico." />
        <div className="top-actions">
          {canManageDoctors ? <Button variant="secondary" onClick={onCreateDoctor}><UserPlus size={16} /> Novo medico</Button> : null}
          <Button onClick={() => onCreate({ assignedUserId: defaultDoctorId })}><Plus size={16} /> Novo Agendamento</Button>
        </div>
      </div>
      <section className="clinic-command panel">
        <div>
          <span className="eyebrow">Central clinica</span>
          <h2>Mapa do dia por medico</h2>
          <p className="muted">Agenda inteligente para evitar choque de sala, preparar equipe e enxergar procedimentos criticos.</p>
        </div>
        <StatCard label="Medicos ativos" value={doctors.length} icon={<CircleUserRound />} accent="#3498db" />
        <StatCard label="Cirurgias no periodo" value={surgicalToday} icon={<ShieldCheck />} accent="#ef4444" />
        <StatCard label="Confirmados" value={confirmed} icon={<CheckCircle2 />} accent="#22c55e" />
      </section>
      <div className="filters-line panel">
        <div className="segmented wide">{['mes', 'semana', 'lista'].map((item) => <button className={view === item ? 'active' : ''} key={item} onClick={() => setView(item as 'mes')}>{item}</button>)}</div>
        <Field label="Medico"><Select value={doctorFilter} onChange={(event) => setDoctorFilter(event.target.value)} disabled={!canManageDoctors}>{canManageDoctors ? <option>Todos</option> : null}{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name} - {doctor.specialty || doctor.title}</option>)}</Select></Field>
        <div className="month-switcher">
          <IconButton aria-label="Mes anterior" onClick={() => shiftMonth(-1)}><ChevronLeft size={16} /></IconButton>
          <strong>{monthLabel(selectedMonth)}</strong>
          <IconButton aria-label="Proximo mes" onClick={() => shiftMonth(1)}><ChevronRight size={16} /></IconButton>
        </div>
        <div className="tag-row">{Object.entries(typeColors).map(([type, color]) => <Badge key={type} color={color}>{type}</Badge>)}</div>
      </div>
      {view !== 'lista' ? (
        <div className="calendar-grid">
          {days.map((day) => {
            const items = appointments.filter((appointment) => appointment.date === day)
            return <button className="calendar-day" key={day} onClick={() => onCreate({ date: day, assignedUserId: defaultDoctorId })}><strong>{Number(day.slice(-2))}</strong>{items.map((item) => <span className={`appt-type ${String(item.type || 'Consulta').toLowerCase()}`} key={item.id} onClick={(event) => { event.stopPropagation(); onOpen(item) }}>{item.title}<small>{lookup.users[item.assignedUserId]?.name || 'Medico'} - {item.startTime}</small></span>)}</button>
          })}
        </div>
      ) : (
        <div className="panel">{appointments.map((appointment) => <div className="list-row" key={appointment.id}><div><strong>{appointment.title}</strong><span>{appointment.type || 'Consulta'} - {appointment.date} {appointment.startTime} - {lookup.users[appointment.assignedUserId]?.name || 'Sem medico'} - {appointment.room || 'Sem sala'}</span></div><Badge color={typeColors[appointment.type || 'Consulta'] || '#fef3c7'}>{appointment.status}</Badge><Button variant="secondary" onClick={() => onEdit(appointment)}>Editar</Button><Button variant="danger" onClick={() => onDelete(appointment)}>Excluir</Button></div>)}</div>
      )}
    </section>
  )
}

function ReportsPage({ data, onExport }: { data: BootstrapData; onExport: () => void }) {
  const s = data.reports.summary
  return (
    <section className="page-flow">
      <div className="report-filters panel">
        <Field label="Data Inicial"><Input type="date" defaultValue="2026-05-01" /></Field>
        <Field label="Data Final"><Input type="date" defaultValue="2026-05-21" /></Field>
        <Field label="Departamentos"><Select><option>Todos</option></Select></Field>
        <Field label="Usuarios"><Select><option>Todos</option></Select></Field>
        <Button><Filter size={16} /> Aplicar Filtros</Button>
        <Button variant="secondary" onClick={onExport}><Download size={16} /> Exportar CSV</Button>
      </div>
      <h2>Atendimentos</h2>
      <div className="stat-grid reports">
        {[
          ['Em aberto', s.openAttendances], ['Encerrados', s.closedAttendances], ['Total', s.totalAttendances],
          ['Ativos', s.active], ['Receptivos', s.receptive], ['Aguardando atendimento', s.waiting],
          ['Tempo de espera medio', s.avgWait], ['Tempo de atendimento medio', s.avgService], ['Tempo de espera ativo', s.activeWait],
          ['Cards criados', s.cardsCreated], ['Cards ganhos/concluidos', s.cardsWon], ['Campanhas enviadas', s.campaignsSent], ['Agendamentos concluidos', s.appointmentsDone],
        ].map(([label, value]) => <StatCard key={String(label)} label={String(label)} value={value} icon={<Clock3 />} />)}
      </div>
      <div className="chart-grid wide">
        <ChartCard title="Abertos vs encerrados">
          <ResponsiveContainer width="100%" height={260}><RePieChart><Pie data={[{ name: 'Abertos', value: s.openAttendances }, { name: 'Encerrados', value: s.closedAttendances }]} dataKey="value" innerRadius={70} outerRadius={100}>{['#ef5a3c', '#29254d'].map((color) => <Cell key={color} fill={color} />)}</Pie><Tooltip /></RePieChart></ResponsiveContainer>
        </ChartCard>
        <SimpleBar title="Atendimentos por Departamento" data={data.reports.charts.byDepartment} dataKey="total" />
        <SimpleBar title="Cards por etapa" data={data.reports.charts.byStage} dataKey="cards" />
        <ChartCard title="Atendimentos por dia">
          <ResponsiveContainer width="100%" height={260}><LineChart data={data.reports.charts.appointmentsWeek}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Line type="monotone" dataKey="total" stroke="#ef5a3c" strokeWidth={3} /></LineChart></ResponsiveContainer>
        </ChartCard>
        <SimpleBar title="Campanhas por performance" data={data.reports.charts.campaignPerformance} dataKey="entregues" />
      </div>
      <DataTable columns={['contact', 'phone', 'channel', 'department', 'responsible', 'status', 'createdAt', 'updatedAt', 'openTime', 'stage']} rows={data.reports.table} />
    </section>
  )
}

function ContactsPage({ data, lookup, search, setSearch, onCreate, onEdit }: { data: BootstrapData; lookup: Lookup; search: string; setSearch: (value: string) => void; onCreate: () => void; onEdit: (item: Contact) => void }) {
  const rows = data.contacts.filter((contact) => `${contact.name} ${contact.phone}`.toLowerCase().includes(search.toLowerCase())).map((contact) => ({
    id: contact.id,
    nome: <button className="link-button" onClick={() => onEdit(contact)}>{contact.name}</button>,
    telefone: contact.phone,
    email: contact.email,
    canal: lookup.channels[contact.channelId]?.name,
    departamento: lookup.departments[contact.departmentId]?.name,
    tags: contact.tagIds.map((tagId) => lookup.tags[tagId]?.name).join(', '),
    criado: formatDate(contact.createdAt),
  }))
  return <CrudPage title="Contatos" subtitle="Base de contatos com historico, tags e origem." action="Criar contato" onCreate={onCreate} search={search} setSearch={setSearch}><DataTable columns={['nome', 'telefone', 'email', 'canal', 'departamento', 'tags', 'criado']} rows={rows} /></CrudPage>
}

function GroupsPage({ data, onCreate, onEdit, onDelete }: { data: BootstrapData; onCreate: () => void; onEdit: (item: ContactGroup) => void; onDelete: (item: ContactGroup) => void }) {
  return <CrudCards title="Grupos" subtitle="Listas segmentadas para campanhas." action="Novo grupo" onCreate={onCreate} items={data.groups.map((group) => ({ id: group.id, title: group.name, description: group.description, meta: `${group.contactIds?.length || 0} contatos`, onEdit: () => onEdit(group), onDelete: () => onDelete(group) }))} />
}

function DepartmentsPage({ data, onCreate, onEdit, onDelete }: { data: BootstrapData; onCreate: () => void; onEdit: (item: Department) => void; onDelete: (item: Department) => void }) {
  return <CrudCards title="Departamentos" subtitle="Setores que impactam cards, atendimentos e relatorios." action="Novo departamento" onCreate={onCreate} items={data.departments.map((department) => ({ id: department.id, title: department.name, description: department.description, meta: `${data.cards.filter((card) => card.departmentId === department.id).length} cards`, color: stageColors[department.color], onEdit: () => onEdit(department), onDelete: () => onDelete(department) }))} />
}

function UsersPage({ data, lookup, onCreate, onEdit, onDelete }: { data: BootstrapData; lookup: Lookup; onCreate: () => void; onEdit: (item: User) => void; onDelete: (item: User) => void }) {
  const rows = data.users.map((user) => ({ id: user.id, nome: <button className="link-button" onClick={() => onEdit(user)}>{user.name}</button>, email: user.email, cargo: user.title, departamento: lookup.departments[user.departmentId]?.name, papel: user.role, status: user.status, acoes: <Button variant="danger" onClick={() => onDelete(user)}>Remover</Button> }))
  return <CrudPage title="Usuarios" subtitle="Equipe, permissoes e atribuicoes." action="Criar usuario" onCreate={onCreate}><DataTable columns={['nome', 'email', 'cargo', 'departamento', 'papel', 'status', 'acoes']} rows={rows} /></CrudPage>
}

function BotsPage({ data, onCreate, onEdit }: { data: BootstrapData; onCreate: () => void; onEdit: (item: AutomationBot) => void }) {
  return <CrudCards title="Robos" subtitle="Automacoes simuladas prontas para ligar aos eventos do CRM." action="Criar robo" onCreate={onCreate} items={data.automationBots.map((bot) => ({ id: bot.id, title: bot.name, description: `${bot.trigger} -> ${bot.action}`, meta: bot.status, onEdit: () => onEdit(bot) }))} />
}

function SettingsPage({ data, onEdit }: { data: BootstrapData; onEdit: () => void }) {
  const settings = data.settings[0]
  return (
    <section className="page-flow">
      <div className="page-head"><PageIntro title="Configuracoes" subtitle="Conta, tema, canais, integracoes e webhooks." /><Button onClick={onEdit}><Settings size={16} /> Editar configuracoes</Button></div>
      <section className="settings-hero panel">
        <div>
          <span className="eyebrow">Workspace</span>
          <h2>{settings.companyName}</h2>
          <p className="muted">{settings.email} - {settings.phone}</p>
        </div>
        <div className="settings-summary">
          <span><strong>{settings.theme === 'dark' ? 'Escuro' : 'Claro'}</strong>Tema</span>
          <span><strong>{settings.density === 'compact' ? 'Compacta' : 'Confortavel'}</strong>Densidade</span>
          <span><strong>{settings.language}</strong>Idioma</span>
        </div>
      </section>
      <div className="settings-grid">
        <section className="panel settings-card"><h2>Aparencia</h2><div className="theme-preview"><span style={{ background: settings.primaryColor }} /><div><strong>{settings.theme === 'dark' ? 'Tema escuro' : 'Tema claro'}</strong><p>{settings.density === 'compact' ? 'Densidade compacta' : 'Densidade confortavel'}</p></div></div></section>
        <section className="panel settings-card"><h2>Localizacao</h2><p>{settings.timezone}</p><p>{settings.language}</p></section>
        <section className="panel settings-card"><h2>Canais</h2><div className="tag-row">{data.channels.map((channel) => <Badge key={channel.id} color="#eff6ff">{channel.name} - {channel.status}</Badge>)}</div></section>
        <section className="panel settings-card wide"><h2>Integracoes</h2>{Object.entries(settings.integrations).map(([key, value]) => <div className="list-row" key={key}><strong>{key}</strong><Badge color="#fef3c7">{value.status}</Badge><span>{value.tokenMasked || value.url}</span></div>)}</section>
        <section className="panel settings-card"><h2>Webhook</h2><code>POST /api/webhooks/inbound-message</code></section>
      </div>
    </section>
  )
}

function ProfilePage({ data, profile, onBack, onEdit }: { data: BootstrapData; profile: BootstrapData['settings'][number]['profile'] & { id?: string }; onBack: () => void; onEdit: () => void }) {
  return (
    <section className="profile-page">
      <button className="back-link" onClick={onBack}><ChevronLeft size={20} /> Meu perfil</button>
      <aside className="profile-card">
        <div className="profile-cover" />
        <div className="avatar huge">{initials(profile.name)}</div>
        <h2>{profile.name}</h2>
        <Badge color="#e0f2fe">Administrador</Badge>
        <p>{profile.email}</p>
        <div className="profile-checks">
          <span><Mail size={16} /> Email Verificado</span>
          <span><Phone size={16} /> WhatsApp Verificado</span>
          <span><ShieldCheck size={16} /> Notificacoes {profile.notifications ? 'Ativado' : 'Desativado'}</span>
          <span><Lock size={16} /> Duas etapas {profile.twoFactor ? 'Ativado' : 'Desativado'}</span>
        </div>
        <div className="tag-row">{data.departments.slice(0, 5).map((department) => <Badge key={department.id} color="#f1f5f9">{department.name}</Badge>)}</div>
        <small>Membro desde {profile.memberSince}</small>
      </aside>
      <main className="profile-main">
        <section className="panel">
          <div className="page-head"><PageIntro title="Dados Pessoais" subtitle="Gerencie suas informacoes basicas de identificacao." /><Button onClick={onEdit}>Editar dados</Button></div>
          <div className="profile-details">
            <div><span>Nome</span><strong>{profile.name}</strong></div>
            <div><span>Email comercial</span><strong>{profile.email}</strong></div>
            <div><span>WhatsApp</span><strong>{profile.whatsapp}</strong></div>
            <div><span>Cargo</span><strong>{profile.title || 'Nao informado'}</strong></div>
          </div>
        </section>
        <section className="panel"><PageIntro title="Seguranca" subtitle="Atualize sua senha de acesso." /><div className="form-grid"><Field label="Senha Atual"><Input type="password" placeholder="Insira sua senha atual" /></Field><Field label="Nova Senha"><Input type="password" placeholder="Minimo 8 caracteres" /></Field><Field label="Confirmar Nova Senha"><Input type="password" placeholder="Repita a nova senha" /></Field></div><Button>Alterar Senha</Button></section>
        <section className="panel"><PageIntro title="Aparencia" subtitle="O tema real fica em Configuracoes e muda todo o sistema." /><div className="profile-details"><div><span>Tema</span><strong>{data.settings[0].theme === 'dark' ? 'Escuro' : 'Claro'}</strong></div><div><span>Cor principal</span><strong>{data.settings[0].primaryColor}</strong></div><div><span>Densidade</span><strong>{data.settings[0].density === 'compact' ? 'Compacta' : 'Confortavel'}</strong></div></div></section>
      </main>
    </section>
  )
}

function SimpleBar({ title, data, dataKey }: { title: string; data: Array<Record<string, string | number>>; dataKey: string }) {
  return (
    <ChartCard title={title}>
      <ResponsiveContainer width="100%" height={260}><BarChart data={data}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" hide={data.length > 8} /><YAxis /><Tooltip /><Bar dataKey={dataKey} fill="#ef5a3c" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
    </ChartCard>
  )
}

function PageIntro({ title, subtitle }: { title: string; subtitle: string }) {
  return <div><h2>{title}</h2><p className="muted">{subtitle}</p></div>
}

function CrudPage({ title, subtitle, action, onCreate, search, setSearch, children }: { title: string; subtitle: string; action: string; onCreate: () => void; search?: string; setSearch?: (value: string) => void; children: ReactNode }) {
  return (
    <section className="page-flow">
      <div className="page-head"><PageIntro title={title} subtitle={subtitle} /><Button onClick={onCreate}><Plus size={16} /> {action}</Button></div>
      {setSearch ? <div className="filters-line panel"><SearchBar value={search || ''} onChange={setSearch} placeholder={`Buscar ${title.toLowerCase()}`} /></div> : null}
      {children}
    </section>
  )
}

function CrudCards({ title, subtitle, action, onCreate, items }: { title: string; subtitle: string; action: string; onCreate: () => void; items: Array<{ id: string; title: string; description: string; meta?: string; color?: string; onEdit?: () => void; onDelete?: () => void }> }) {
  return (
    <CrudPage title={title} subtitle={subtitle} action={action} onCreate={onCreate}>
      <div className="card-grid">{items.map((item) => <article className="entity-card" key={item.id} style={{ ['--stage' as string]: item.color || '#ef5a3c' }}><header><span className="stage-dot" /><strong>{item.title}</strong></header><p>{item.description}</p><Badge color="#f8fafc">{item.meta}</Badge><footer>{item.onEdit ? <Button variant="secondary" onClick={item.onEdit}>Editar</Button> : null}{item.onDelete ? <Button variant="danger" onClick={item.onDelete}>Excluir</Button> : null}</footer></article>)}</div>
    </CrudPage>
  )
}

function FormModal({ mode, form, errors, data, saving, editing, onChange, onClose, onSubmit }: { mode: FormMode | null; form: FormState; errors: Record<string, string>; data: BootstrapData; saving: boolean; editing: boolean; onChange: (key: string, value: string | number | boolean | string[]) => void; onClose: () => void; onSubmit: () => void }) {
  if (!mode) return null
  const title = `${editing ? 'Editar' : 'Novo'} ${labelForMode(mode)}`
  const field = (name: string, label: string, placeholder = '', type = 'text') => <Field label={label} error={errors[name]}><Input type={type} value={String(form[name] ?? '')} placeholder={placeholder} onChange={(event) => onChange(name, event.target.value)} /></Field>
  const select = (name: string, label: string, options: Array<{ id: string; name: string }>) => <Field label={label} error={errors[name]}><Select value={String(form[name] ?? '')} onChange={(event) => onChange(name, event.target.value)}><option value="">Selecione</option>{options.map((option) => <option value={option.id} key={option.id}>{option.name}</option>)}</Select></Field>
  const doctors = data.users.filter((user) => user.role === 'medico' || user.title.toLowerCase().includes('medic') || user.title.toLowerCase().includes('médic') || user.title.toLowerCase().includes('mÃ©dic'))
  return (
    <Modal title={title} open onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={saving} onClick={onSubmit}>Salvar</Button></>}>
      <div className="form-grid">
        {mode === 'card' ? <>{field('title', 'Titulo obrigatorio', 'Ex: Atendimento - Maria')}{select('contactId', 'Contato', data.contacts)}{field('phone', 'Telefone', '+55 49 99999-9999')}{select('funnelId', 'Funil', data.funnels)}{select('stageId', 'Etapa', data.stages)}{select('departmentId', 'Departamento', data.departments)}{select('channelId', 'Canal', data.channels)}{select('assignedUserId', 'Responsavel', data.users)}{field('priority', 'Prioridade', 'normal')}{field('value', 'Valor', '0', 'number')}<Field label="Descricao"><TextArea value={String(form.description ?? '')} onChange={(event) => onChange('description', event.target.value)} /></Field>{field('dueAt', 'Data de retorno', '', 'date')}<Field label="Observacoes"><TextArea value={String(form.notes ?? '')} onChange={(event) => onChange('notes', event.target.value)} /></Field></> : null}
        {mode === 'stage' ? <>{field('name', 'Nome da etapa', 'Ex: Prova')}{select('funnelId', 'Funil', data.funnels)}<Field label="Cor"><Select value={String(form.color ?? 'blue')} onChange={(event) => onChange('color', event.target.value)}>{Object.keys(stageColors).map((color) => <option key={color}>{color}</option>)}</Select></Field>{field('order', 'Ordem', '0', 'number')}</> : null}
        {mode === 'funnel' ? <>{field('name', 'Nome do funil', 'Ex: Comercial') }<Field label="Status"><Select value={String(form.status ?? 'active')} onChange={(event) => onChange('status', event.target.value)}><option>active</option><option>archived</option></Select></Field></> : null}
        {mode === 'campaign' ? <>{field('name', 'Nome', 'Ex: Campanha Cascavel')}{select('channelId', 'Canal', data.channels)}<Field label="Mensagem" error={errors.message}><TextArea value={String(form.message ?? '')} onChange={(event) => onChange('message', event.target.value)} /></Field><Field label="Grupo/lista"><Select value={String(form.groupId ?? '')} onChange={(event) => onChange('groupId', event.target.value)}><option value="">Todos</option>{data.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</Select></Field>{field('scheduledAt', 'Agendar data/hora', '', 'datetime-local')}<Field label="Status"><Select value={String(form.status ?? 'Rascunho')} onChange={(event) => onChange('status', event.target.value)}>{['Rascunho', 'Agendado', 'Em andamento', 'Completo', 'Pausado'].map((status) => <option key={status}>{status}</option>)}</Select></Field></> : null}
        {mode === 'appointment' ? <>{field('title', 'Titulo', 'Ex: Consulta cardiologica')}<Field label="Tipo"><Select value={String(form.type ?? 'Consulta')} onChange={(event) => onChange('type', event.target.value)}>{['Consulta', 'Cirurgia', 'Reuniao', 'Retorno', 'Exame'].map((type) => <option key={type}>{type}</option>)}</Select></Field>{field('description', 'Descricao')}{field('date', 'Data', '', 'date')}{field('startTime', 'Hora inicial', '', 'time')}{field('endTime', 'Hora final', '', 'time')}{select('contactId', 'Paciente/contato', data.contacts)}{select('cardId', 'Lead/Card vinculado', data.cards.map((card) => ({ id: card.id, name: card.title })))}{select('departmentId', 'Setor clinico', data.departments)}{select('assignedUserId', 'Medico responsavel', doctors)}{field('room', 'Sala/consultorio', 'Consultorio 1')}<Field label="Status"><Select value={String(form.status ?? 'pendente')} onChange={(event) => onChange('status', event.target.value)}>{['pendente', 'confirmado', 'concluido', 'cancelado'].map((status) => <option key={status}>{status}</option>)}</Select></Field>{field('reminderMinutes', 'Lembrete (min)', '30', 'number')}<Field label="Observacoes"><TextArea value={String(form.notes ?? '')} onChange={(event) => onChange('notes', event.target.value)} /></Field></> : null}
        {mode === 'contact' ? <>{field('name', 'Nome')}{field('phone', 'Telefone')}{field('email', 'Email', '', 'email')}{select('channelId', 'Canal origem', data.channels)}{select('departmentId', 'Departamento', data.departments)}</> : null}
        {mode === 'department' ? <>{field('name', 'Nome')}{field('description', 'Descricao')}<Field label="Cor"><Select value={String(form.color ?? 'red')} onChange={(event) => onChange('color', event.target.value)}>{Object.keys(stageColors).map((color) => <option key={color}>{color}</option>)}</Select></Field></> : null}
        {mode === 'user' ? <>{field('name', 'Nome')}{field('email', 'Email', '', 'email')}{field('title', 'Cargo')}{field('specialty', 'Especialidade medica', 'Cardiologia')}{field('crm', 'CRM/registro', 'CRM-SP 000000')}{select('departmentId', 'Departamento', data.departments)}<Field label="Papel/permissao"><Select value={String(form.role ?? 'atendente')} onChange={(event) => onChange('role', event.target.value)}><option>administrador</option><option>supervisor</option><option>medico</option><option>atendente</option></Select></Field><Field label="Status"><Select value={String(form.status ?? 'active')} onChange={(event) => onChange('status', event.target.value)}><option>active</option><option>inactive</option></Select></Field></> : null}
        {mode === 'group' ? <>{field('name', 'Nome')}{field('description', 'Descricao')}<Field label="Contatos"><Select multiple value={(form.contactIds as string[]) || []} onChange={(event) => onChange('contactIds', Array.from(event.target.selectedOptions).map((option) => option.value))}>{data.contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}</Select></Field></> : null}
        {mode === 'bot' ? <>{field('name', 'Nome')}{field('trigger', 'Gatilho', 'novo atendimento')}{field('condition', 'Condicao', 'canal = WhatsApp')}{field('action', 'Acao', 'enviar mensagem')}<Field label="Status"><Select value={String(form.status ?? 'active')} onChange={(event) => onChange('status', event.target.value)}><option>active</option><option>inactive</option></Select></Field></> : null}
        {mode === 'profile' ? <>{field('name', 'Nome')}{field('email', 'Email comercial', '', 'email')}{field('whatsapp', 'WhatsApp')}{field('title', 'Cargo opcional')}<Field label="Notificacoes"><Select value={String(form.notifications ?? true)} onChange={(event) => onChange('notifications', event.target.value === 'true')}><option value="true">Ativado</option><option value="false">Desativado</option></Select></Field><Field label="Autenticacao em duas etapas"><Select value={String(form.twoFactor ?? false)} onChange={(event) => onChange('twoFactor', event.target.value === 'true')}><option value="true">Ativado</option><option value="false">Desativado</option></Select></Field></> : null}
        {mode === 'settings' ? <>{field('companyName', 'Nome do workspace')}{field('email', 'Email', '', 'email')}{field('phone', 'Telefone')}{field('timezone', 'Timezone')}{field('language', 'Idioma')}<Field label="Tema"><Select value={String(form.theme ?? 'light')} onChange={(event) => onChange('theme', event.target.value)}><option>light</option><option>dark</option></Select></Field>{field('primaryColor', 'Cor principal', '#ef5a3c', 'color')}<Field label="Densidade"><Select value={String(form.density ?? 'comfortable')} onChange={(event) => onChange('density', event.target.value)}><option>comfortable</option><option>compact</option></Select></Field></> : null}
      </div>
    </Modal>
  )
}

function EntityDrawer({ drawer, data, lookup, onClose, onEdit }: { drawer: { type: 'contact' | 'appointment' | 'stage' | 'campaign'; id?: string } | null; data: BootstrapData; lookup: Lookup; onClose: () => void; onEdit: (mode: FormMode, item: object & { id?: string }) => void }) {
  if (!drawer) return null
  const contact = drawer.type === 'contact' ? data.contacts.find((item) => item.id === drawer.id) : undefined
  const appointment = drawer.type === 'appointment' ? data.appointments.find((item) => item.id === drawer.id) : undefined
  return (
    <Drawer title="Detalhes" open onClose={onClose}>
      {contact ? <div className="drawer-section"><div className="avatar big">{initials(contact.name)}</div><h2>{contact.name}</h2><p>{contact.phone}</p><p>{contact.email}</p><Badge color="#eff6ff">{lookup.channels[contact.channelId]?.name}</Badge><h3>Historico</h3>{data.messages.filter((message) => message.contactId === contact.id).map((message) => <div className="history-line" key={message.id}><MessageBody body={message.body} compact /></div>)}<Button onClick={() => onEdit('contact', contact)}>Editar contato</Button></div> : null}
      {appointment ? <div className="drawer-section"><h2>{appointment.title}</h2><p>{appointment.description}</p><Badge color="#fef3c7">{appointment.status}</Badge><p>{appointment.date} {appointment.startTime} - {appointment.endTime}</p><p>{lookup.contacts[appointment.contactId]?.name}</p><Button onClick={() => onEdit('appointment', appointment)}>Editar agendamento</Button></div> : null}
    </Drawer>
  )
}

function defaultForm(mode: FormMode, seed: object): FormState {
  const safeSeed = Object.fromEntries(Object.entries(seed).filter(([, value]) => value !== undefined))
  const base: Record<FormMode, FormState> = {
    card: { title: '', description: '', contactId: '', phone: '', funnelId: 'funnel_gravacao', stageId: 'stage_n8n', departmentId: 'dep_recepcao', channelId: 'channel_1', assignedUserId: 'user_admin', priority: 'normal', value: 0, status: 'aberto', ...safeSeed },
    stage: { name: '', funnelId: 'funnel_gravacao', color: 'blue', order: 0, ...safeSeed },
    funnel: { name: '', status: 'active', ...safeSeed },
    campaign: { name: '', channelId: 'channel_7', message: '', status: 'Rascunho', scheduledAt: '', ...safeSeed },
    appointment: { title: '', type: 'Consulta', description: '', date: '', startTime: '', endTime: '', contactId: '', cardId: '', departmentId: 'dep_consultorios', assignedUserId: '', room: '', status: 'pendente', reminderMinutes: 30, notes: '', ...safeSeed },
    contact: { name: '', phone: '', email: '', channelId: 'channel_1', departmentId: 'dep_recepcao', ...safeSeed },
    department: { name: '', description: '', color: 'red', ...safeSeed },
    user: { name: '', email: '', title: '', specialty: '', crm: '', departmentId: 'dep_consultorios', role: 'atendente', status: 'active', ...safeSeed },
    group: { name: '', description: '', contactIds: [], ...safeSeed },
    bot: { name: '', trigger: '', condition: '', action: '', status: 'active', ...safeSeed },
    profile: { name: '', email: '', whatsapp: '+55', title: '', notifications: true, twoFactor: false, ...safeSeed },
    settings: { companyName: '', email: '', phone: '', timezone: 'America/Sao_Paulo', language: 'pt-BR', theme: 'light', density: 'comfortable', primaryColor: '#ef5a3c', ...safeSeed },
  }
  return base[mode]
}

function normalizePayload(mode: FormMode, form: FormState) {
  const payload = { ...form }
  if ('phone' in payload && payload.phone) payload.phone = normalizePhone(String(payload.phone))
  if (mode === 'campaign' && payload.scheduledAt) payload.scheduledAt = new Date(String(payload.scheduledAt)).toISOString()
  return payload
}

function resourceForMode(mode: FormMode) {
  const map: Record<FormMode, string> = { card: 'cards', stage: 'stages', funnel: 'funnels', campaign: 'campaigns', appointment: 'appointments', contact: 'contacts', department: 'departments', user: 'users', group: 'groups', bot: 'bots', profile: 'settings', settings: 'settings' }
  return map[mode]
}

function labelForMode(mode: FormMode) {
  const map: Record<FormMode, string> = { card: 'Card', stage: 'Etapa', funnel: 'Funil', campaign: 'Campanha', appointment: 'Agendamento', contact: 'Contato', department: 'Departamento', user: 'Usuario', group: 'Grupo', bot: 'Robo', profile: 'Perfil', settings: 'Configuracoes' }
  return map[mode]
}

export default App
