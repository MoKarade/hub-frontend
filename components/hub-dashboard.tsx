'use client'

/**
 * HubDashboard — Vrai hub d'infos visuelles (Marc 2026-05-05).
 *
 * Remplace l'ancien DashboardGrid qui ressemblait trop a la page /search.
 * Ici : KPIs globaux, insights inline, prochains events, photos thumbnails,
 * activite recente. Tout en live via SWR.
 *
 * Layout (responsive) :
 *   - KPI strip (4 tiles)
 *   - Insights band (top 4 cards)
 *   - Grid 2 colonnes :
 *       Col 1 : prochains events + dernieres transactions
 *       Col 2 : photos recentes (grid) + sante 7j (sparkline)
 */

import useSWR from 'swr'
import Link from 'next/link'
import {
  Mail,
  CheckSquare,
  Image as ImageIcon,
  Sparkles,
  Calendar,
  Wallet,
  Heart,
  MapPin,
  TrendingUp,
  AlertTriangle,
  AlertCircle,
  Bell,
  CalendarClock,
  Home,
  ListTodo,
  DollarSign,
  Repeat,
  Zap,
  TrendingDown,
  CheckCircle2,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import { cn, formatCurrency, formatRelative } from '@/lib/utils'

// ─── Fetcher ──────────────────────────────────────────────────────────────────

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json()
  })

// ─── Types API ────────────────────────────────────────────────────────────────

interface EmailStats {
  total: number
  unread: number
  with_attachments: number
  top_senders?: Array<{ sender_email: string; count: number; last_seen: string }>
}
interface TaskStats { total: number; pending: number; completed: number; overdue: number }
interface PhotoStats { total: number; photos: number; videos: number }
interface InsightApi {
  severity: 'critical' | 'warning' | 'info' | 'positive'
  icon: string
  title: string
  description: string
  delta?: string | null
  action?: string | null
  action_url?: string | null
  source: string
  generated_at: string
}
interface InsightsResponse { insights: InsightApi[]; total: number; by_severity: Record<string, number> }
interface CalendarEvent {
  id: string
  summary: string | null
  start_at: string
  end_at: string
  location: string | null
  all_day: boolean
}
interface Photo {
  id: string
  media_id: string
  filename: string | null
  base_url: string | null
  is_video: boolean
  creation_time: string
}
interface Transaction {
  id: string
  transaction_date: string
  description: string | null
  debit: string | null
  credit: string | null
  balance_after: string | null
}
interface MetricSummaryRow {
  metric: string
  last_date: string
  last_value: number
  avg_7d: number | null
  avg_prev_7d: number | null
  avg_30d: number | null
}
interface HealthSummary { total_datapoints: number; by_metric: MetricSummaryRow[] }

const ICON_MAP: Record<string, LucideIcon> = {
  AlertTriangle, AlertCircle, Bell, Calendar, CalendarClock, CheckCircle2,
  DollarSign, Home, ListTodo, Mail, Repeat, Sparkles, TrendingDown, TrendingUp, Zap,
}

const SEVERITY_STYLES: Record<InsightApi['severity'], { bg: string; border: string; text: string }> = {
  critical: { bg: 'bg-data-negative/5', border: 'border-data-negative/30', text: 'text-data-negative' },
  warning:  { bg: 'bg-warn/5',          border: 'border-warn/30',          text: 'text-warn' },
  info:     { bg: 'bg-info/5',          border: 'border-info/30',          text: 'text-info' },
  positive: { bg: 'bg-data-positive/5', border: 'border-data-positive/30', text: 'text-data-positive' },
}

// ─── Composant principal ─────────────────────────────────────────────────────

export function HubDashboard() {
  const todayIso = new Date().toISOString().slice(0, 10)

  // Tous les fetch en parallele via SWR
  const emailStats   = useSWR<EmailStats>('/api/v1/emails/stats', fetcher, { refreshInterval: 60000 })
  const taskStats    = useSWR<TaskStats>('/api/v1/tasks/stats', fetcher, { refreshInterval: 60000 })
  const photoStats   = useSWR<PhotoStats>('/api/v1/photos/stats', fetcher)
  const insights     = useSWR<InsightsResponse>('/api/v1/insights', fetcher, { refreshInterval: 120000 })
  const events       = useSWR<CalendarEvent[]>(`/api/v1/calendar/events?since=${todayIso}&limit=4`, fetcher, { refreshInterval: 300000 })
  const photos       = useSWR<Photo[]>('/api/v1/photos?limit=8', fetcher)
  const transactions = useSWR<Transaction[]>('/api/v1/finance/transactions?limit=5', fetcher)
  const healthSummary= useSWR<HealthSummary>('/api/v1/health-data/summary', fetcher)

  return (
    <div className="space-y-4">
      {/* ── KPI strip ──────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile
          href="/emails"
          label="Inbox non-lus"
          value={emailStats.data?.unread ?? '—'}
          subtitle={`${emailStats.data?.total ?? '—'} emails total`}
          icon={Mail}
          loading={emailStats.isLoading}
          accent={emailStats.data && emailStats.data.unread > 0 ? 'warn' : 'normal'}
        />
        <KpiTile
          href="/tasks"
          label="Taches en attente"
          value={taskStats.data?.pending ?? '—'}
          subtitle={
            taskStats.data
              ? `${taskStats.data.overdue} en retard · ${taskStats.data.completed} faites`
              : ''
          }
          icon={CheckSquare}
          loading={taskStats.isLoading}
          accent={taskStats.data && taskStats.data.overdue > 0 ? 'danger' : 'normal'}
        />
        <KpiTile
          href="/photos"
          label="Photos & videos"
          value={photoStats.data?.total ?? '—'}
          subtitle={
            photoStats.data
              ? `${photoStats.data.photos} photos · ${photoStats.data.videos} videos`
              : ''
          }
          icon={ImageIcon}
          loading={photoStats.isLoading}
        />
        <KpiTile
          href="/insights"
          label="Insights actifs"
          value={insights.data?.total ?? '—'}
          subtitle={
            insights.data
              ? `${insights.data.by_severity.critical || 0} critique · ${insights.data.by_severity.warning || 0} attention`
              : ''
          }
          icon={Sparkles}
          loading={insights.isLoading}
          accent={
            insights.data && (insights.data.by_severity.critical || 0) > 0
              ? 'danger'
              : insights.data && (insights.data.by_severity.warning || 0) > 0
                ? 'warn'
                : 'normal'
          }
        />
      </div>

      {/* ── Insights band (top 4 inline) ──────────────────── */}
      <SectionCard
        title="A regarder maintenant"
        subtitle="Anomalies, alertes, patterns detectes"
        icon={Sparkles}
        href="/insights"
        action="Voir tous"
      >
        {insights.isLoading && <SkeletonRows count={3} />}
        {!insights.isLoading && insights.data && insights.data.insights.length === 0 && (
          <EmptyMsg
            icon={CheckCircle2}
            color="text-data-positive"
            title="Tout va bien"
            description="Rien a signaler pour l'instant."
          />
        )}
        {!insights.isLoading && insights.data && insights.data.insights.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {insights.data.insights.slice(0, 4).map((ins, i) => (
              <InsightInline key={i} ins={ins} />
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── Grid 2 colonnes : details ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Col gauche */}
        <div className="space-y-4">
          {/* Prochains events */}
          <SectionCard
            title="Prochains evenements"
            subtitle="Aujourd'hui et a venir"
            icon={Calendar}
            href="/calendar"
            action="Calendrier"
          >
            {events.isLoading && <SkeletonRows count={3} />}
            {!events.isLoading && events.data && events.data.length === 0 && (
              <EmptyMsg icon={Calendar} title="Aucun evenement" description="Calendrier vide pour la suite." />
            )}
            {!events.isLoading && events.data && events.data.length > 0 && (
              <div className="space-y-1.5">
                {events.data.slice(0, 4).map((ev) => (
                  <EventRow key={ev.id} event={ev} />
                ))}
              </div>
            )}
          </SectionCard>

          {/* Dernieres transactions */}
          <SectionCard
            title="Dernieres transactions"
            subtitle="Compte courant"
            icon={Wallet}
            href="/finances"
            action="Finances"
          >
            {transactions.isLoading && <SkeletonRows count={4} />}
            {!transactions.isLoading && transactions.data && transactions.data.length > 0 && (
              <div className="space-y-1">
                {transactions.data.slice(0, 5).map((t) => (
                  <TransactionRow key={t.id} t={t} />
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Col droite */}
        <div className="space-y-4">
          {/* Photos recentes (grid 4x2) */}
          <SectionCard
            title="Photos recentes"
            subtitle={photoStats.data ? `${photoStats.data.total} photos au total` : ''}
            icon={ImageIcon}
            href="/photos"
            action="Galerie"
          >
            {photos.isLoading && (
              <div className="grid grid-cols-4 gap-1.5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="aspect-square bg-ink-800 rounded skeleton" />
                ))}
              </div>
            )}
            {!photos.isLoading && photos.data && (
              <div className="grid grid-cols-4 gap-1.5">
                {photos.data.slice(0, 8).map((p) => (
                  <PhotoThumb key={p.id} photo={p} />
                ))}
              </div>
            )}
          </SectionCard>

          {/* Sante 7j */}
          <SectionCard
            title="Sante 7 derniers jours"
            subtitle="Pas, sommeil, frequence cardiaque"
            icon={Heart}
            href="/health"
            action="Detail"
          >
            {healthSummary.isLoading && <SkeletonRows count={3} />}
            {!healthSummary.isLoading && healthSummary.data && (
              <HealthMini summary={healthSummary.data} />
            )}
          </SectionCard>

          {/* Top expediteurs emails */}
          {emailStats.data?.top_senders && emailStats.data.top_senders.length > 0 && (
            <SectionCard
              title="Top expediteurs"
              subtitle="Qui t'ecrit le plus"
              icon={Mail}
              href="/emails"
              action="Tous"
            >
              <div className="space-y-1">
                {emailStats.data.top_senders.slice(0, 5).map((s) => (
                  <SenderRow key={s.sender_email} s={s} />
                ))}
              </div>
            </SectionCard>
          )}
        </div>
      </div>

      {/* ── Bottom : raccourcis sources ─────────────────────── */}
      <SectionCard
        title="Sources de donnees"
        subtitle="Toutes les vues du hub"
        icon={MapPin}
      >
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-10 gap-2">
          {[
            { href: '/finances',  label: 'Finances',     icon: Wallet },
            { href: '/locations', label: 'Lieux',        icon: MapPin },
            { href: '/emails',    label: 'Emails',       icon: Mail },
            { href: '/photos',    label: 'Photos',       icon: ImageIcon },
            { href: '/calendar',  label: 'Calendrier',   icon: Calendar },
            { href: '/documents', label: 'Documents',    icon: ImageIcon },
            { href: '/health',    label: 'Sante',        icon: Heart },
            { href: '/contacts',  label: 'Contacts',     icon: Mail },
            { href: '/tasks',     label: 'Taches',       icon: CheckSquare },
            { href: '/youtube',   label: 'YouTube',      icon: ImageIcon },
          ].map((s) => {
            const Icon = s.icon
            return (
              <Link
                key={s.href}
                href={s.href}
                className="flex flex-col items-center gap-1 px-2 py-3 ga-card ga-card-hover text-ink-300 hover:text-ink-100 hover:border-accent/40 transition-colors"
              >
                <Icon size={16} className="text-ink-400" />
                <span className="text-[10px] font-mono">{s.label}</span>
              </Link>
            )
          })}
        </div>
      </SectionCard>
    </div>
  )
}

// ─── KPI tile ─────────────────────────────────────────────────────────────────

function KpiTile({
  href, label, value, subtitle, icon: Icon, loading, accent = 'normal',
}: {
  href: string
  label: string
  value: number | string
  subtitle?: string
  icon: LucideIcon
  loading?: boolean
  accent?: 'normal' | 'warn' | 'danger'
}) {
  const accentStyles = {
    normal: 'text-ink-100',
    warn:   'text-warn',
    danger: 'text-data-negative',
  }
  return (
    <Link
      href={href}
      className="ga-card ga-card-hover p-3 flex flex-col gap-1.5 group transition-colors"
    >
      <div className="flex items-center gap-1.5">
        <Icon size={11} className="text-ink-500 group-hover:text-accent transition-colors" />
        <span className="metric-label">{label}</span>
      </div>
      {loading ? (
        <div className="h-7 w-16 bg-ink-800 rounded skeleton" />
      ) : (
        <div className={cn('metric truncate', accentStyles[accent])}>{value}</div>
      )}
      {subtitle && (
        <div className="text-[10px] text-ink-500 font-mono truncate">{subtitle}</div>
      )}
    </Link>
  )
}

// ─── Section card wrapper ─────────────────────────────────────────────────────

function SectionCard({
  title, subtitle, icon: Icon, href, action, children,
}: {
  title: string
  subtitle?: string
  icon: LucideIcon
  href?: string
  action?: string
  children: React.ReactNode
}) {
  return (
    <section className="ga-card p-3.5">
      <header className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={13} className="text-accent shrink-0" />
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold text-ink-100 truncate">{title}</h3>
            {subtitle && <p className="text-[10px] text-ink-500 font-mono truncate">{subtitle}</p>}
          </div>
        </div>
        {href && action && (
          <Link
            href={href}
            className="text-[10px] font-mono uppercase tracking-wider text-ink-400 hover:text-accent transition-colors flex items-center gap-1 shrink-0"
          >
            {action}
            <ArrowRight size={10} />
          </Link>
        )}
      </header>
      {children}
    </section>
  )
}

// ─── Insight inline (compact) ─────────────────────────────────────────────────

function InsightInline({ ins }: { ins: InsightApi }) {
  const Icon = ICON_MAP[ins.icon] || Sparkles
  const styles = SEVERITY_STYLES[ins.severity]
  const card = (
    <div className={cn('p-2.5 rounded-md border flex items-start gap-2', styles.bg, styles.border)}>
      <div className={cn('w-7 h-7 rounded-md flex items-center justify-center shrink-0 border', styles.border, 'bg-ink-900/50')}>
        <Icon size={13} className={styles.text} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5">
          <h4 className="text-[12px] font-semibold text-ink-100 leading-snug truncate">{ins.title}</h4>
          {ins.delta && (
            <span className={cn('text-[10px] font-mono shrink-0', styles.text)}>{ins.delta}</span>
          )}
        </div>
        <p className="text-[11px] text-ink-300 leading-snug line-clamp-2 mt-0.5">{ins.description}</p>
      </div>
    </div>
  )
  if (ins.action_url) return <Link href={ins.action_url} className="block hover:opacity-90 transition-opacity">{card}</Link>
  return card
}

// ─── Event row ────────────────────────────────────────────────────────────────

function EventRow({ event }: { event: CalendarEvent }) {
  const start = new Date(event.start_at)
  const today = new Date()
  const isToday = start.toDateString() === today.toDateString()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const isTomorrow = start.toDateString() === tomorrow.toDateString()

  const dayLabel = isToday
    ? "Aujourd'hui"
    : isTomorrow
      ? 'Demain'
      : start.toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' })
  const timeLabel = event.all_day
    ? 'toute la journée'
    : start.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })

  return (
    <Link
      href="/calendar"
      className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-ink-800/50 transition-colors group"
    >
      <div className={cn(
        'w-9 text-center text-[10px] font-mono leading-tight shrink-0',
        isToday ? 'text-accent' : 'text-ink-500',
      )}>
        <div className="font-semibold">{dayLabel}</div>
        <div className="text-ink-600">{timeLabel}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] text-ink-100 truncate group-hover:text-accent transition-colors">
          {event.summary || '(sans titre)'}
        </div>
        {event.location && (
          <div className="text-[10px] text-ink-500 truncate flex items-center gap-1 mt-0.5">
            <MapPin size={9} className="shrink-0" />
            {event.location}
          </div>
        )}
      </div>
    </Link>
  )
}

// ─── Transaction row ──────────────────────────────────────────────────────────

function TransactionRow({ t }: { t: Transaction }) {
  const isCredit = t.credit !== null
  const amount = isCredit ? parseFloat(t.credit ?? '0') : -parseFloat(t.debit ?? '0')
  const date = new Date(t.transaction_date).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' })

  return (
    <Link
      href="/finances"
      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-ink-800/50 transition-colors group"
    >
      <div className="text-[10px] font-mono text-ink-500 w-12 shrink-0">{date}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] text-ink-200 truncate group-hover:text-ink-100">
          {t.description ?? '(sans description)'}
        </div>
      </div>
      <div className={cn(
        'text-[12px] font-mono font-semibold tabular-nums shrink-0',
        isCredit ? 'text-data-positive' : 'text-data-negative',
      )}>
        {isCredit ? '+' : ''}{formatCurrency(amount, 'CAD')}
      </div>
    </Link>
  )
}

// ─── Photo thumbnail ──────────────────────────────────────────────────────────

function PhotoThumb({ photo }: { photo: Photo }) {
  // Endpoint backend : /v1/photos/thumb/{media_id}?size=200
  // Si baseUrl Google a expire (>1h), retourne un SVG placeholder gris (200 OK).
  const thumbUrl = `/api/v1/photos/thumb/${encodeURIComponent(photo.media_id)}?size=200`
  return (
    <Link
      href={`/photos?id=${photo.id}`}
      className="aspect-square block relative rounded overflow-hidden bg-ink-800 group"
      title={photo.filename || 'Photo'}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumbUrl}
        alt={photo.filename || ''}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        loading="lazy"
      />
      {photo.is_video && (
        <div className="absolute top-1 right-1 bg-ink-950/70 rounded px-1 text-[8px] font-mono text-ink-100">
          VID
        </div>
      )}
    </Link>
  )
}

// ─── Sender row ───────────────────────────────────────────────────────────────

function SenderRow({ s }: { s: { sender_email: string; count: number; last_seen: string } }) {
  return (
    <Link
      href={`/emails?q=${encodeURIComponent(s.sender_email)}`}
      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-ink-800/50 transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <div className="text-[12px] text-ink-200 truncate group-hover:text-ink-100">{s.sender_email}</div>
        <div className="text-[10px] text-ink-500 font-mono">{formatRelative(s.last_seen)}</div>
      </div>
      <div className="text-[11px] font-mono font-semibold text-accent shrink-0">{s.count}</div>
    </Link>
  )
}

// ─── Health mini ──────────────────────────────────────────────────────────────

function HealthMini({ summary }: { summary: HealthSummary }) {
  const want = ['steps', 'sleep_total_min', 'heart_rate_resting']
  const labels: Record<string, { label: string; format: (v: number) => string; icon: LucideIcon }> = {
    steps:                { label: 'Pas/jour (7j)',     format: (v) => Math.round(v).toLocaleString('fr-CA'), icon: TrendingUp },
    sleep_total_min:      { label: 'Sommeil (7j)',      format: (v) => `${(v / 60).toFixed(1)} h`, icon: Heart },
    heart_rate_resting:   { label: 'Repos cardiaque',   format: (v) => `${Math.round(v)} bpm`, icon: Heart },
  }
  const rows = want
    .map((m) => summary.by_metric.find((r) => r.metric === m))
    .filter((r): r is MetricSummaryRow => Boolean(r))

  if (rows.length === 0) {
    return <EmptyMsg icon={Heart} title="Pas de donnees" description="Synchronise Garmin/Fit pour voir tes metrics." />
  }

  return (
    <div className="space-y-1.5">
      {rows.map((r) => {
        const meta = labels[r.metric]
        const Icon = meta.icon
        const v = r.avg_7d ?? r.last_value
        const prev = r.avg_prev_7d
        const delta = prev != null && prev !== 0 ? ((v - prev) / prev) * 100 : null
        const trendUp = delta != null && delta > 0
        return (
          <div key={r.metric} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-ink-800/50">
            <Icon size={12} className="text-ink-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-ink-300 truncate">{meta.label}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="text-[12px] font-mono font-semibold text-ink-100">{meta.format(v)}</div>
              {delta != null && (
                <div className={cn(
                  'text-[10px] font-mono flex items-center gap-0.5',
                  trendUp ? 'text-data-positive' : 'text-data-negative',
                )}>
                  {trendUp ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                  {Math.abs(delta).toFixed(0)}%
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Helpers UI ──────────────────────────────────────────────────────────────

function SkeletonRows({ count }: { count: number }) {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-7 bg-ink-800 rounded skeleton" />
      ))}
    </div>
  )
}

function EmptyMsg({
  icon: Icon, color = 'text-ink-500', title, description,
}: {
  icon: LucideIcon
  color?: string
  title: string
  description: string
}) {
  return (
    <div className="text-center py-4 px-2">
      <Icon size={20} className={cn('mx-auto mb-2', color)} />
      <div className="text-[12px] font-semibold text-ink-100 mb-0.5">{title}</div>
      <div className="text-[10px] text-ink-500">{description}</div>
    </div>
  )
}

// Recharts unused for now but ready for sparklines
export function _Sparkline({ data, color = '#5cdb95' }: { data: Array<{ v: number }>; color?: string }) {
  return (
    <ResponsiveContainer width="100%" height={28}>
      <LineChart data={data}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
        <Tooltip />
      </LineChart>
    </ResponsiveContainer>
  )
}
