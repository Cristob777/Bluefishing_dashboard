'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Wallet, Users, FileText, CreditCard, ArrowRightLeft, 
  AlertTriangle, CheckCircle, Clock, TrendingUp, TrendingDown,
  ChevronRight, DollarSign, Receipt, BarChart3
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DEMO_MODE } from '@/lib/demo-mode';
import { getDemoFinanzas } from '@/lib/demo-data';
import { formatCompact } from '@/components/ui';
import { Card3D, KPICard3D, Gauge3D, ProgressBar3D, Donut3D } from '@/components/charts3d';

// ============================================================================
// INTERFACES
// ============================================================================

interface CreditHealth {
  cliente_id: string;
  rut: string;
  razon_social: string;
  credit_limit: number;
  total_debt: number;
  overdue_debt: number;
  available_credit: number;
  credit_status: 'OK' | 'DELINQUENT' | 'OVERDRAWN' | 'BLOCKED';
  facturas_pendientes: number;
  facturas_vencidas: number;
  dias_mora_promedio: number;
}

interface AgingData {
  por_vencer: number;
  vencido_1_30: number;
  vencido_31_60: number;
  vencido_61_90: number;
  vencido_90_plus: number;
  total_pendiente: number;
}

interface DashboardStats {
  total_cartera: number;
  total_cobrado_mes: number;
  total_vencido: number;
  clientes_morosos: number;
  pagos_sin_asignar: number;
  tasa_recuperacion: number;
}

// ============================================================================
// COLORS
// ============================================================================

const STATUS_COLORS = {
  OK: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: <CheckCircle className="w-4 h-4" /> },
  DELINQUENT: { bg: 'bg-red-50', text: 'text-red-700', icon: <AlertTriangle className="w-4 h-4" /> },
  OVERDRAWN: { bg: 'bg-orange-50', text: 'text-orange-700', icon: <TrendingDown className="w-4 h-4" /> },
  BLOCKED: { bg: 'bg-slate-50 dark:bg-slate-800/50', text: 'text-slate-700 dark:text-slate-300', icon: <Clock className="w-4 h-4" /> },
};

const AGING_COLORS = [
  { label: 'Coming Due', color: '#10b981', key: 'por_vencer' },
  { label: '1-30 days', color: '#f59e0b', key: 'vencido_1_30' },
  { label: '31-60 days', color: '#f97316', key: 'vencido_31_60' },
  { label: '61-90 days', color: '#ef4444', key: 'vencido_61_90' },
  { label: '90+ days', color: '#991b1b', key: 'vencido_90_plus' },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function FinanzasPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [aging, setAging] = useState<AgingData | null>(null);
  const [topMorosos, setTopMorosos] = useState<CreditHealth[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      if (DEMO_MODE) {
        const mock = getDemoFinanzas();
        setTopMorosos(mock.creditHealth.filter(c => c.overdue_debt > 0) as any);
        const agingAgg = mock.aging.reduce((acc, row) => ({
          por_vencer: acc.por_vencer + (row.por_vencer || 0),
          vencido_1_30: acc.vencido_1_30 + (row.vencido_1_30 || 0),
          vencido_31_60: acc.vencido_31_60 + (row.vencido_31_60 || 0),
          vencido_61_90: acc.vencido_61_90 + (row.vencido_61_90 || 0),
          vencido_90_plus: acc.vencido_90_plus + (row.vencido_90_plus || 0),
          total_pendiente: acc.total_pendiente + (row.total_pendiente || 0),
        }), { por_vencer: 0, vencido_1_30: 0, vencido_31_60: 0, vencido_61_90: 0, vencido_90_plus: 0, total_pendiente: 0 });
        setAging(agingAgg);
        const totalVencido = agingAgg.vencido_1_30 + agingAgg.vencido_31_60 + agingAgg.vencido_61_90 + agingAgg.vencido_90_plus;
        setStats({
          total_cartera: agingAgg.total_pendiente,
          total_cobrado_mes: 12400000,
          total_vencido: totalVencido,
          clientes_morosos: mock.creditHealth.filter(c => c.credit_status === 'DELINQUENT').length,
          pagos_sin_asignar: 3200000,
          tasa_recuperacion: agingAgg.total_pendiente > 0 ? ((agingAgg.total_pendiente - totalVencido) / agingAgg.total_pendiente) * 100 : 100,
        });
        setLoading(false);
        return;
      }

      const { data: creditData } = await supabase
        .from('v_client_credit_health')
        .select('*')
        .order('overdue_debt', { ascending: false })
        .limit(10);

      setTopMorosos((creditData || []) as CreditHealth[]);

      const { data: agingData } = await supabase
        .from('v_aging_cartera')
        .select('*');

      if (agingData && agingData.length > 0) {
        const agingAgg: AgingData = agingData.reduce((acc, row) => ({
          por_vencer: acc.por_vencer + (row.por_vencer || 0),
          vencido_1_30: acc.vencido_1_30 + (row.vencido_1_30 || 0),
          vencido_31_60: acc.vencido_31_60 + (row.vencido_31_60 || 0),
          vencido_61_90: acc.vencido_61_90 + (row.vencido_61_90 || 0),
          vencido_90_plus: acc.vencido_90_plus + (row.vencido_90_plus || 0),
          total_pendiente: acc.total_pendiente + (row.total_pendiente || 0),
        }), {
          por_vencer: 0, vencido_1_30: 0, vencido_31_60: 0,
          vencido_61_90: 0, vencido_90_plus: 0, total_pendiente: 0
        });
        setAging(agingAgg);
      }

      const totalCartera = agingData?.reduce((s, r) => s + (r.total_pendiente || 0), 0) || 0;
      const totalVencido = agingData?.reduce((s, r) => 
        s + (r.vencido_1_30 || 0) + (r.vencido_31_60 || 0) + (r.vencido_61_90 || 0) + (r.vencido_90_plus || 0), 0) || 0;
      const clientesMorosos = creditData?.filter(c => c.credit_status === 'DELINQUENT').length || 0;

      const { data: pagosData } = await supabase
        .from('fin_pagos')
        .select('unallocated_balance')
        .gt('unallocated_balance', 0);
      
      const pagosSinAsignar = pagosData?.reduce((s, p) => s + (p.unallocated_balance || 0), 0) || 0;

      setStats({
        total_cartera: totalCartera,
        total_cobrado_mes: 0,
        total_vencido: totalVencido,
        clientes_morosos: clientesMorosos,
        pagos_sin_asignar: pagosSinAsignar,
        tasa_recuperacion: totalCartera > 0 ? ((totalCartera - totalVencido) / totalCartera) * 100 : 100,
      });

    } catch (e) {
      console.error('Error loading financial data:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 min-h-screen flex items-center justify-center">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-indigo-200 rounded-full animate-spin border-t-indigo-600" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Wallet className="w-8 h-8 text-indigo-600" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 md:space-y-8 min-h-screen">
      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { href: '/finanzas/clientes', icon: <Users className="w-6 h-6" />, label: 'Customers', desc: 'Credit management', color: 'indigo' },
          { href: '/finanzas/facturas', icon: <FileText className="w-6 h-6" />, label: 'Invoices', desc: 'Accounts receivable', color: 'blue' },
          { href: '/finanzas/pagos', icon: <CreditCard className="w-6 h-6" />, label: 'Payments', desc: 'Recording & allocation', color: 'emerald' },
          { href: '/finanzas/conciliacion', icon: <ArrowRightLeft className="w-6 h-6" />, label: 'Reconciliation', desc: 'Allocate payments', color: 'purple' },
        ].map((item, idx) => (
          <Link 
            key={idx}
            href={item.href}
            className={`
              p-5 rounded-2xl border-2 transition-all duration-300
              bg-gradient-to-br from-${item.color}-50 to-white
              border-${item.color}-100 hover:border-${item.color}-300
              hover:shadow-lg hover:scale-[1.02] group
            `}
          >
            <div className={`
              w-12 h-12 rounded-xl mb-3 flex items-center justify-center
              bg-gradient-to-br from-${item.color}-500 to-${item.color}-600
              text-white shadow-lg group-hover:scale-110 transition-transform
            `}>
              {item.icon}
            </div>
            <h3 className="font-bold text-slate-800 dark:text-slate-200">{item.label}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{item.desc}</p>
            <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 mt-2 group-hover:translate-x-1 transition-transform" />
          </Link>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="animate-slide-in stagger-1">
          <KPICard3D
            title="Total Portfolio"
            value={formatCompact(stats?.total_cartera || 0)}
            subtitle="receivable"
            icon={<DollarSign className="w-6 h-6" />}
            color="blue"
          />
        </div>
        <div className="animate-slide-in stagger-2">
          <KPICard3D
            title="Overdue"
            value={formatCompact(stats?.total_vencido || 0)}
            subtitle="past due"
            icon={<AlertTriangle className="w-6 h-6" />}
            color="red"
            delta={stats?.clientes_morosos}
          />
        </div>
        <div className="animate-slide-in stagger-3">
          <KPICard3D
            title="Unallocated Payments"
            value={formatCompact(stats?.pagos_sin_asignar || 0)}
            subtitle="available"
            icon={<Receipt className="w-6 h-6" />}
            color="amber"
          />
        </div>
        <div className="animate-slide-in stagger-4">
          <KPICard3D
            title="Recovery Rate"
            value={`${(stats?.tasa_recuperacion || 0).toFixed(1)}%`}
            subtitle="current"
            icon={<TrendingUp className="w-6 h-6" />}
            color="green"
          />
        </div>
      </div>

      {/* Portfolio Aging + Gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card3D color="blue" hover={false}>
          <div className="flex flex-col items-center">
            <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-4">Portfolio Health</h3>
            <Gauge3D 
              value={stats?.tasa_recuperacion || 0} 
              max={100} 
              label={`${(stats?.tasa_recuperacion || 0).toFixed(0)}%`}
            />
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              {(stats?.tasa_recuperacion || 0) >= 80 ? '🟢 Healthy portfolio' : 
               (stats?.tasa_recuperacion || 0) >= 60 ? '🟡 Attention required' : 
               '🔴 High risk'}
            </p>
          </div>
        </Card3D>

        <div className="lg:col-span-2 card-3d p-6">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-6">Portfolio Aging</h2>
          
          {aging && (
            <>
              {/* Donut */}
              <div className="flex justify-center mb-6">
                <Donut3D
                  data={AGING_COLORS.map(a => ({
                    name: a.label,
                    value: aging[a.key as keyof AgingData] as number,
                    color: a.color
                  }))}
                  size={180}
                  thickness={40}
                />
              </div>
              
              {/* Aging bars */}
              <div className="space-y-3">
                {AGING_COLORS.map(a => {
                  const value = aging[a.key as keyof AgingData] as number;
                  const pct = aging.total_pendiente > 0 ? (value / aging.total_pendiente) * 100 : 0;
                  
                  return (
                    <div key={a.key} className="flex items-center gap-3">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: a.color }}
                      />
                      <span className="text-sm text-slate-600 dark:text-slate-400 w-24">{a.label}</span>
                      <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: a.color }}
                        />
                      </div>
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300 w-20 text-right">
                        {formatCompact(value)}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 w-12 text-right">
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                <p className="text-sm text-indigo-700">
                  <span className="font-bold">📌 Insight:</span> {aging.vencido_90_plus > 0
                    ? `${formatCompact(aging.vencido_90_plus)} in 90+ day aging bucket requires immediate attention — consider write-off provisions or escalated collection.`
                    : 'No receivables past 90 days. Portfolio aging is well-controlled — maintain current collection cadence.'}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Top Delinquent Customers */}
      <div className="card-3d p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Highest Risk Customers</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Top 10 by overdue debt</p>
          </div>
          <Link 
            href="/finanzas/clientes"
            className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-semibold hover:bg-indigo-100 transition-colors"
          >
            View all
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-slate-200 dark:border-slate-700">
                <th className="text-left py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Customer</th>
                <th className="text-center py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Status</th>
                <th className="text-right py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Total Debt</th>
                <th className="text-right py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Overdue</th>
                <th className="text-center py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Invoices</th>
                <th className="text-center py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Days Overdue</th>
                <th className="text-right py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Avail. Credit</th>
              </tr>
            </thead>
            <tbody>
              {topMorosos.map((cliente) => {
                const statusStyle = STATUS_COLORS[cliente.credit_status] || STATUS_COLORS.OK;
                
                return (
                  <tr key={cliente.cliente_id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-medium text-slate-800 dark:text-slate-200">{cliente.razon_social}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{cliente.rut}</p>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`
                        inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold
                        ${statusStyle.bg} ${statusStyle.text}
                      `}>
                        {statusStyle.icon}
                        {cliente.credit_status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right font-bold text-slate-800 dark:text-slate-200">
                      {formatCompact(cliente.total_debt)}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className={cliente.overdue_debt > 0 ? 'text-red-600 font-bold' : 'text-slate-600 dark:text-slate-400'}>
                        {formatCompact(cliente.overdue_debt)}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-full text-xs font-semibold">
                        {cliente.facturas_pendientes}
                        {cliente.facturas_vencidas > 0 && (
                          <span className="text-red-600 ml-1">({cliente.facturas_vencidas} ovd.)</span>
                        )}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`
                        font-bold
                        ${cliente.dias_mora_promedio > 60 ? 'text-red-600' : 
                          cliente.dias_mora_promedio > 30 ? 'text-orange-600' : 
                          cliente.dias_mora_promedio > 0 ? 'text-amber-600' : 'text-slate-600 dark:text-slate-400'}
                      `}>
                        {cliente.dias_mora_promedio || 0}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className={cliente.available_credit < 0 ? 'text-red-600 font-bold' : 'text-emerald-600'}>
                        {formatCompact(cliente.available_credit)}
                      </span>
                    </td>
                  </tr>
                );
              })}
              
              {topMorosos.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <CheckCircle className="w-12 h-12 mx-auto text-emerald-300 mb-4" />
                    <p className="text-slate-500 dark:text-slate-400">No customers with overdue debt</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm text-red-700">
            <span className="font-bold">📌 Insight:</span> {topMorosos.length > 0
              ? `${topMorosos.length} customers with overdue balances. Top risk: ${topMorosos[0]?.razon_social} with ${formatCompact(topMorosos[0]?.overdue_debt)} overdue. Consider contacting high-risk accounts this week.`
              : 'No delinquent customers detected — credit portfolio is healthy.'}
          </p>
        </div>
      </div>
      <p className="text-[10px] text-slate-400 dark:text-slate-500 text-right mt-2">Source: Bsale financial API • Synced daily</p>
    </div>
  );
}
