'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart, DonutChart } from '@tremor/react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Box,
  CalendarDays,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  Download,
  FileText,
  Image,
  LayoutGrid,
  List,
  MapPin,
  MapPinned,
  MessageSquare,
  Package,
  Paperclip,
  Phone,
  PhoneCall,
  PhoneForwarded,
  PhoneMissed,
  Search,
  ShoppingCart,
  Truck,
  Users,
  Zap,
} from 'lucide-react';
import { DEMO_MODE } from '@/lib/demo-mode';
import { getDemoWholesaleCRM } from '@/lib/demo-data';
import { formatCompact } from '@/components/ui';

interface WholesaleClient {
  id: number;
  nombre: string;
  contacto: string;
  telefono: string;
  email: string;
  ciudad: string;
  rut: string;
  zone: string;
  discount: string;
  tags: string[];
  transporte: string;
  condicion_pago: string;
  credit_limit: number;
  outstanding: number;
  last_purchase_date: string;
  last_purchase_amount: number;
  last_call_date: string;
  total_ytd: number;
  orders_ytd: number;
  avg_order: number;
  notes: string;
  priority: 'high' | 'medium' | 'low';
}

interface PipelineItem {
  id: string;
  client_id: number;
  client_name: string;
  date: string;
  items: string;
  total: number;
  vendedor: string;
  issue?: string;
}

interface CallLog {
  id: number;
  client_id: number;
  client_name: string;
  date: string;
  time: string;
  duration: string;
  outcome: string;
  notes: string;
  amount: number | null;
}

interface ZoneSummary {
  zone: string;
  clients: number;
  revenue: number;
  outstanding: number;
}

interface ClientFile {
  name: string;
  type: string;
  size: string;
  date: string;
}

interface CalendarEvent {
  id: string;
  client_id: number;
  client_name: string;
  date: string;
  time: string;
  type: 'call' | 'visit';
  note: string;
}

type TabKey = 'overview' | 'clients' | 'followup' | 'pipeline' | 'calendar' | 'claims';
type ClientView = 'list' | 'board';
type SortKey = 'urgency' | 'outstanding' | 'ytd';
type PortfolioFilter = 'ALL' | 'KEY' | 'CREDIT' | 'NEW' | 'COLD' | 'AT_RISK';

const OUTCOME_CONFIG: Record<string, { label: string; tone: string; icon: JSX.Element }> = {
  ORDER: { label: 'Order', tone: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle className="w-3.5 h-3.5" /> },
  QUOTE: { label: 'Quote', tone: 'bg-blue-100 text-blue-700', icon: <MessageSquare className="w-3.5 h-3.5" /> },
  FOLLOW_UP: { label: 'Follow-up', tone: 'bg-amber-100 text-amber-700', icon: <Clock className="w-3.5 h-3.5" /> },
  NO_ANSWER: { label: 'No answer', tone: 'bg-red-100 text-red-700', icon: <PhoneMissed className="w-3.5 h-3.5" /> },
};

const ZONE_CONFIG: Record<string, { bg: string; text: string }> = {
  'ZONA NORTE': { bg: 'bg-orange-100', text: 'text-orange-700' },
  'ZONA CENTRO': { bg: 'bg-lime-100', text: 'text-lime-700' },
  'ZONA SUR': { bg: 'bg-blue-100', text: 'text-blue-700' },
};

const PIPELINE_STAGES = [
  { key: 'new_order', label: 'New order', icon: <ShoppingCart className="w-4 h-4" />, accent: 'from-sky-500 to-indigo-600', bg: 'bg-sky-50', border: 'border-sky-200' },
  { key: 'preparing', label: 'Preparing', icon: <Box className="w-4 h-4" />, accent: 'from-amber-500 to-yellow-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  { key: 'ready_to_ship', label: 'Ready to ship', icon: <Package className="w-4 h-4" />, accent: 'from-violet-500 to-purple-600', bg: 'bg-violet-50', border: 'border-violet-200' },
  { key: 'in_transit', label: 'In transit to customer', icon: <Truck className="w-4 h-4" />, accent: 'from-cyan-500 to-teal-600', bg: 'bg-cyan-50', border: 'border-cyan-200' },
  { key: 'delivered', label: 'Delivery confirmed', icon: <CheckCircle className="w-4 h-4" />, accent: 'from-emerald-500 to-green-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { key: 'complaint', label: 'Complaint', icon: <AlertTriangle className="w-4 h-4" />, accent: 'from-red-500 to-rose-600', bg: 'bg-red-50', border: 'border-red-200' },
] as const;

function daysSince(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function daysUntil(dateStr: string): number {
  return Math.max(0, -daysSince(dateStr));
}

function shortName(name: string) {
  return name.length > 18 ? `${name.slice(0, 16)}…` : name;
}

function formatShortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getUrgencyTone(days: number) {
  if (days >= 15) return 'bg-red-50 border-red-200';
  if (days >= 8) return 'bg-amber-50 border-amber-200';
  return 'bg-emerald-50 border-emerald-200';
}

function getPortfolioStatus(client: WholesaleClient, calledToday: boolean, hasComplaint: boolean, upcomingEvent?: CalendarEvent | null) {
  const debtRatio = client.credit_limit > 0 ? client.outstanding / client.credit_limit : 0;
  const contactGap = calledToday ? 0 : daysSince(client.last_call_date);
  const purchaseGap = daysSince(client.last_purchase_date);

  if (hasComplaint) {
    return {
      label: 'Open complaint',
      tone: 'bg-red-100 text-red-700',
      action: 'Resolve complaint',
      actionTone: 'text-red-700',
    };
  }

  if (debtRatio >= 0.6) {
    return {
      label: 'Critical collections',
      tone: 'bg-rose-100 text-rose-700',
      action: 'Review credit',
      actionTone: 'text-rose-700',
    };
  }

  if (upcomingEvent) {
    return {
      label: upcomingEvent.type === 'visit' ? 'Visit scheduled' : 'Follow-up scheduled',
      tone: 'bg-purple-100 text-purple-700',
      action: `${upcomingEvent.type === 'visit' ? 'Visit' : 'Call'} in ${daysUntil(upcomingEvent.date)}d`,
      actionTone: 'text-purple-700',
    };
  }

  if (contactGap >= 14 || client.tags.includes('NO_ANSWER')) {
    return {
      label: 'Commercial risk',
      tone: 'bg-red-100 text-red-700',
      action: 'Call today',
      actionTone: 'text-red-700',
    };
  }

  if (purchaseGap >= 25) {
    return {
      label: 'Cold account',
      tone: 'bg-amber-100 text-amber-700',
      action: 'Reactivate',
      actionTone: 'text-amber-700',
    };
  }

  if (client.tags.includes('NEW')) {
    return {
      label: 'New customer',
      tone: 'bg-sky-100 text-sky-700',
      action: 'Quote and activate',
      actionTone: 'text-sky-700',
    };
  }

  return {
    label: 'Healthy account',
    tone: 'bg-emerald-100 text-emerald-700',
    action: client.priority === 'high' ? 'Upsell' : 'Maintain',
    actionTone: 'text-emerald-700',
  };
}

export default function WholesalePage() {
  const [clients, setClients] = useState<WholesaleClient[]>([]);
  const [callLog, setCallLog] = useState<CallLog[]>([]);
  const [pipeline, setPipeline] = useState<Record<string, PipelineItem[]>>({});
  const [zoneSummary, setZoneSummary] = useState<ZoneSummary[]>([]);
  const [clientFiles, setClientFiles] = useState<Record<number, ClientFile[]>>({});
  const [calendar, setCalendar] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('urgency');
  const [expandedClient, setExpandedClient] = useState<number | null>(null);
  const [calledToday, setCalledToday] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [zoneFilter, setZoneFilter] = useState<string>('ALL');
  const [clientView, setClientView] = useState<ClientView>('list');
  const [portfolioFilter, setPortfolioFilter] = useState<PortfolioFilter>('ALL');

  useEffect(() => {
    if (DEMO_MODE) {
      const mock = getDemoWholesaleCRM();
      setClients(mock.clients as WholesaleClient[]);
      setCallLog(mock.callLog as CallLog[]);
      setPipeline(mock.pipeline as Record<string, PipelineItem[]>);
      setZoneSummary(mock.zoneSummary as ZoneSummary[]);
      setClientFiles(mock.clientFiles as Record<number, ClientFile[]>);
      setCalendar(mock.calendar as CalendarEvent[]);
      setLoading(false);
    }
  }, []);

  const markAsCalled = (clientId: number) => {
    setCalledToday((prev) => {
      const next = new Set(prev);
      next.add(clientId);
      return next;
    });
  };

  const allPipelineItems = useMemo(() => Object.values(pipeline).flat(), [pipeline]);
  const complaintItems = useMemo(() => pipeline.complaint || [], [pipeline]);
  const complaintIds = useMemo(() => new Set(complaintItems.map((item) => item.client_id)), [complaintItems]);

  const upcomingEvents = useMemo(
    () =>
      [...calendar]
        .filter((event) => daysSince(event.date) <= 0 && daysUntil(event.date) <= 10)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.time.localeCompare(b.time)),
    [calendar],
  );

  const todayEvents = useMemo(() => upcomingEvents.filter((event) => daysSince(event.date) === 0), [upcomingEvents]);

  const eventByClient = useMemo(() => {
    const map = new Map<number, CalendarEvent>();
    upcomingEvents.forEach((event) => {
      if (!map.has(event.client_id)) map.set(event.client_id, event);
    });
    return map;
  }, [upcomingEvents]);

  const latestCallByClient = useMemo(() => {
    const map = new Map<number, CallLog>();
    callLog.forEach((log) => {
      if (!map.has(log.client_id)) map.set(log.client_id, log);
    });
    return map;
  }, [callLog]);

  const contactStageCount = useMemo(() => {
    const ids = new Set<number>();
    callLog
      .filter((log) => log.outcome === 'QUOTE' || log.outcome === 'FOLLOW_UP' || log.outcome === 'NO_ANSWER')
      .forEach((log) => ids.add(log.client_id));
    upcomingEvents.forEach((event) => ids.add(event.client_id));
    return ids.size;
  }, [callLog, upcomingEvents]);

  const filteredClients = useMemo(() => {
    return [...clients]
      .filter((client) => zoneFilter === 'ALL' || client.zone === zoneFilter)
      .filter((client) => {
        if (!search) return true;
        const query = search.toLowerCase();
        return (
          client.nombre.toLowerCase().includes(query) ||
          client.contacto.toLowerCase().includes(query) ||
          client.ciudad.toLowerCase().includes(query)
        );
      })
      .filter((client) => {
        if (portfolioFilter === 'ALL') return true;
        if (portfolioFilter === 'KEY') return client.priority === 'high';
        if (portfolioFilter === 'CREDIT') return client.tags.includes('CREDIT') || client.outstanding > 0;
        if (portfolioFilter === 'NEW') return client.tags.includes('NEW');
        if (portfolioFilter === 'COLD') return daysSince(client.last_purchase_date) >= 25;
        return complaintIds.has(client.id) || daysSince(client.last_call_date) >= 14 || client.outstanding > client.credit_limit * 0.5;
      })
      .sort((a, b) => {
        if (sortBy === 'urgency') {
          const urgencyA = calledToday.has(a.id) ? -999 : daysSince(a.last_call_date);
          const urgencyB = calledToday.has(b.id) ? -999 : daysSince(b.last_call_date);
          return urgencyB - urgencyA;
        }
        if (sortBy === 'outstanding') return b.outstanding - a.outstanding;
        return b.total_ytd - a.total_ytd;
      });
  }, [calledToday, clients, complaintIds, portfolioFilter, search, sortBy, zoneFilter]);

  const followupColumns = useMemo(() => {
    const columns = {
      call_today: [] as WholesaleClient[],
      scheduled: [] as WholesaleClient[],
      reactivate: [] as WholesaleClient[],
      risk: [] as WholesaleClient[],
    };

    filteredClients.forEach((client) => {
      const contactGap = calledToday.has(client.id) ? 0 : daysSince(client.last_call_date);
      const purchaseGap = daysSince(client.last_purchase_date);
      const upcomingEvent = eventByClient.get(client.id);
      const lastCall = latestCallByClient.get(client.id);
      const hasComplaint = complaintIds.has(client.id);

      if (hasComplaint || client.outstanding > client.credit_limit * 0.5) {
        columns.risk.push(client);
      } else if (upcomingEvent || lastCall?.outcome === 'QUOTE') {
        columns.scheduled.push(client);
      } else if (contactGap >= 14 || lastCall?.outcome === 'NO_ANSWER') {
        columns.call_today.push(client);
      } else if (purchaseGap >= 25 || client.tags.includes('NEW')) {
        columns.reactivate.push(client);
      }
    });

    return columns;
  }, [calledToday, complaintIds, eventByClient, filteredClients, latestCallByClient]);

  const totalOutstanding = clients.reduce((sum, client) => sum + client.outstanding, 0);
  const totalYTD = clients.reduce((sum, client) => sum + client.total_ytd, 0);
  const calledTodayCount = calledToday.size;
  const pipelineValue = allPipelineItems.reduce((sum, item) => sum + item.total, 0);
  const activeOrders = allPipelineItems.length - complaintItems.length;
  const clientsNeedingCall = clients.filter((client) => daysSince(client.last_call_date) >= 8 && !calledToday.has(client.id)).length;
  const visitCount = upcomingEvents.filter((event) => event.type === 'visit').length;
  const topRevenue = [...clients].sort((a, b) => b.total_ytd - a.total_ytd)[0];
  const mostOverdue = [...clients].sort((a, b) => daysSince(b.last_call_date) - daysSince(a.last_call_date))[0];
  const biggestDebtor = [...clients].filter((client) => client.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding)[0];

  const contactGapData = [...filteredClients]
    .sort((a, b) => (calledToday.has(b.id) ? 0 : daysSince(b.last_call_date)) - (calledToday.has(a.id) ? 0 : daysSince(a.last_call_date)))
    .slice(0, 8)
    .map((client) => ({
      client: shortName(client.nombre),
      'Days without contact': calledToday.has(client.id) ? 0 : daysSince(client.last_call_date),
    }));

  const revenueData = [...filteredClients]
    .sort((a, b) => b.total_ytd - a.total_ytd)
    .slice(0, 8)
    .map((client) => ({
      client: shortName(client.nombre),
      'Revenue YTD': client.total_ytd,
    }));

  const zoneDonutData = zoneSummary.map((zone) => ({ name: zone.zone.replace('ZONA ', ''), value: zone.revenue }));

  const debtData = [...filteredClients]
    .filter((client) => client.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, 8)
    .map((client) => ({
      client: shortName(client.nombre),
      Outstanding: client.outstanding,
    }));

  if (loading) {
    return (
      <div className="p-6 min-h-screen flex items-center justify-center">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-orange-200 rounded-full animate-spin border-t-orange-500" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Phone className="w-8 h-8 text-orange-500" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-slate-900/50">
      <div className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="px-4 sm:px-6 py-4 space-y-4">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                <Zap className="w-3.5 h-3.5" />
                HubSpot + Trello blend: operate like Trello, understand like CRM
              </div>
              <nav className="flex flex-wrap rounded-xl border border-slate-200 dark:border-slate-700 p-1 bg-slate-50 dark:bg-slate-800/50">
                {([
                  ['overview', 'Control center'],
                  ['clients', 'Clients'],
                  ['followup', 'Follow-up'],
                  ['pipeline', 'Pipeline'],
                  ['calendar', 'Calendar'],
                  ['claims', 'Claims'],
                ] as [TabKey, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeTab === key
                        ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-sm border border-slate-200 dark:border-slate-600'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search client, contact, or city..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 outline-none w-full sm:w-72"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {['ALL', 'ZONA NORTE', 'ZONA CENTRO', 'ZONA SUR'].map((zone) => (
                  <button
                    key={zone}
                    onClick={() => setZoneFilter(zone)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      zoneFilter === zone
                        ? 'bg-orange-500 text-white'
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {zone === 'ALL' ? 'All' : zone.replace('ZONA ', '')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {[
              { label: 'Clients', value: clients.length, sub: 'active base', icon: <Users className="w-4 h-4" /> },
              { label: 'Calls today', value: `${calledTodayCount}/${clients.length}`, sub: `${clientsNeedingCall} pending`, icon: <PhoneCall className="w-4 h-4" /> },
              { label: 'Follow-ups', value: upcomingEvents.length, sub: `${visitCount} visits`, icon: <CalendarDays className="w-4 h-4" /> },
              { label: 'Active orders', value: activeOrders, sub: formatCompact(pipelineValue), icon: <Package className="w-4 h-4" /> },
              { label: 'Outstanding', value: formatCompact(totalOutstanding), sub: 'collections', icon: <DollarSign className="w-4 h-4" /> },
              { label: 'Claims', value: complaintItems.length, sub: complaintItems.length > 0 ? 'open' : 'no cases', icon: <AlertTriangle className="w-4 h-4" /> },
            ].map((kpi) => (
              <div key={kpi.label} className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400">
                  {kpi.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">{kpi.label}</p>
                  <p className="text-base font-bold text-slate-900 dark:text-white truncate">{kpi.value}</p>
                  <p className="text-[10px] text-slate-400">{kpi.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {activeTab === 'overview' && (
          <>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-orange-300 font-semibold">Operating system</p>
                  <h2 className="text-xl font-bold mt-1">This CRM now reflects the company&apos;s real operating logic</h2>
                  <p className="text-sm text-slate-300 mt-2 max-w-3xl">
                    We separated the client base, the visit and follow-up record, and the order pipeline.
                    Trello gives the workflow; the dashboard adds priority, context, and analytics.
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div className="rounded-xl bg-white/10 p-3 border border-white/10">
                    <p className="text-slate-300">Clients</p>
                    <p className="text-lg font-bold">{clients.length}</p>
                  </div>
                  <div className="rounded-xl bg-white/10 p-3 border border-white/10">
                    <p className="text-slate-300">Visit log</p>
                    <p className="text-lg font-bold">{contactStageCount}</p>
                  </div>
                  <div className="rounded-xl bg-white/10 p-3 border border-white/10">
                    <p className="text-slate-300">New order</p>
                    <p className="text-lg font-bold">{(pipeline.new_order || []).length}</p>
                  </div>
                  <div className="rounded-xl bg-white/10 p-3 border border-white/10">
                    <p className="text-slate-300">Claims</p>
                    <p className="text-lg font-bold">{complaintItems.length}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
              {[
                { label: 'Client base', value: clients.length, help: 'Equivalent to the CLIENTES list in Trello.', icon: <Users className="w-4 h-4" />, tone: 'bg-slate-900 text-white border-slate-900' },
                { label: 'Visit log', value: contactStageCount, help: 'Clients in contact, visit, or follow-up.', icon: <PhoneForwarded className="w-4 h-4" />, tone: 'bg-blue-50 text-blue-700 border-blue-200' },
                { label: 'Active pipeline', value: activeOrders, help: 'Orders between new order and delivery.', icon: <Package className="w-4 h-4" />, tone: 'bg-violet-50 text-violet-700 border-violet-200' },
                { label: 'Exceptions', value: complaintItems.length + clients.filter((client) => client.outstanding > 0).length, help: 'Claims and accounts with debt to monitor.', icon: <AlertTriangle className="w-4 h-4" />, tone: 'bg-red-50 text-red-700 border-red-200' },
              ].map((card) => (
                <div key={card.label} className={`rounded-2xl border p-4 ${card.tone}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{card.label}</p>
                    {card.icon}
                  </div>
                  <p className="text-3xl font-black mt-4">{card.value}</p>
                  <p className="text-xs mt-2 opacity-80">{card.help}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Phone className="w-5 h-5 text-red-500" />
                  <h3 className="font-bold text-slate-800 dark:text-white">Contact gap</h3>
                </div>
                <p className="text-xs text-slate-400 mb-4">Shows who needs attention before commercial momentum is lost.</p>
                <BarChart
                  data={contactGapData}
                  index="client"
                  categories={['Days without contact']}
                  colors={['rose']}
                  layout="vertical"
                  className="h-80"
                  showLegend={false}
                  yAxisWidth={120}
                  valueFormatter={(value) => `${value}d`}
                />
                {mostOverdue && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <span className="font-bold">Action:</span> {mostOverdue.nombre} has gone {daysSince(mostOverdue.last_call_date)} days without contact.
                    {mostOverdue.outstanding > 0 ? ` Owes ${formatCompact(mostOverdue.outstanding)}.` : ''} This account should be worked today.
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="w-5 h-5 text-indigo-500" />
                  <h3 className="font-bold text-slate-800 dark:text-white">Revenue by client</h3>
                </div>
                <p className="text-xs text-slate-400 mb-4">Protect key relationships and detect commercial concentration.</p>
                <BarChart
                  data={revenueData}
                  index="client"
                  categories={['Revenue YTD']}
                  colors={['indigo']}
                  layout="vertical"
                  className="h-80"
                  showLegend={false}
                  yAxisWidth={120}
                  valueFormatter={(value) => formatCompact(value)}
                />
                {topRevenue && (
                  <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-700">
                    <span className="font-bold">Insight:</span> {topRevenue.nombre} represents {Math.round((topRevenue.total_ytd / totalYTD) * 100)}% of YTD revenue.
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="w-5 h-5 text-emerald-500" />
                  <h3 className="font-bold text-slate-800 dark:text-white">Revenue by zone</h3>
                </div>
                <p className="text-xs text-slate-400 mb-4">The portfolio is highly concentrated in a few zones.</p>
                <DonutChart
                  data={zoneDonutData}
                  category="value"
                  index="name"
                  colors={['orange', 'lime', 'blue']}
                  className="h-56"
                  showLabel
                  valueFormatter={(value) => formatCompact(value)}
                />
                <div className="mt-4 space-y-2">
                  {zoneSummary.map((zone) => {
                    const tone = ZONE_CONFIG[zone.zone] || ZONE_CONFIG['ZONA CENTRO'];
                    return (
                      <div key={zone.zone} className="flex items-center justify-between text-sm">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${tone.bg} ${tone.text}`}>{zone.zone}</span>
                        <span className="text-slate-600 dark:text-slate-400">{zone.clients} clients · {formatCompact(zone.revenue)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="xl:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-5 h-5 text-red-500" />
                  <h3 className="font-bold text-slate-800 dark:text-white">Accounts receivable</h3>
                </div>
                <p className="text-xs text-slate-400 mb-4">Collections are part of the CRM, not a disconnected view.</p>
                {debtData.length > 0 ? (
                  <>
                    <BarChart
                      data={debtData}
                      index="client"
                      categories={['Outstanding']}
                      colors={['red']}
                      className="h-64"
                      showLegend={false}
                      valueFormatter={(value) => formatCompact(value)}
                    />
                    {biggestDebtor && (
                      <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        <span className="font-bold">Prioridad:</span> {biggestDebtor.nombre} debe {formatCompact(biggestDebtor.outstanding)}.
                        Eso equivale al {Math.round((biggestDebtor.outstanding / biggestDebtor.credit_limit) * 100)}% de su cupo.
                      </div>
                    )}
                  </>
                ) : (
                  <div className="h-64 flex items-center justify-center text-emerald-700">
                    <CheckCircle className="w-10 h-10 mr-2 text-emerald-500" />
                    No outstanding debt.
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="w-5 h-5 text-orange-500" />
                  <h3 className="font-bold text-slate-800 dark:text-white">Today&apos;s playbook</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredClients
                    .filter((client) => !calledToday.has(client.id))
                    .slice(0, 6)
                    .map((client) => {
                      const status = getPortfolioStatus(client, calledToday.has(client.id), complaintIds.has(client.id), eventByClient.get(client.id));
                      const tone = getUrgencyTone(daysSince(client.last_call_date));
                      return (
                        <div key={client.id} className={`rounded-xl border p-4 ${tone}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-bold text-slate-900">{client.nombre}</p>
                              <p className="text-xs text-slate-500">{client.contacto} · {client.ciudad}</p>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${status.tone}`}>{status.label}</span>
                          </div>
                          <div className="mt-3 flex items-center justify-between text-sm">
                            <span className="text-slate-600">Ult. contacto: {calledToday.has(client.id) ? 'hoy' : `${daysSince(client.last_call_date)}d`}</span>
                            <span className={`font-semibold ${status.actionTone}`}>{status.action}</span>
                          </div>
                          <div className="mt-3 flex items-center justify-between">
                            <span className="text-xs text-slate-500">{client.outstanding > 0 ? `Debe ${formatCompact(client.outstanding)}` : `YTD ${formatCompact(client.total_ytd)}`}</span>
                            <button
                              onClick={() => markAsCalled(client.id)}
                              className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-600"
                            >
                              <PhoneCall className="w-3 h-3" />
                              Marcar llamada
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-slate-500" />
                  <h3 className="font-bold text-slate-800 dark:text-white">Latest interactions</h3>
                </div>
                <div className="space-y-3">
                  {callLog.slice(0, 7).map((log) => {
                    const outcome = OUTCOME_CONFIG[log.outcome] || OUTCOME_CONFIG.FOLLOW_UP;
                    return (
                      <div key={log.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-900/40">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-slate-800 dark:text-white text-sm truncate">{log.client_name}</p>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${outcome.tone}`}>
                            {outcome.icon}
                            {outcome.label}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{log.notes}</p>
                        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                          <span>{formatShortDate(log.date)} · {log.time}</span>
                          <span>{log.amount ? formatCompact(log.amount) : log.duration}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'clients' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {([
                  ['ALL', 'All'],
                  ['KEY', 'Key accounts'],
                  ['CREDIT', 'Credit'],
                  ['NEW', 'New'],
                  ['COLD', 'Cold'],
                  ['AT_RISK', 'At risk'],
                ] as [PortfolioFilter, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setPortfolioFilter(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      portfolioFilter === key
                        ? 'bg-slate-900 text-white dark:bg-slate-700'
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                {([
                  ['urgency', 'Urgency'],
                  ['outstanding', 'Outstanding'],
                  ['ytd', 'Revenue'],
                ] as [SortKey, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setSortBy(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      sortBy === key
                        ? 'bg-orange-500 text-white'
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <button
                    onClick={() => setClientView('list')}
                    className={`p-2 ${clientView === 'list' ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-600' : 'bg-white dark:bg-slate-800 text-slate-400'}`}
                    title="Vista lista"
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setClientView('board')}
                    className={`p-2 ${clientView === 'board' ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-600' : 'bg-white dark:bg-slate-800 text-slate-400'}`}
                    title="Vista cards"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {clientView === 'list' && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left px-4 py-3 font-semibold text-slate-500">Cliente</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-500">Estado</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-500">Zona</th>
                        <th className="text-right px-4 py-3 font-semibold text-slate-500">Revenue</th>
                        <th className="text-right px-4 py-3 font-semibold text-slate-500">Outstanding</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-500">Next action</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClients.map((client) => {
                        const status = getPortfolioStatus(client, calledToday.has(client.id), complaintIds.has(client.id), eventByClient.get(client.id));
                        const zoneTone = ZONE_CONFIG[client.zone] || ZONE_CONFIG['ZONA CENTRO'];
                        return (
                          <tr key={client.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-900/30">
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-semibold text-slate-900 dark:text-white">{client.nombre}</p>
                                <p className="text-xs text-slate-500">{client.contacto} · {client.ciudad}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${status.tone}`}>{status.label}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${zoneTone.bg} ${zoneTone.text}`}>{client.zone.replace('ZONA ', '')}</span>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">{formatCompact(client.total_ytd)}</td>
                            <td className="px-4 py-3 text-right">
                              <span className={client.outstanding > 0 ? 'font-semibold text-red-600' : 'text-slate-400'}>
                                {client.outstanding > 0 ? formatCompact(client.outstanding) : '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{status.action}</td>
                            <td className="px-4 py-3 text-right">
                              {!calledToday.has(client.id) && (
                                <button
                                  onClick={() => markAsCalled(client.id)}
                                  className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-600"
                                >
                                  <PhoneCall className="w-3 h-3" />
                                  Called
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {filteredClients.length === 0 && (
                  <div className="py-12 text-center text-slate-500">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    No clients match those filters.
                  </div>
                )}
              </div>
            )}

            {clientView === 'board' && (
              <div className="space-y-3">
                {filteredClients.map((client) => {
                  const daysWithoutCall = calledToday.has(client.id) ? 0 : daysSince(client.last_call_date);
                  const purchaseGap = daysSince(client.last_purchase_date);
                  const isExpanded = expandedClient === client.id;
                  const zoneTone = ZONE_CONFIG[client.zone] || ZONE_CONFIG['ZONA CENTRO'];
                  const status = getPortfolioStatus(client, calledToday.has(client.id), complaintIds.has(client.id), eventByClient.get(client.id));

                  return (
                    <div key={client.id} className={`rounded-2xl border overflow-hidden ${getUrgencyTone(daysWithoutCall)}`}>
                      <div
                        className="flex items-center justify-between gap-4 p-4 cursor-pointer hover:bg-white/70 dark:hover:bg-slate-800/30"
                        onClick={() => setExpandedClient(isExpanded ? null : client.id)}
                      >
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-white ${calledToday.has(client.id) ? 'bg-emerald-500' : daysWithoutCall >= 15 ? 'bg-red-500' : daysWithoutCall >= 8 ? 'bg-amber-500' : 'bg-emerald-500'}`}>
                            {calledToday.has(client.id) ? <CheckCircle className="w-5 h-5" /> : `${daysWithoutCall}d`}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-bold text-slate-900 dark:text-white truncate">{client.nombre}</h3>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${zoneTone.bg} ${zoneTone.text}`}>{client.zone.replace('ZONA ', '')}</span>
                              {client.priority === 'high' && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-700">KEY</span>}
                              {client.discount !== 'NONE' && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-100 text-sky-700">{client.discount}</span>}
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${status.tone}`}>{status.label}</span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{client.contacto} · {client.ciudad} · {client.telefono}</p>
                          </div>
                          <div className="hidden md:grid grid-cols-3 gap-6 text-center">
                            <div>
                              <p className="text-[10px] text-slate-500">Revenue</p>
                              <p className="font-bold text-slate-900 dark:text-white">{formatCompact(client.total_ytd)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-500">Outstanding</p>
                              <p className={`font-bold ${client.outstanding > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{client.outstanding > 0 ? formatCompact(client.outstanding) : '—'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-500">Ult. compra</p>
                              <p className={`font-bold ${purchaseGap >= 25 ? 'text-amber-600' : 'text-slate-900 dark:text-white'}`}>{purchaseGap}d</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!calledToday.has(client.id) && (
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                markAsCalled(client.id);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-600"
                            >
                              <PhoneCall className="w-3 h-3" />
                              Llamado
                            </button>
                          )}
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/20 px-4 pb-4">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4">
                            <div className="space-y-2">
                              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Account</h4>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2">
                                  <p className="text-[9px] text-slate-500">RUT</p>
                                  <p className="text-xs font-bold">{client.rut}</p>
                                </div>
                                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2">
                                  <p className="text-[9px] text-slate-500">Cupo</p>
                                  <p className="text-xs font-bold">{formatCompact(client.credit_limit)}</p>
                                </div>
                                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2">
                                  <p className="text-[9px] text-slate-500">Pedidos YTD</p>
                                  <p className="text-xs font-bold">{client.orders_ytd}</p>
                                </div>
                                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2">
                                  <p className="text-[9px] text-slate-500">Ticket prom.</p>
                                  <p className="text-xs font-bold">{formatCompact(client.avg_order)}</p>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Contacto</h4>
                              <a href={`tel:${client.telefono}`} className="flex items-center gap-2 rounded-lg bg-indigo-50 p-2 text-xs font-medium text-indigo-700 hover:bg-indigo-100">
                                <Phone className="w-3.5 h-3.5" />
                                {client.telefono}
                              </a>
                              <a href={`mailto:${client.email}`} className="flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2 text-xs text-slate-700 dark:text-slate-300">
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span className="truncate">{client.email}</span>
                              </a>
                              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2 text-xs text-slate-600 dark:text-slate-400">
                                Last contact: {formatShortDate(client.last_call_date)}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Operacion</h4>
                              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2">
                                <p className="text-[9px] text-slate-500">Transporte</p>
                                <p className="text-xs font-bold">{client.transporte}</p>
                              </div>
                              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2">
                                <p className="text-[9px] text-slate-500">Payment terms</p>
                                <p className="text-xs font-bold">{client.condicion_pago}</p>
                              </div>
                              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2">
                                <p className="text-[9px] text-slate-500">Last purchase</p>
                                <p className="text-xs font-bold">{formatShortDate(client.last_purchase_date)} · {formatCompact(client.last_purchase_amount)}</p>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Notas y archivos</h4>
                              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-2.5 text-xs text-slate-700">
                                {client.notes}
                              </div>
                              <div className="space-y-1">
                                {(clientFiles[client.id] || []).slice(0, 3).map((file, index) => (
                                  <div key={index} className="flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2">
                                    {file.type === 'pdf' ? <FileText className="w-3.5 h-3.5 text-red-500" /> : <Image className="w-3.5 h-3.5 text-blue-500" />}
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-[11px] font-medium text-slate-700 dark:text-slate-300">{file.name}</p>
                                      <p className="text-[9px] text-slate-400">{file.size} · {formatShortDate(file.date)}</p>
                                    </div>
                                    <Download className="w-3.5 h-3.5 text-slate-400" />
                                  </div>
                                ))}
                              </div>
                              <button className="w-full inline-flex items-center justify-center gap-1 rounded-lg bg-indigo-50 px-3 py-2 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100">
                                <Paperclip className="w-3.5 h-3.5" />
                                Attach file
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'followup' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                This view replaces Trello&apos;s mix of <span className="font-semibold">REGISTRO VISITA CLIENTE</span> and scattered notes.
                All pre-order commercial work now lives here.
              </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
              {[
                { key: 'call_today', label: 'Call today', help: 'Clients with no recent contact or no answer', icon: <Phone className="w-4 h-4" />, tone: 'bg-red-50 border-red-200' },
                { key: 'scheduled', label: 'Scheduled', help: 'Visits, quotes, and follow-ups', icon: <CalendarDays className="w-4 h-4" />, tone: 'bg-purple-50 border-purple-200' },
                { key: 'reactivate', label: 'Reactivate', help: 'Cold or newly activated clients', icon: <ArrowRight className="w-4 h-4" />, tone: 'bg-amber-50 border-amber-200' },
                { key: 'risk', label: 'Collections / risk', help: 'High debt or open complaint', icon: <AlertTriangle className="w-4 h-4" />, tone: 'bg-rose-50 border-rose-200' },
              ].map((column) => {
                const items = followupColumns[column.key as keyof typeof followupColumns];
                return (
                  <div key={column.key} className={`rounded-2xl border ${column.tone} overflow-hidden`}>
                    <div className="p-4 border-b border-black/5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {column.icon}
                          <h3 className="font-bold text-slate-900">{column.label}</h3>
                        </div>
                        <span className="rounded-full bg-white/80 px-2 py-1 text-xs font-bold text-slate-700">{items.length}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{column.help}</p>
                    </div>
                    <div className="p-3 space-y-3 min-h-[360px]">
                      {items.slice(0, 8).map((client) => {
                        const event = eventByClient.get(client.id);
                        const status = getPortfolioStatus(client, calledToday.has(client.id), complaintIds.has(client.id), event);
                        return (
                          <div key={client.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold text-slate-900 text-sm">{client.nombre}</p>
                                <p className="text-[11px] text-slate-500">{client.contacto} · {client.ciudad}</p>
                              </div>
                              <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${status.tone}`}>{status.label}</span>
                            </div>
                            <div className="mt-3 space-y-1 text-[11px] text-slate-500">
                              <p>Last contact: {calledToday.has(client.id) ? 'Today' : `${daysSince(client.last_call_date)} days`}</p>
                              <p>Last purchase: {daysSince(client.last_purchase_date)} days</p>
                              {event && <p>{event.type === 'visit' ? 'Visit' : 'Call'} scheduled: {formatShortDate(event.date)} · {event.time}</p>}
                              {client.outstanding > 0 && <p>Outstanding: {formatCompact(client.outstanding)}</p>}
                            </div>
                            <button
                              onClick={() => markAsCalled(client.id)}
                              className="mt-3 w-full inline-flex items-center justify-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-bold text-white hover:bg-slate-800"
                            >
                              <PhoneCall className="w-3 h-3" />
                              Log call
                            </button>
                          </div>
                        );
                      })}
                      {items.length === 0 && (
                        <div className="h-full min-h-[160px] flex items-center justify-center text-center text-slate-400 text-sm">
                          No clients in this queue.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'pipeline' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-8 gap-3">
              {[
                { label: 'Clients', count: clients.length, helper: 'Commercial base' },
                { label: 'Visit log', count: contactStageCount, helper: 'Active follow-up' },
                ...PIPELINE_STAGES.map((stage) => ({
                  label: stage.label,
                  count: ((pipeline[stage.key] as PipelineItem[]) || []).length,
                  helper: formatCompact(((pipeline[stage.key] as PipelineItem[]) || []).reduce((sum, item) => sum + item.total, 0)),
                })),
              ].map((step, index) => (
                <div key={`${step.label}-${index}`} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">{step.label}</p>
                  <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{step.count}</p>
                  <p className="text-xs text-slate-400">{step.helper}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                This kanban reflects the operational section of the real workflow: from <span className="font-semibold">New order</span> to
                <span className="font-semibold"> Complaint</span>. Earlier stages now live under <span className="font-semibold">Clients</span> and <span className="font-semibold">Follow-up</span>.
              </p>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-4 min-h-[460px]">
              {PIPELINE_STAGES.map((stage) => {
                const items = (pipeline[stage.key] as PipelineItem[]) || [];
                const stageTotal = items.reduce((sum, item) => sum + item.total, 0);

                return (
                  <div key={stage.key} className="w-80 flex-shrink-0 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-800/40 overflow-hidden">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${stage.accent} text-white flex items-center justify-center shadow`}>
                          {stage.icon}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">{stage.label}</p>
                          <p className="text-xs text-slate-500">{items.length} orders · {formatCompact(stageTotal)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-3 space-y-3">
                      {items.map((item) => {
                        const client = clients.find((entry) => entry.id === item.client_id);
                        return (
                          <div key={item.id} className={`rounded-xl border bg-white dark:bg-slate-800 p-4 shadow-sm ${stage.border}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold text-slate-900 dark:text-white">{item.client_name}</p>
                                <p className="text-xs text-slate-500">{client?.contacto || item.vendedor}</p>
                              </div>
                              {client && (
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${(ZONE_CONFIG[client.zone] || ZONE_CONFIG['ZONA CENTRO']).bg} ${(ZONE_CONFIG[client.zone] || ZONE_CONFIG['ZONA CENTRO']).text}`}>
                                  {client.zone.replace('ZONA ', '')}
                                </span>
                              )}
                            </div>
                            <p className="mt-3 text-2xl font-black text-orange-600 dark:text-orange-400">{formatCompact(item.total)}</p>
                            <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">{item.items}</p>
                            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                              <div className={`rounded-lg px-2 py-1.5 ${stage.bg}`}>
                                <p className="text-slate-500">Fecha</p>
                                <p className="font-semibold text-slate-800">{formatShortDate(item.date)}</p>
                              </div>
                              <div className={`rounded-lg px-2 py-1.5 ${stage.bg}`}>
                                <p className="text-slate-500">Responsable</p>
                                <p className="font-semibold text-slate-800">{item.vendedor}</p>
                              </div>
                            </div>
                            {item.issue && (
                              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                                <span className="font-bold">Incidencia:</span> {item.issue}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {items.length === 0 && (
                        <div className="min-h-[140px] flex items-center justify-center text-center text-slate-400 text-sm">
                          No orders in this stage.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="space-y-6">
            {todayEvents.length > 0 && (
              <div className="rounded-2xl border-2 border-red-200 bg-gradient-to-r from-red-50 to-rose-50 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white animate-pulse">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-red-800">Today</h3>
                    <p className="text-xs text-red-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {todayEvents.map((event) => (
                    <div key={event.id} className="flex items-center gap-3 rounded-xl border border-red-100 bg-white p-3">
                      <div className="w-16 text-center">
                        <p className="text-lg font-black text-red-600">{event.time}</p>
                      </div>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${event.type === 'visit' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                        {event.type === 'visit' ? <MapPinned className="w-4 h-4" /> : <PhoneForwarded className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-900 dark:text-white">{event.client_name}</p>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${event.type === 'visit' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                            {event.type === 'visit' ? 'VISITA' : 'LLAMADA'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">{event.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <CalendarDays className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-slate-800 dark:text-white">Upcoming follow-ups</h3>
                  <span className="text-xs text-slate-500">Next 10 days</span>
                </div>
                <div className="space-y-2">
                  {upcomingEvents.map((event, index, arr) => {
                    const showHeader = index === 0 || arr[index - 1].date !== event.date;
                    const isToday = daysSince(event.date) === 0;
                    return (
                      <div key={event.id}>
                        {showHeader && (
                          <div className={`flex items-center gap-2 mt-3 mb-2 ${isToday ? 'text-red-600' : 'text-slate-500'}`}>
                            <div className={`w-2 h-2 rounded-full ${isToday ? 'bg-red-500 animate-pulse' : 'bg-slate-300'}`} />
                            <p className="text-xs font-bold uppercase tracking-wider">
                              {isToday ? 'Today' : `${formatShortDate(event.date)} · in ${daysUntil(event.date)}d`}
                            </p>
                          </div>
                        )}
                        <div className={`flex items-center gap-3 rounded-xl border p-3 ${isToday ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/30'}`}>
                          <div className="w-12 text-center">
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{event.time}</p>
                          </div>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${event.type === 'visit' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                            {event.type === 'visit' ? <MapPinned className="w-4 h-4" /> : <PhoneForwarded className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-slate-900 dark:text-white">{event.client_name}</p>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${event.type === 'visit' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                {event.type === 'visit' ? 'VISIT' : 'CALL'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">{event.note}</p>
                          </div>
                          <button className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50">
                            Reschedule
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
                <h3 className="font-bold text-slate-800 dark:text-white">Resumen agenda</h3>
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-900/30 p-4">
                    <p className="text-xs uppercase tracking-wider text-slate-500">Events today</p>
                    <p className="text-3xl font-black text-slate-900 dark:text-white">{todayEvents.length}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-900/30 p-4">
                    <p className="text-xs uppercase tracking-wider text-slate-500">Visits</p>
                    <p className="text-3xl font-black text-slate-900 dark:text-white">{visitCount}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-900/30 p-4">
                    <p className="text-xs uppercase tracking-wider text-slate-500">Calls</p>
                    <p className="text-3xl font-black text-slate-900 dark:text-white">{upcomingEvents.filter((event) => event.type === 'call').length}</p>
                  </div>
                </div>
                <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50 p-3 text-sm text-purple-700">
                  <span className="font-bold">Readout:</span> the calendar is no longer a loose list; it is connected to the client, the debt, and the pipeline.
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'claims' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <h3 className="font-bold text-red-800">Open claims</h3>
                </div>
                <div className="space-y-3">
                  {complaintItems.map((item) => {
                    const client = clients.find((entry) => entry.id === item.client_id);
                    return (
                      <div key={item.id} className="rounded-xl border border-red-200 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">{item.client_name}</p>
                            <p className="text-xs text-slate-500">{client?.contacto || item.vendedor}</p>
                          </div>
                          <span className="rounded-full bg-red-100 px-2 py-1 text-[10px] font-bold text-red-700">Open</span>
                        </div>
                        <p className="mt-3 text-sm font-semibold text-red-700">{item.issue || 'Revisar caso.'}</p>
                        <p className="mt-2 text-xs text-slate-500">{item.items}</p>
                        <div className="mt-3 flex items-center justify-between text-xs">
                          <span className="text-slate-500">Order: {formatCompact(item.total)}</span>
                          <span className="text-red-700 font-semibold">{formatShortDate(item.date)}</span>
                        </div>
                      </div>
                    );
                  })}
                  {complaintItems.length === 0 && (
                    <div className="rounded-xl border border-red-200 bg-white p-4 text-sm text-red-700">No open claims.</div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="w-5 h-5 text-orange-500" />
                  <h3 className="font-bold text-slate-800 dark:text-white">Accounts at risk</h3>
                </div>
                <div className="space-y-3">
                  {filteredClients
                    .filter((client) => client.outstanding > 0 || complaintIds.has(client.id))
                    .sort((a, b) => b.outstanding - a.outstanding)
                    .slice(0, 8)
                    .map((client) => {
                      const debtRatio = client.credit_limit > 0 ? Math.round((client.outstanding / client.credit_limit) * 100) : 0;
                      return (
                        <div key={client.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-900/30">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white">{client.nombre}</p>
                              <p className="text-xs text-slate-500">{client.contacto}</p>
                            </div>
                            {complaintIds.has(client.id) && <span className="rounded-full bg-red-100 px-2 py-1 text-[10px] font-bold text-red-700">Claim</span>}
                          </div>
                          <div className="mt-3 flex items-center justify-between text-sm">
                            <span className="text-slate-500">Outstanding</span>
                            <span className="font-bold text-red-600">{formatCompact(client.outstanding)}</span>
                          </div>
                          <div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                            <div className="h-full rounded-full bg-red-500" style={{ width: `${Math.min(100, debtRatio)}%` }} />
                          </div>
                          <p className="mt-2 text-[11px] text-slate-500">{debtRatio}% of credit line used</p>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
