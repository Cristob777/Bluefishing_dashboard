'use client';
import { useEffect, useState } from 'react';
import { Grid, DonutChart, BarChart, Badge } from '@tremor/react';
import { Users, Crown, AlertTriangle, UserMinus, TrendingUp, Star, UserCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DEMO_MODE } from '@/lib/demo-mode';
import { getDemoClientes } from '@/lib/demo-data';
import { formatCompact, Skeleton } from '@/components/ui';
import { Card3D, KPICard3D, Donut3D, ProgressBar3D, RankingItem } from '@/components/charts3d';

interface SegmentoCliente {
  tienda: string;
  segmento: string;
  num_clientes: number;
  valor_total: number;
  frecuencia_promedio: number;
  dias_promedio_inactivo: number;
}

interface TopCliente {
  cliente_id: number;
  razon_social: string;
  rut: string;
  tienda: string;
  compras: number;
  total_compras: number;
  ticket_promedio: number;
  ultima_compra: string;
  ranking: number;
}

interface ClienteRFM {
  cliente_id: number;
  razon_social: string;
  tienda: string;
  frecuencia: number;
  monetario: number;
  dias_desde_ultima: number;
  segmento: string;
  rfm_total: number;
}

const SEGMENTO_COLORS: Record<string, { bg: string; text: string; border: string; chart: string }> = {
  'Champions': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', chart: '#10b981' },
  'Loyal': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', chart: '#3b82f6' },
  'Big Spenders': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', chart: '#8b5cf6' },
  'Promising': { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', chart: '#06b6d4' },
  'At Risk': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', chart: '#f97316' },
  'Cant Lose': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', chart: '#ef4444' },
  'Lost': { bg: 'bg-slate-50 dark:bg-slate-800/50', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-700', chart: '#6b7280' },
  'Regular': { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', chart: '#64748b' }
};

export default function ClientesPage() {
  const [segmentos, setSegmentos] = useState<SegmentoCliente[]>([]);
  const [topClientes, setTopClientes] = useState<TopCliente[]>([]);
  const [clientesRFM, setClientesRFM] = useState<ClienteRFM[]>([]);
  const [loading, setLoading] = useState(true);
  const [tiendaFiltro] = useState('ALL');

  useEffect(() => {
    loadData();
  }, [tiendaFiltro]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (DEMO_MODE) {
        const mock = getDemoClientes();
        setSegmentos(mock.segmentos as any);
        setTopClientes(mock.topClientes as any);
        setClientesRFM(mock.clientesRFM as any);
        setLoading(false);
        return;
      }

      let querySegmentos = supabase.from('v_segmentos_clientes').select('*');
      if (tiendaFiltro !== 'ALL') querySegmentos = querySegmentos.eq('tienda', tiendaFiltro);
      const { data: segData } = await querySegmentos;
      setSegmentos((segData || []) as SegmentoCliente[]);

      let queryTop = supabase.from('v_top_clientes').select('*').lte('ranking', 20);
      if (tiendaFiltro !== 'ALL') queryTop = queryTop.eq('tienda', tiendaFiltro);
      const { data: topData } = await queryTop.order('total_compras', { ascending: false });
      setTopClientes((topData || []) as TopCliente[]);

      let queryRFM = supabase.from('v_clientes_rfm').select('*').limit(100);
      if (tiendaFiltro !== 'ALL') queryRFM = queryRFM.eq('tienda', tiendaFiltro);
      const { data: rfmData } = await queryRFM.order('monetario', { ascending: false });
      setClientesRFM((rfmData || []) as ClienteRFM[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getSegmentoIcon = (segmento: string) => {
    switch (segmento) {
      case 'Champions': return <Crown className="w-4 h-4" />;
      case 'At Risk': return <AlertTriangle className="w-4 h-4" />;
      case 'Lost': return <UserMinus className="w-4 h-4" />;
      case 'Loyal': return <Star className="w-4 h-4" />;
      default: return <Users className="w-4 h-4" />;
    }
  };

  const totalClientes = segmentos.reduce((sum, s) => sum + s.num_clientes, 0);
  const valorTotal = segmentos.reduce((sum, s) => sum + s.valor_total, 0);
  const champions = segmentos.filter(s => s.segmento === 'Champions').reduce((sum, s) => sum + s.num_clientes, 0);
  const atRisk = segmentos.filter(s => s.segmento === 'At Risk' || s.segmento === 'Lost').reduce((sum, s) => sum + s.num_clientes, 0);

  const chartDataSegmentos = segmentos.reduce((acc, s) => {
    const existing = acc.find(a => a.segmento === s.segmento);
    if (existing) {
      existing.clientes += s.num_clientes;
      existing.valor += s.valor_total;
    } else {
      acc.push({ 
        segmento: s.segmento, 
        clientes: s.num_clientes, 
        valor: s.valor_total,
        color: SEGMENTO_COLORS[s.segmento]?.chart || '#6b7280'
      });
    }
    return acc;
  }, [] as { segmento: string; clientes: number; valor: number; color: string }[]);

  if (loading) {
    return (
      <div className="p-6 min-h-screen flex items-center justify-center">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-indigo-200 rounded-full animate-spin border-t-indigo-600" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Users className="w-8 h-8 text-indigo-600" />
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
            title="Active Customers"
            value={totalClientes.toString()}
            subtitle="with purchases in 12 months"
            icon={<Users className="w-6 h-6" />}
            color="blue"
          />
        </div>
        <div className="animate-slide-in stagger-2" style={{ animationFillMode: 'backwards' }}>
          <KPICard3D
            title="Total Value"
            value={formatCompact(valorTotal)}
            subtitle="last 12 months • vs prev. period"
            icon={<TrendingUp className="w-6 h-6" />}
            color="green"
          />
        </div>
        <div className="animate-slide-in stagger-3" style={{ animationFillMode: 'backwards' }}>
          <KPICard3D
            title="Champions"
            value={champions.toString()}
            subtitle="best customers"
            icon={<Crown className="w-6 h-6" />}
            color="amber"
          />
        </div>
        <div className="animate-slide-in stagger-4" style={{ animationFillMode: 'backwards' }}>
          <KPICard3D
            title="At Risk"
            value={atRisk.toString()}
            subtitle="require attention"
            icon={<AlertTriangle className="w-6 h-6" />}
            color="red"
            delta={atRisk > 5 ? atRisk : undefined}
          />
        </div>
      </div>

      {/* Segmentation Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-3d p-6 animate-slide-in stagger-2" style={{ animationFillMode: 'backwards' }}>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-6">Distribution by Segment</h2>
          <div className="flex justify-center mb-6">
            <Donut3D
              data={chartDataSegmentos.map(d => ({
                name: d.segmento,
                value: d.clientes,
                color: d.color
              }))}
              size={200}
              thickness={45}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {chartDataSegmentos.slice(0, 6).map(seg => (
              <div 
                key={seg.segmento}
                className={`p-3 rounded-xl border ${SEGMENTO_COLORS[seg.segmento]?.bg || 'bg-slate-50 dark:bg-slate-800/50'} ${SEGMENTO_COLORS[seg.segmento]?.border || 'border-slate-200 dark:border-slate-700'}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{seg.segmento}</span>
                </div>
                <p className={`text-lg font-bold ${SEGMENTO_COLORS[seg.segmento]?.text || 'text-slate-700 dark:text-slate-300'}`}>
                  {seg.clientes}
                </p>
              </div>
            ))}
          </div>
        </div>
        
        <div className="card-3d p-6 animate-slide-in stagger-3" style={{ animationFillMode: 'backwards' }}>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-6">Value by Segment</h2>
          <div className="chart-container p-4 bg-white/50 rounded-xl">
            <BarChart
              className="h-64"
              data={chartDataSegmentos.sort((a, b) => b.valor - a.valor)}
              index="segmento"
              categories={['valor']}
              colors={['indigo']}
              valueFormatter={formatCompact}
              showAnimation={true}
              showGridLines={false}
            />
          </div>
        </div>
      </div>

      {/* Segment Detail */}
      <div className="card-3d p-6 animate-slide-in stagger-3" style={{ animationFillMode: 'backwards' }}>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-6">Segment Detail</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-slate-200 dark:border-slate-700">
                <th className="text-left py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Segment</th>
                <th className="text-left py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Store</th>
                <th className="text-center py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Customers</th>
                <th className="text-right py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Total Value</th>
                <th className="text-center py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Frequency</th>
                <th className="text-center py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Days Inactive</th>
                <th className="text-left py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Suggested Action</th>
              </tr>
            </thead>
            <tbody>
              {segmentos.map((s, i) => (
                <tr key={i} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-4 px-4">
                    <div className={`
                      inline-flex items-center gap-2 px-3 py-1.5 rounded-full
                      ${SEGMENTO_COLORS[s.segmento]?.bg || 'bg-slate-50 dark:bg-slate-800/50'}
                      ${SEGMENTO_COLORS[s.segmento]?.text || 'text-slate-700 dark:text-slate-300'}
                    `}>
                      {getSegmentoIcon(s.segmento)}
                      <span className="font-semibold text-sm">{s.segmento}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4"><span className="px-2 py-1 bg-sky-100 text-sky-700 rounded-full text-xs font-semibold">Bluefishing</span></td>
                  <td className="py-4 px-4 text-center font-bold text-slate-800 dark:text-slate-200">{s.num_clientes}</td>
                  <td className="py-4 px-4 text-right font-bold text-indigo-600">{formatCompact(s.valor_total)}</td>
                  <td className="py-4 px-4 text-center text-slate-600 dark:text-slate-400">{s.frecuencia_promedio?.toFixed(1) || '-'}</td>
                  <td className="py-4 px-4 text-center">
                    <span className={`
                      ${(s.dias_promedio_inactivo || 0) > 60 ? 'text-red-600 font-bold' : 
                        (s.dias_promedio_inactivo || 0) > 30 ? 'text-orange-600' : 'text-slate-600 dark:text-slate-400'}
                    `}>
                      {Math.round(s.dias_promedio_inactivo || 0)} days
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      {s.segmento === 'Champions' && '🎁 VIP Program'}
                      {s.segmento === 'Loyal' && '📈 Upselling'}
                      {s.segmento === 'At Risk' && '📞 Contact urgently'}
                      {s.segmento === 'Lost' && '💌 Win-back campaign'}
                      {s.segmento === 'Promising' && '🎯 Retain & grow'}
                      {s.segmento === 'Regular' && '📧 Newsletter'}
                      {s.segmento === 'Big Spenders' && '⭐ Exclusive offers'}
                      {s.segmento === 'Cant Lose' && '🚨 Immediate retention'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Customers */}
      <div className="card-3d p-6 animate-slide-in stagger-4" style={{ animationFillMode: 'backwards' }}>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-6">🏆 Top 20 Customers by Value</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-slate-200 dark:border-slate-700">
                <th className="text-left py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">#</th>
                <th className="text-left py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Customer</th>
                <th className="text-left py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Tax ID</th>
                <th className="text-left py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Store</th>
                <th className="text-center py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Purchases</th>
                <th className="text-right py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Total</th>
                <th className="text-right py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Avg. Ticket</th>
                <th className="text-left py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Last Purchase</th>
              </tr>
            </thead>
            <tbody>
              {topClientes.slice(0, 20).map((c, idx) => (
                <tr key={c.cliente_id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-4 px-4">
                    <div className={`
                      w-10 h-10 rounded-xl flex items-center justify-center font-bold
                      ${idx === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg' :
                        idx === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white' :
                        idx === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white' :
                        'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                      }
                    `}>
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : c.ranking}
                    </div>
                  </td>
                  <td className="py-4 px-4 font-medium text-slate-800 dark:text-slate-200 max-w-xs truncate">{c.razon_social}</td>
                  <td className="py-4 px-4 text-slate-500 dark:text-slate-400 font-mono text-sm">{c.rut}</td>
                  <td className="py-4 px-4"><span className="px-2 py-1 bg-sky-100 text-sky-700 rounded-full text-xs font-semibold">Bluefishing</span></td>
                  <td className="py-4 px-4 text-center">
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-bold">
                      {c.compras}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right font-bold text-indigo-600">{formatCompact(c.total_compras)}</td>
                  <td className="py-4 px-4 text-right text-slate-600 dark:text-slate-400">{formatCompact(c.ticket_promedio)}</td>
                  <td className="py-4 px-4 text-slate-500 dark:text-slate-400 text-sm">
                    {c.ultima_compra ? new Date(c.ultima_compra).toLocaleDateString('en-US') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed RFM Analysis */}
      <div className="card-3d p-6 animate-slide-in stagger-5" style={{ animationFillMode: 'backwards' }}>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Detailed RFM Analysis</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Recency (last purchase) • Frequency (purchase count) • Monetary (value)</p>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-slate-200 dark:border-slate-700">
                <th className="text-left py-3 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Customer</th>
                <th className="text-left py-3 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Store</th>
                <th className="text-center py-3 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Days Inactive</th>
                <th className="text-center py-3 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Frequency</th>
                <th className="text-right py-3 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Total Value</th>
                <th className="text-center py-3 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">RFM Score</th>
                <th className="text-left py-3 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Segment</th>
              </tr>
            </thead>
            <tbody>
              {clientesRFM.slice(0, 15).map((c) => (
                <tr key={c.cliente_id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200 max-w-xs truncate">{c.razon_social}</td>
                  <td className="py-3 px-4"><span className="px-2 py-1 bg-sky-100 text-sky-700 rounded-full text-xs font-semibold">Bluefishing</span></td>
                  <td className="py-3 px-4 text-center">
                    <span className={`
                      ${c.dias_desde_ultima > 90 ? 'text-red-600 font-bold' : 
                        c.dias_desde_ultima > 30 ? 'text-orange-600' : 'text-green-600'}
                    `}>
                      {c.dias_desde_ultima} days
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center text-slate-600 dark:text-slate-400">{c.frecuencia} purchases</td>
                  <td className="py-3 px-4 text-right font-bold text-indigo-600">{formatCompact(c.monetario)}</td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            c.rfm_total >= 12 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : 
                            c.rfm_total >= 8 ? 'bg-gradient-to-r from-blue-400 to-blue-600' : 
                            'bg-gradient-to-r from-gray-400 to-gray-500'
                          }`}
                          style={{ width: `${(c.rfm_total / 15) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{c.rfm_total}/15</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`
                      inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold
                      ${SEGMENTO_COLORS[c.segmento]?.bg || 'bg-slate-50 dark:bg-slate-800/50'}
                      ${SEGMENTO_COLORS[c.segmento]?.text || 'text-slate-700 dark:text-slate-300'}
                    `}>
                      {getSegmentoIcon(c.segmento)}
                      {c.segmento}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
        <p className="text-sm text-indigo-700">
          <span className="font-bold">📌 Insight:</span> RFM analysis segments customers by Recency, Frequency, and Monetary value. Focus retention efforts on "Champions" and re-engage "At Risk" segments with targeted campaigns.
        </p>
      </div>

      <p className="text-[10px] text-slate-400 dark:text-slate-500 text-right mt-2">Source: Bsale clients API • RFM computed weekly</p>
    </div>
  );
}
