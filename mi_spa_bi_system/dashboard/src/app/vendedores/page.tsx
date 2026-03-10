'use client';
import { useEffect, useState, useCallback } from 'react';
import { AreaChart } from '@tremor/react';
import { UserCog, DollarSign, Trophy, Target, Users, TrendingUp, MapPin, ShoppingCart, UserPlus, UserCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DEMO_MODE } from '@/lib/demo-mode';
import { getDemoVendedores } from '@/lib/demo-data';
import { formatCompact } from '@/components/ui';
import { Card3D, KPICard3D, ProgressBar3D } from '@/components/charts3d';

interface Vendedor {
  id: number;
  nombre: string;
  iniciales: string;
  color: string;
  ubicacion: string;
  ventas_total: number;
  unidades: number;
  transacciones: number;
  ticket_promedio: number;
  clientes_nuevos: number;
  clientes_recurrentes: number;
  meta_mensual: number;
  meta_pct: number;
  ranking: number;
}

interface TendenciaDia {
  fecha: string;
  catalina: number;
  felipe: number;
  joaquin: number;
  total: number;
}

export default function VendedoresPage() {
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [tendencia, setTendencia] = useState<TendenciaDia[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (DEMO_MODE) {
        const mock = getDemoVendedores();
        setVendedores(mock.vendedores as any);
        setTendencia(mock.tendencia as any);
        setLoading(false);
        return;
      }

      // TODO: Connect to Supabase when dim_vendedores exists
      // const { data } = await supabase
      //   .from('fact_ventas')
      //   .select('vendedor_id, total, cantidad, cliente_id, dim_vendedores!inner(nombre, bodega, meta_mensual)')
      //   .gte('fecha', thirtyDaysAgo);
    } catch (e) {
      console.error('Error loading vendedores:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const totalEquipo = vendedores.reduce((s, v) => s + v.ventas_total, 0);
  const totalTxn = vendedores.reduce((s, v) => s + v.transacciones, 0);
  const ticketEquipo = totalTxn > 0 ? totalEquipo / totalTxn : 0;
  const metaEquipo = vendedores.length > 0
    ? vendedores.reduce((s, v) => s + v.meta_pct * v.ventas_total, 0) / totalEquipo
    : 0;
  const vendedorDelMes = vendedores[0];

  const chartData = tendencia.map(t => ({
    fecha: new Date(t.fecha).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
    'Catalina R.': t.catalina,
    'Felipe C.': t.felipe,
    'Joaquín M.': t.joaquin,
  }));

  if (loading) {
    return (
      <div className="p-6 min-h-screen flex items-center justify-center">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-indigo-200 rounded-full animate-spin border-t-indigo-600" />
          <div className="absolute inset-0 flex items-center justify-center">
            <UserCog className="w-8 h-8 text-indigo-600" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 min-h-screen">
      <div className="flex justify-end animate-slide-in">
        <div className="flex items-center gap-2 px-4 py-2 bg-sky-50 rounded-xl border border-sky-200">
          <span className="text-lg">🎣</span>
          <span className="text-sm font-semibold text-sky-700">Bluefishing.cl</span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="animate-slide-in stagger-1" style={{ animationFillMode: 'backwards' }}>
          <KPICard3D
            title="Team Total"
            value={formatCompact(totalEquipo)}
            subtitle="sales last 30 days • vs prev. period"
            icon={<DollarSign className="w-6 h-6" />}
            color="green"
          />
        </div>
        <div className="animate-slide-in stagger-2" style={{ animationFillMode: 'backwards' }}>
          <KPICard3D
            title="Seller of the Month"
            value={vendedorDelMes?.nombre?.split(' ')[0] || '-'}
            subtitle={`${formatCompact(vendedorDelMes?.ventas_total || 0)} in sales`}
            icon={<Trophy className="w-6 h-6" />}
            color="amber"
          />
        </div>
        <div className="animate-slide-in stagger-3" style={{ animationFillMode: 'backwards' }}>
          <KPICard3D
            title="Average Ticket"
            value={formatCompact(ticketEquipo)}
            subtitle="team average"
            icon={<ShoppingCart className="w-6 h-6" />}
            color="blue"
          />
        </div>
        <div className="animate-slide-in stagger-4" style={{ animationFillMode: 'backwards' }}>
          <KPICard3D
            title="Team Target"
            value={`${metaEquipo.toFixed(1)}%`}
            subtitle="weighted achievement"
            icon={<Target className="w-6 h-6" />}
            color={metaEquipo >= 85 ? 'green' : metaEquipo >= 70 ? 'amber' : 'red'}
          />
        </div>
      </div>

      {/* Ranking Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {vendedores.map((v, idx) => {
          const trendData = tendencia.map(t => {
            const key = idx === 0 ? 'catalina' : idx === 1 ? 'felipe' : 'joaquin';
            return t[key as keyof TendenciaDia] as number;
          });

          return (
            <div key={v.id} className="animate-slide-in" style={{ animationDelay: `${idx * 100}ms`, animationFillMode: 'backwards' }}>
              <Card3D color={idx === 0 ? 'purple' : idx === 1 ? 'blue' : 'green'} hover={false}>
                {/* Header */}
                <div className="flex items-center gap-4 mb-5">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${v.color} flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
                    {v.iniciales}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">{v.nombre}</h3>
                      {idx === 0 && <span className="text-lg">🏆</span>}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                      <MapPin className="w-3.5 h-3.5" />
                      {v.ubicacion}
                    </div>
                  </div>
                  <div className={`
                    w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg
                    ${idx === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg' :
                      idx === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white' :
                      'bg-gradient-to-br from-orange-400 to-orange-600 text-white'}
                  `}>
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="p-3 bg-white/60 dark:bg-slate-800/60 rounded-xl text-center">
                    <DollarSign className="w-4 h-4 mx-auto text-emerald-500 mb-1" />
                    <p className="text-lg font-black text-slate-800 dark:text-slate-200">{formatCompact(v.ventas_total)}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Sales</p>
                  </div>
                  <div className="p-3 bg-white/60 dark:bg-slate-800/60 rounded-xl text-center">
                    <ShoppingCart className="w-4 h-4 mx-auto text-blue-500 mb-1" />
                    <p className="text-lg font-black text-slate-800 dark:text-slate-200">{v.transacciones}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Txn</p>
                  </div>
                  <div className="p-3 bg-white/60 dark:bg-slate-800/60 rounded-xl text-center">
                    <TrendingUp className="w-4 h-4 mx-auto text-purple-500 mb-1" />
                    <p className="text-lg font-black text-slate-800 dark:text-slate-200">{formatCompact(v.ticket_promedio)}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Ticket</p>
                  </div>
                </div>

                {/* Clients Row */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="flex-1 flex items-center gap-2 p-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl">
                    <UserPlus className="w-4 h-4 text-emerald-600" />
                    <div>
                      <p className="text-sm font-bold text-emerald-700">{v.clientes_nuevos}</p>
                      <p className="text-[10px] text-emerald-600">New</p>
                    </div>
                  </div>
                  <div className="flex-1 flex items-center gap-2 p-2.5 bg-blue-50 dark:bg-blue-950/30 rounded-xl">
                    <UserCheck className="w-4 h-4 text-blue-600" />
                    <div>
                      <p className="text-sm font-bold text-blue-700">{v.clientes_recurrentes}</p>
                      <p className="text-[10px] text-blue-600">Returning</p>
                    </div>
                  </div>
                </div>

                {/* Target Progress */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Monthly target</span>
                    <span className={`text-sm font-bold ${
                      v.meta_pct >= 85 ? 'text-emerald-600' : v.meta_pct >= 70 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {v.meta_pct.toFixed(1)}%
                    </span>
                  </div>
                  <ProgressBar3D
                    value={v.ventas_total}
                    max={v.meta_mensual}
                    label={`${formatCompact(v.ventas_total)} / ${formatCompact(v.meta_mensual)}`}
                    color={v.meta_pct >= 85 ? 'green' : v.meta_pct >= 70 ? 'amber' : 'red'}
                  />
                </div>

                {/* Mini Sparkline */}
                <div className="h-16 flex items-end gap-0.5">
                  {trendData.map((val, i) => {
                    const max = Math.max(...trendData);
                    const height = (val / max) * 100;
                    return (
                      <div
                        key={i}
                        className={`flex-1 rounded-t bg-gradient-to-t ${v.color} opacity-50 hover:opacity-100 transition-all`}
                        style={{ height: `${height}%`, minHeight: '3px' }}
                      />
                    );
                  })}
                </div>
              </Card3D>
            </div>
          );
        })}
      </div>

      {/* Comparative Chart */}
      <div className="card-3d p-6 animate-slide-in stagger-4" style={{ animationFillMode: 'backwards' }}>
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Daily Sales Comparison</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Last 30 days - By sales rep</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600" />
              <span className="text-sm text-slate-600 dark:text-slate-400">Catalina R.</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-sky-500 to-cyan-600" />
              <span className="text-sm text-slate-600 dark:text-slate-400">Felipe C.</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600" />
              <span className="text-sm text-slate-600 dark:text-slate-400">Joaquín M.</span>
            </div>
          </div>
        </div>
        <div className="chart-container p-4 bg-white/50 dark:bg-slate-800/50 rounded-xl">
          <AreaChart
            className="h-80"
            data={chartData}
            index="fecha"
            categories={['Catalina R.', 'Felipe C.', 'Joaquín M.']}
            colors={['violet', 'cyan', 'emerald']}
            valueFormatter={formatCompact}
            showAnimation={true}
            curveType="monotone"
            showGridLines={false}
          />
        </div>
      </div>

      {/* Summary Table */}
      <div className="card-3d p-6 animate-slide-in stagger-5" style={{ animationFillMode: 'backwards' }}>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-6">Team Summary</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-slate-200 dark:border-slate-700">
                <th className="text-left py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">#</th>
                <th className="text-left py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Sales Rep</th>
                <th className="text-left py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Location</th>
                <th className="text-right py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Sales</th>
                <th className="text-center py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Txn</th>
                <th className="text-right py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Avg. Ticket</th>
                <th className="text-center py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Customers</th>
                <th className="text-center py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Target %</th>
                <th className="text-left py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400 w-32">Performance</th>
              </tr>
            </thead>
            <tbody>
              {vendedores.map((v, idx) => {
                const totalClientes = v.clientes_nuevos + v.clientes_recurrentes;
                return (
                  <tr key={v.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-4 px-4">
                      <div className={`
                        w-10 h-10 rounded-xl flex items-center justify-center font-bold
                        ${idx === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg' :
                          idx === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white' :
                          'bg-gradient-to-br from-orange-400 to-orange-600 text-white'}
                      `}>
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${v.color} flex items-center justify-center text-white font-bold text-xs shadow-md`}>
                          {v.iniciales}
                        </div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{v.nombre}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
                        <MapPin className="w-3.5 h-3.5" />
                        {v.ubicacion}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="text-lg font-bold text-indigo-600">{formatCompact(v.ventas_total)}</span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-bold">{v.transacciones}</span>
                    </td>
                    <td className="py-4 px-4 text-right font-medium text-slate-700 dark:text-slate-300">{formatCompact(v.ticket_promedio)}</td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-emerald-600 font-bold">{v.clientes_nuevos}</span>
                        <span className="text-slate-400 dark:text-slate-500">/</span>
                        <span className="text-blue-600 font-bold">{v.clientes_recurrentes}</span>
                        <span className="text-slate-400 dark:text-slate-500 text-xs ml-1">({totalClientes})</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`
                        px-3 py-1.5 rounded-full text-sm font-bold
                        ${v.meta_pct >= 85 ? 'bg-emerald-100 text-emerald-700' :
                          v.meta_pct >= 70 ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'}
                      `}>
                        {v.meta_pct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            v.meta_pct >= 85 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' :
                            v.meta_pct >= 70 ? 'bg-gradient-to-r from-amber-400 to-amber-600' :
                            'bg-gradient-to-r from-red-400 to-red-600'
                          }`}
                          style={{ width: `${Math.min(v.meta_pct, 100)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {/* Totals Row */}
              <tr className="bg-gradient-to-r from-indigo-50 to-purple-50 font-bold">
                <td className="py-4 px-4" colSpan={2}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
                      <Users className="w-5 h-5" />
                    </div>
                    <span className="text-slate-800 dark:text-slate-200">Team Total</span>
                  </div>
                </td>
                <td className="py-4 px-4" />
                <td className="py-4 px-4 text-right">
                  <span className="text-lg font-black text-indigo-700">{formatCompact(totalEquipo)}</span>
                </td>
                <td className="py-4 px-4 text-center">
                  <span className="px-3 py-1 bg-indigo-200 text-indigo-800 rounded-full text-sm font-bold">{totalTxn}</span>
                </td>
                <td className="py-4 px-4 text-right font-bold text-slate-700 dark:text-slate-300">{formatCompact(ticketEquipo)}</td>
                <td className="py-4 px-4 text-center">
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {vendedores.reduce((s, v) => s + v.clientes_nuevos + v.clientes_recurrentes, 0)}
                  </span>
                </td>
                <td className="py-4 px-4 text-center">
                  <span className="px-3 py-1.5 bg-indigo-200 text-indigo-800 rounded-full text-sm font-bold">
                    {metaEquipo.toFixed(1)}%
                  </span>
                </td>
                <td className="py-4 px-4">
                  <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-400 to-purple-600 rounded-full"
                      style={{ width: `${Math.min(metaEquipo, 100)}%` }}
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-xl">
        <p className="text-sm text-purple-700">
          <span className="font-bold">📌 Insight:</span> Compare seller performance to identify coaching opportunities. Top performers' strategies can be replicated. Monitor conversion rates alongside revenue for a complete picture.
        </p>
      </div>

      <p className="text-[10px] text-slate-400 dark:text-slate-500 text-right mt-2">Source: Bsale sales API • Synced daily</p>
    </div>
  );
}
