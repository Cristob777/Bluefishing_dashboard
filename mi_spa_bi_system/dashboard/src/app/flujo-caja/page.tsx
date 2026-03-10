'use client';
import { useEffect, useState } from 'react';
import { AreaChart, BarChart, DonutChart } from '@tremor/react';
import { DollarSign, TrendingUp, TrendingDown, CreditCard, RotateCcw, Wallet, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DEMO_MODE } from '@/lib/demo-mode';
import { getDemoFlujoCaja } from '@/lib/demo-data';
import { Card3D, KPICard3D, ProgressBar3D } from '@/components/charts3d';
import { formatCompact } from '@/components/ui';

interface FlujoCaja {
  fecha: string;
  tienda: string;
  ventas: number;
  pagos_recibidos: number;
  devoluciones: number;
  venta_neta: number;
  flujo_neto: number;
}

interface PagoPeriodo {
  mes: string;
  periodo: string;
  tienda: string;
  metodo_pago: string;
  num_pagos: number;
  total_pagado: number;
}

interface DevolucionPeriodo {
  mes: string;
  periodo: string;
  tienda: string;
  tipo: string;
  num_devoluciones: number;
  unidades_devueltas: number;
  total_devuelto: number;
}

export default function FlujoCajaPage() {
  const [flujo, setFlujo] = useState<FlujoCaja[]>([]);
  const [pagos, setPagos] = useState<PagoPeriodo[]>([]);
  const [devoluciones, setDevoluciones] = useState<DevolucionPeriodo[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      if (DEMO_MODE) {
        const mock = getDemoFlujoCaja();
        setFlujo(mock.flujo as any);
        setPagos(mock.pagos as any);
        setDevoluciones(mock.devoluciones as any);
        setLoading(false);
        return;
      }

      const [flujoRes, pagosRes, devolRes] = await Promise.all([
        supabase.from('v_flujo_caja').select('*').order('fecha', { ascending: false }),
        supabase.from('v_pagos_periodo').select('*').order('mes', { ascending: false }).limit(20),
        supabase.from('v_devoluciones_periodo').select('*').order('mes', { ascending: false }).limit(20)
      ]);
      
      setFlujo((flujoRes.data || []) as FlujoCaja[]);
      setPagos((pagosRes.data || []) as PagoPeriodo[]);
      setDevoluciones((devolRes.data || []) as DevolucionPeriodo[]);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const flujoFilt = flujo;
  const pagosFilt = pagos;
  const devolFilt = devoluciones;

  const totalVentas = flujoFilt.reduce((a, f) => a + (f.ventas || 0), 0);
  const totalPagos = flujoFilt.reduce((a, f) => a + (f.pagos_recibidos || 0), 0);
  const totalDevoluciones = flujoFilt.reduce((a, f) => a + (f.devoluciones || 0), 0);
  const ventaNeta = totalVentas - totalDevoluciones;
  const flujoNeto = totalPagos - totalDevoluciones;
  const tasaDevolucion = totalVentas > 0 ? (totalDevoluciones / totalVentas) * 100 : 0;

  const chartData = flujoFilt
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .reduce((acc, f) => {
      const existing = acc.find(a => a.fecha === f.fecha);
      if (existing) {
        existing.ventas = (existing.ventas || 0) + f.ventas;
        existing.pagos = (existing.pagos || 0) + f.pagos_recibidos;
        existing.devoluciones = (existing.devoluciones || 0) + f.devoluciones;
      } else {
        acc.push({
          fecha: f.fecha,
          ventas: f.ventas,
          pagos: f.pagos_recibidos,
          devoluciones: f.devoluciones
        });
      }
      return acc;
    }, [] as any[]);

  const metodosPago = pagosFilt.reduce((acc, p) => {
    const key = p.metodo_pago || 'Other';
    const existing = acc.find(a => a.name === key);
    if (existing) {
      existing.value += p.total_pagado;
    } else {
      acc.push({ name: key, value: p.total_pagado });
    }
    return acc;
  }, [] as { name: string; value: number }[]).sort((a, b) => b.value - a.value);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="w-16 h-16 border-4 border-blue-200 rounded-full animate-spin border-t-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 min-h-screen">
      <div className="flex justify-end">
        <button onClick={loadData} className="btn-3d flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Main KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <KPICard3D
          title="Gross Sales"
          value={formatCompact(totalVentas)}
          subtitle="last 30 days • vs prev. period"
          icon={<DollarSign className="w-6 h-6" />}
          color="green"
        />
        <KPICard3D
          title="Payments Received"
          value={formatCompact(totalPagos)}
          subtitle="Effective collections"
          icon={<CreditCard className="w-6 h-6" />}
          color="blue"
        />
        <KPICard3D
          title="Returns"
          value={formatCompact(totalDevoluciones)}
          delta={-tasaDevolucion}
          subtitle="of total sales"
          icon={<RotateCcw className="w-6 h-6" />}
          color="red"
        />
        <KPICard3D
          title="Net Sales"
          value={formatCompact(ventaNeta)}
          subtitle="Sales - Returns"
          icon={<TrendingUp className="w-6 h-6" />}
          color="purple"
        />
        <KPICard3D
          title="Net Flow"
          value={formatCompact(flujoNeto)}
          subtitle="Payments - Returns"
          icon={flujoNeto >= 0 ? <ArrowUpRight className="w-6 h-6" /> : <ArrowDownRight className="w-6 h-6" />}
          color={flujoNeto >= 0 ? 'green' : 'red'}
        />
      </div>

      {/* Cash Flow Chart */}
      <Card3D className="p-6">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Cash Flow Evolution</h2>
        <div className="h-80">
          <AreaChart
            data={chartData}
            index="fecha"
            categories={['ventas', 'pagos', 'devoluciones']}
            colors={['emerald', 'blue', 'rose']}
            valueFormatter={formatCompact}
            showAnimation
            curveType="monotone"
          />
        </div>
        <div className="flex justify-center gap-8 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-emerald-500" />
            <span className="text-sm text-slate-600 dark:text-slate-400">Sales</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-500" />
            <span className="text-sm text-slate-600 dark:text-slate-400">Payments</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-rose-500" />
            <span className="text-sm text-slate-600 dark:text-slate-400">Returns</span>
          </div>
        </div>
      </Card3D>

      <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
        <p className="text-sm text-emerald-700">
          <span className="font-bold">💰 Cash Flow:</span> Monitor daily inflows vs outflows to anticipate liquidity gaps. The shaded area between income and expenses shows your operating margin. Dips below the zero line indicate cash-negative days — plan reserves accordingly.
        </p>
      </div>

      {/* Second Row: Payment Methods and Returns Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Methods */}
        <Card3D className="p-6">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-blue-600" />
            Payment Methods
          </h2>
          
          {metodosPago.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No payment data available</p>
              <p className="text-sm mt-1">Run the ETL to sync payments from Bsale</p>
            </div>
          ) : (
            <>
              <div className="flex justify-center mb-6">
                <DonutChart
                  data={metodosPago}
                  category="value"
                  index="name"
                  valueFormatter={formatCompact}
                  colors={['blue', 'cyan', 'indigo', 'violet', 'purple']}
                  className="h-52"
                />
              </div>
              <div className="space-y-3">
                {metodosPago.slice(0, 5).map((m, idx) => (
                  <div key={m.name} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full bg-${['blue', 'cyan', 'indigo', 'violet', 'purple'][idx]}-500`} />
                      <span className="font-medium text-slate-800 dark:text-slate-200">{m.name}</span>
                    </div>
                    <span className="font-bold text-slate-900 dark:text-white">{formatCompact(m.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card3D>

        {/* Returns Analysis */}
        <Card3D className="p-6">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-rose-600" />
            Returns Analysis
          </h2>
          
          {devolFilt.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              <RotateCcw className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No returns data available</p>
              <p className="text-sm mt-1">Run the ETL to sync credit notes</p>
            </div>
          ) : (
            <>
              {/* Return rate indicator */}
              <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-rose-50 to-rose-100/50 border border-rose-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Return Rate</span>
                  <span className={`text-2xl font-black ${tasaDevolucion > 5 ? 'text-rose-600' : 'text-green-600'}`}>
                    {tasaDevolucion.toFixed(1)}%
                  </span>
                </div>
                <div className="h-3 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      tasaDevolucion > 5 ? 'bg-gradient-to-r from-rose-400 to-rose-600' : 'bg-gradient-to-r from-green-400 to-green-600'
                    }`}
                    style={{ width: `${Math.min(tasaDevolucion * 10, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  {tasaDevolucion > 5 ? '⚠️ Rate above average (5%)' : '✅ Healthy rate'}
                </p>
              </div>

              {/* Returns list by period */}
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {devolFilt.slice(0, 10).map((d, idx) => (
                  <div key={`${d.mes}-${d.tienda}-${idx}`} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-200">{d.periodo}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{d.num_devoluciones} returns • {d.unidades_devueltas} units</p>
                    </div>
                    <span className="font-bold text-rose-600">{formatCompact(d.total_devuelto)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card3D>
      </div>

      {/* Visual Summary */}
      <Card3D className="p-6">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-6">Flow Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Sales */}
          <div className="text-center p-6 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200">
            <DollarSign className="w-12 h-12 mx-auto text-emerald-600 mb-3" />
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Gross Sales</p>
            <p className="text-3xl font-black text-emerald-700">{formatCompact(totalVentas)}</p>
            <div className="mt-3 flex items-center justify-center gap-2 text-emerald-600">
              <ArrowUpRight className="w-4 h-4" />
              <span className="text-sm font-medium">Revenue</span>
            </div>
          </div>

          {/* Operation */}
          <div className="text-center p-6 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-800 dark:to-slate-700/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-center gap-4 mb-3">
              <span className="text-3xl">➖</span>
              <RotateCcw className="w-8 h-8 text-rose-500" />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Returns</p>
            <p className="text-2xl font-black text-rose-600">{formatCompact(totalDevoluciones)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{tasaDevolucion.toFixed(1)}% of total</p>
          </div>

          {/* Result */}
          <div className={`text-center p-6 rounded-2xl border ${
            ventaNeta >= 0 
              ? 'bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200' 
              : 'bg-gradient-to-br from-rose-50 to-rose-100/50 border-rose-200'
          }`}>
            <Wallet className={`w-12 h-12 mx-auto mb-3 ${ventaNeta >= 0 ? 'text-blue-600' : 'text-rose-600'}`} />
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Net Sales</p>
            <p className={`text-3xl font-black ${ventaNeta >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>
              {formatCompact(ventaNeta)}
            </p>
            <div className={`mt-3 flex items-center justify-center gap-2 ${ventaNeta >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
              {ventaNeta >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span className="text-sm font-medium">Result</span>
            </div>
          </div>
        </div>
      </Card3D>

      <p className="text-[10px] text-slate-400 dark:text-slate-500 text-right mt-2">Source: Bsale payments + expenses API • Synced daily</p>
    </div>
  );
}
