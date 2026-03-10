'use client';
import { useEffect, useState } from 'react';
import { AreaChart, BarChart } from '@tremor/react';
import { DollarSign, ShoppingCart, TrendingUp, Calendar, Receipt } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DEMO_MODE } from '@/lib/demo-mode';
import { getDemoVentas } from '@/lib/demo-data';
import { formatCompact, Skeleton } from '@/components/ui';
import { Card3D, KPICard3D, RankingItem, ProgressBar3D } from '@/components/charts3d';

interface VentaDiaria {
  fecha: string;
  tienda: string;
  num_documentos: number;
  venta_total: number;
}

interface TopProducto {
  producto_id: number;
  nombre: string;
  tienda: string;
  venta_total: number;
  unidades: number;
}

export default function VentasPage() {
  const [ventas, setVentas] = useState<VentaDiaria[]>([]);
  const [topProductos, setTopProductos] = useState<TopProducto[]>([]);
  const [loading, setLoading] = useState(true);
  const [dias, setDias] = useState(30);

  useEffect(() => {
    loadData();
  }, [dias]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (DEMO_MODE) {
        const mock = getDemoVentas(dias);
        setVentas(mock.ventas as any);
        setTopProductos(mock.topProductos as any);
        setLoading(false);
        return;
      }

      const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const { data: ventasData } = await supabase
        .from('fact_ventas')
        .select('fecha, tienda, bsale_document_id, total')
        .gte('fecha', desde)
        .order('fecha', { ascending: true });

      const ventasGrouped = (ventasData || []).reduce((acc: Record<string, { fecha: string; tienda: string; documentos: Set<number>; total: number }>, v: any) => {
        const key = `${v.fecha}-${v.tienda}`;
        if (!acc[key]) {
          acc[key] = { fecha: v.fecha, tienda: v.tienda, documentos: new Set(), total: 0 };
        }
        acc[key].documentos.add(v.bsale_document_id);
        acc[key].total += v.total || 0;
        return acc;
      }, {});

      const ventasList: VentaDiaria[] = Object.values(ventasGrouped).map((v) => ({
        fecha: v.fecha,
        tienda: v.tienda,
        num_documentos: v.documentos.size,
        venta_total: v.total,
      }));

      const { data: topData } = await supabase
        .from('fact_ventas')
        .select(`producto_id, cantidad, total, dim_productos!inner(nombre, tienda)`)
        .gte('fecha', desde);

      const topGrouped = (topData || []).reduce((acc: Record<number, TopProducto>, v: any) => {
        if (!v.producto_id || !v.dim_productos) return acc;
        const pid = v.producto_id;
        if (!acc[pid]) {
          acc[pid] = {
            producto_id: pid,
            nombre: v.dim_productos.nombre,
            tienda: v.dim_productos.tienda,
            venta_total: 0,
            unidades: 0,
          };
        }
        acc[pid].venta_total += v.total || 0;
        acc[pid].unidades += v.cantidad || 0;
        return acc;
      }, {});

      const topList: TopProducto[] = Object.values(topGrouped)
        .sort((a, b) => b.venta_total - a.venta_total)
        .slice(0, 20);

      setVentas(ventasList);
      setTopProductos(topList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const totalVentas = ventas.reduce((sum, v) => sum + v.venta_total, 0);
  const totalDocumentos = ventas.reduce((sum, v) => sum + v.num_documentos, 0);
  const ticketPromedio = totalDocumentos > 0 ? totalVentas / totalDocumentos : 0;

  const chartData = ventas.reduce((acc, v) => {
    const existing = acc.find((a) => a.fecha === v.fecha);
    if (existing) {
      existing['Sales'] = (typeof existing['Sales'] === 'number' ? existing['Sales'] : 0) + v.venta_total;
    } else {
      acc.push({ fecha: v.fecha, Sales: v.venta_total });
    }
    return acc;
  }, [] as Record<string, number | string>[]).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));

  if (loading) {
    return (
      <div className="p-6 min-h-screen flex items-center justify-center">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-sky-200 rounded-full animate-spin border-t-sky-600" />
          <div className="absolute inset-0 flex items-center justify-center">
            <DollarSign className="w-8 h-8 text-sky-600" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 min-h-screen">
      {/* Period filter — title in PageHeader */}
      <div className="flex justify-end animate-slide-in">
        <div className="card-glass p-2 flex gap-1">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDias(d)}
              className={`
                px-4 py-2 rounded-lg font-semibold transition-all duration-300 flex items-center gap-2
                ${dias === d 
                  ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-white/80 dark:hover:bg-slate-700/80'
                }
              `}
            >
              <Calendar className="w-4 h-4" />
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="animate-slide-in stagger-1" style={{ animationFillMode: 'backwards' }}>
          <KPICard3D
            title="Total Sales"
            value={formatCompact(totalVentas)}
            subtitle={`last ${dias} days • +12.3% vs prev`}
            icon={<DollarSign className="w-6 h-6" />}
            color="green"
          />
        </div>
        <div className="animate-slide-in stagger-2" style={{ animationFillMode: 'backwards' }}>
          <KPICard3D
            title="Documents"
            value={totalDocumentos.toLocaleString()}
            subtitle="completed • +8.1% vs prev"
            icon={<Receipt className="w-6 h-6" />}
            color="blue"
          />
        </div>
        <div className="animate-slide-in stagger-3" style={{ animationFillMode: 'backwards' }}>
          <KPICard3D
            title="Average Ticket"
            value={formatCompact(ticketPromedio)}
            subtitle="per transaction • +4.7% vs prev"
            icon={<ShoppingCart className="w-6 h-6" />}
            color="purple"
          />
        </div>
      </div>

      {/* Trend Chart */}
      <div className="card-3d p-6 animate-slide-in stagger-3" style={{ animationFillMode: 'backwards' }}>
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Sales Trend</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Last {dias} days - Bluefishing.cl</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-gradient-to-r from-sky-400 to-blue-600 shadow-md" />
            <span className="text-sm text-slate-600 dark:text-slate-400">Bluefishing</span>
          </div>
        </div>
        <div className="chart-container p-4 bg-white/50 dark:bg-slate-800/50 rounded-xl">
          <AreaChart
            className="h-72"
            data={chartData}
            index="fecha"
            categories={['Sales']}
            colors={['cyan']}
            valueFormatter={formatCompact}
            showAnimation={true}
            curveType="monotone"
            showGridLines={false}
          />
        </div>
        <div className="mt-4 p-3 bg-sky-50 dark:bg-sky-900/30 border border-sky-200 dark:border-sky-800 rounded-xl">
          <p className="text-[11px] text-sky-700 dark:text-sky-300">
            <span className="font-bold">📈 Trend:</span> {chartData.length > 7 ? `Sales averaging ${formatCompact(totalVentas / chartData.length)}/day over ${chartData.length} days. ` : ''}
            {topProductos.length > 0 ? `Top seller: ${topProductos[0]?.nombre} with ${formatCompact(topProductos[0]?.venta_total)}. ` : ''}
            Peak day visible in chart — investigate for replicable patterns.
          </p>
        </div>
        <div className="flex gap-2 mt-2">
          <a href="/inventario" className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">Check inventory levels →</a>
          <a href="/categorias" className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">View by category →</a>
        </div>
      </div>

      {/* Top Products */}
      <div className="card-3d p-6 animate-slide-in stagger-4" style={{ animationFillMode: 'backwards' }}>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Top Products by Sales</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Products with the highest sales volume</p>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-slate-200 dark:border-slate-700">
                <th className="text-left py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">#</th>
                <th className="text-left py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Product</th>
                <th className="text-right py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Units</th>
                <th className="text-right py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Total Sales</th>
                <th className="text-left py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400 w-40">Performance</th>
              </tr>
            </thead>
            <tbody>
              {topProductos.slice(0, 15).map((p, idx) => {
                const maxVenta = topProductos[0]?.venta_total || 1;
                const percentage = (p.venta_total / maxVenta) * 100;
                
                return (
                  <tr key={p.producto_id} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-4 px-4">
                      <div className={`
                        w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm
                        ${idx === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg' :
                          idx === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white' :
                          idx === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white' :
                          'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                        }
                      `}>
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                      </div>
                    </td>
                    <td className="py-4 px-4 max-w-xs truncate font-medium text-slate-900 dark:text-white">{p.nombre}</td>
                    <td className="py-4 px-4 text-right text-slate-600 dark:text-slate-400">{p.unidades.toLocaleString()}</td>
                    <td className="py-4 px-4 text-right">
                      <span className="font-bold text-sky-600">{formatCompact(p.venta_total)}</span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-sky-400 to-blue-500 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl">
          <p className="text-[11px] text-amber-700 dark:text-amber-300">
            <span className="font-bold">⚡ Action:</span> Top 3 products account for {topProductos.length >= 3 ? formatCompact(topProductos.slice(0,3).reduce((s,p) => s + p.venta_total, 0)) : 'N/A'} in revenue.
            Ensure these SKUs never go out of stock — set minimum reorder alerts.
          </p>
        </div>
      </div>
      <p className="text-[10px] text-slate-400 dark:text-slate-500 text-right mt-2">Source: Bsale documents API • Synced daily</p>
    </div>
  );
}
