'use client';
import { useEffect, useState } from 'react';
import { Badge } from '@tremor/react';
import { Bell, AlertTriangle, AlertCircle, Info, CheckCircle, Clock, Package, TrendingDown, Users, X, Check, Filter } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DEMO_MODE } from '@/lib/demo-mode';
import { getDemoAlertas } from '@/lib/demo-data';
import { formatCompact, Skeleton } from '@/components/ui';
import { Card3D, KPICard3D, Gauge3D, ProgressBar3D, Donut3D } from '@/components/charts3d';

interface Alerta {
  alerta_id: number;
  tipo: string;
  prioridad: string;
  titulo: string;
  mensaje: string;
  tienda: string;
  producto_id: number | null;
  cliente_id: number | null;
  datos: Record<string, any> | null;
  accion_sugerida: string | null;
  estado: string;
  fecha_creacion: string;
  fecha_resolucion: string | null;
}

const PRIORIDAD_COLORS: Record<string, { bg: string; text: string; border: string; icon: JSX.Element; gradient: string }> = {
  'CRITICAL': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: <AlertCircle className="w-5 h-5" />, gradient: 'from-red-500 to-rose-600' },
  'HIGH': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', icon: <AlertTriangle className="w-5 h-5" />, gradient: 'from-orange-500 to-amber-600' },
  'MEDIUM': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: <Info className="w-5 h-5" />, gradient: 'from-amber-500 to-yellow-500' },
  'LOW': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: <Bell className="w-5 h-5" />, gradient: 'from-blue-500 to-cyan-500' }
};

const PRIORIDAD_LABELS: Record<string, string> = {
  'CRITICAL': 'CRITICAL',
  'HIGH': 'HIGH',
  'MEDIUM': 'MEDIUM',
  'LOW': 'LOW'
};

const TIPO_ICONS: Record<string, JSX.Element> = {
  'QUIEBRE_STOCK': <Package className="w-5 h-5" />,
  'STOCK_CRITICO': <Package className="w-5 h-5" />,
  'SOBRESTOCK': <Package className="w-5 h-5" />,
  'VENTA_INUSUAL': <TrendingDown className="w-5 h-5" />,
  'MORA_CLIENTE': <Users className="w-5 h-5" />,
  'MORA_CRITICA': <Users className="w-5 h-5" />,
  'FLUJO_CAJA_RIESGO': <TrendingDown className="w-5 h-5" />,
  'TENDENCIA_NEGATIVA': <TrendingDown className="w-5 h-5" />,
  'OPORTUNIDAD_VENTA': <TrendingDown className="w-5 h-5" />
};

export default function AlertasPage() {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [prioridadFiltro, setPrioridadFiltro] = useState<'ALL' | string>('ALL');
  const [estadoFiltro, setEstadoFiltro] = useState<'ALL' | 'ACTIVE' | 'RESOLVED'>('ALL');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      if (DEMO_MODE) {
        setAlertas(getDemoAlertas() as any);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('alertas')
        .select('*')
        .order('fecha_creacion', { ascending: false })
        .limit(100);

      setAlertas((data || []) as Alerta[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const resolverAlerta = async (alertaId: number) => {
    if (DEMO_MODE) {
      setAlertas(alertas.map(a => 
        a.alerta_id === alertaId 
          ? { ...a, estado: 'RESOLVED', fecha_resolucion: new Date().toISOString() } 
          : a
      ));
      return;
    }

    const { error } = await supabase
      .from('alertas')
      .update({ estado: 'RESOLVED', fecha_resolucion: new Date().toISOString() })
      .eq('alerta_id', alertaId);

    if (!error) {
      setAlertas(alertas.map(a => 
        a.alerta_id === alertaId 
          ? { ...a, estado: 'RESOLVED', fecha_resolucion: new Date().toISOString() }
          : a
      ));
    }
  };

  const alertasFilt = alertas
    .filter(a => prioridadFiltro === 'ALL' || a.prioridad === prioridadFiltro)
    .filter(a => estadoFiltro === 'ALL' || a.estado === estadoFiltro);

  const totalAlertas = alertasFilt.length;
  const alertasActivas = alertasFilt.filter(a => a.estado === 'ACTIVE').length;
  const alertasCriticas = alertasFilt.filter(a => a.prioridad === 'CRITICAL' && a.estado === 'ACTIVE').length;
  const alertasResueltas = alertasFilt.filter(a => a.estado === 'RESOLVED').length;

  const prioridadDistribucion = alertasFilt
    .filter(a => a.estado === 'ACTIVE')
    .reduce((acc, a) => {
      const existing = acc.find(x => x.prioridad === a.prioridad);
      if (existing) {
        existing.cantidad++;
      } else {
        acc.push({ 
          prioridad: a.prioridad, 
          cantidad: 1,
          color: a.prioridad === 'CRITICAL' ? '#ef4444' : 
                 a.prioridad === 'HIGH' ? '#f97316' : 
                 a.prioridad === 'MEDIUM' ? '#f59e0b' : '#3b82f6'
        });
      }
      return acc;
    }, [] as { prioridad: string; cantidad: number; color: string }[]);

  const tipoDistribucion = alertasFilt
    .filter(a => a.estado === 'ACTIVE')
    .reduce((acc, a) => {
      const existing = acc.find(x => x.tipo === a.tipo);
      if (existing) {
        existing.cantidad++;
      } else {
        acc.push({ tipo: a.tipo, cantidad: 1 });
      }
      return acc;
    }, [] as { tipo: string; cantidad: number }[]);

  if (loading) {
    return (
      <div className="p-6 min-h-screen flex items-center justify-center">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-red-200 rounded-full animate-spin border-t-red-600" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Bell className="w-8 h-8 text-red-600" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 min-h-screen">
      <div className="flex justify-end animate-slide-in">
        <div className="flex gap-3">
          <div className="card-glass p-2 flex gap-1">
            {(['ALL', 'ACTIVE', 'RESOLVED'] as const).map(e => (
              <button
                key={e}
                onClick={() => setEstadoFiltro(e)}
                className={`
                  px-4 py-2 rounded-lg font-semibold transition-all duration-300 flex items-center gap-2
                  ${estadoFiltro === e 
                    ? 'bg-gradient-to-r from-red-500 to-orange-600 text-white shadow-lg' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-white/80 dark:hover:bg-slate-700/80'
                  }
                `}
              >
                {e === 'ALL' ? '📋' : e === 'ACTIVE' ? '🔔' : '✅'}
                <span className="hidden md:inline">{e === 'ALL' ? 'All' : e === 'ACTIVE' ? 'Active' : 'Resolved'}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="animate-slide-in stagger-1" style={{ animationFillMode: 'backwards' }}>
          <KPICard3D
            title="Total Alerts"
            value={totalAlertas.toString()}
            subtitle="in the system"
            icon={<Bell className="w-6 h-6" />}
            color="blue"
          />
        </div>
        <div className="animate-slide-in stagger-2" style={{ animationFillMode: 'backwards' }}>
          <KPICard3D
            title="Active"
            value={alertasActivas.toString()}
            subtitle="pending"
            icon={<Clock className="w-6 h-6" />}
            color="amber"
            delta={alertasActivas > 0 ? alertasActivas : undefined}
          />
        </div>
        <div className="animate-slide-in stagger-3" style={{ animationFillMode: 'backwards' }}>
          <KPICard3D
            title="Critical"
            value={alertasCriticas.toString()}
            subtitle="urgent"
            icon={<AlertCircle className="w-6 h-6" />}
            color="red"
            delta={alertasCriticas > 0 ? alertasCriticas : undefined}
          />
        </div>
        <div className="animate-slide-in stagger-4" style={{ animationFillMode: 'backwards' }}>
          <KPICard3D
            title="Resolved"
            value={alertasResueltas.toString()}
            subtitle="fixed"
            icon={<CheckCircle className="w-6 h-6" />}
            color="green"
          />
        </div>
      </div>

      {/* Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* By Priority */}
        <Card3D color="red" hover={false}>
          <div className="flex flex-col items-center">
            <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-4">Active Alerts by Priority</h3>
            <Donut3D
              data={prioridadDistribucion.map(p => ({
                name: PRIORIDAD_LABELS[p.prioridad] || p.prioridad,
                value: p.cantidad,
                color: p.color
              }))}
              size={180}
              thickness={40}
            />
            <div className="mt-4 grid grid-cols-2 gap-2 w-full">
              {prioridadDistribucion.map(p => (
                <button
                  key={p.prioridad}
                  onClick={() => setPrioridadFiltro(prioridadFiltro === p.prioridad ? 'ALL' : p.prioridad)}
                  className={`
                    p-2 rounded-xl transition-all duration-300
                    ${prioridadFiltro === p.prioridad ? 'ring-2 ring-slate-400 dark:ring-slate-500' : ''}
                    ${PRIORIDAD_COLORS[p.prioridad]?.bg}
                  `}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${PRIORIDAD_COLORS[p.prioridad]?.text}`}>
                      {PRIORIDAD_LABELS[p.prioridad] || p.prioridad}
                    </span>
                    <span className={`text-lg font-black ${PRIORIDAD_COLORS[p.prioridad]?.text}`}>
                      {p.cantidad}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </Card3D>
        
        {/* By Type */}
        <div className="lg:col-span-2 card-3d p-6 animate-slide-in stagger-3" style={{ animationFillMode: 'backwards' }}>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-6">Active Alerts by Type</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {tipoDistribucion.map(t => (
              <div 
                key={t.tipo}
                className="p-4 bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all duration-300"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-400">
                    {TIPO_ICONS[t.tipo] || <Bell className="w-5 h-5" />}
                  </div>
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400 capitalize">{t.tipo.replace(/_/g, ' ')}</span>
                </div>
                <p className="text-3xl font-black text-slate-800 dark:text-slate-200">{t.cantidad}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alert List */}
      <div className="card-3d p-6 animate-slide-in stagger-4" style={{ animationFillMode: 'backwards' }}>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Alert List</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {prioridadFiltro !== 'ALL' && <span className="mr-2">Priority: {PRIORIDAD_LABELS[prioridadFiltro] || prioridadFiltro}</span>}
              {estadoFiltro !== 'ALL' && <span>Status: {estadoFiltro === 'ACTIVE' ? 'Active' : 'Resolved'}</span>}
              {prioridadFiltro === 'ALL' && estadoFiltro === 'ALL' && 'All alerts'}
            </p>
          </div>
          {(prioridadFiltro !== 'ALL' || estadoFiltro !== 'ALL') && (
            <button
              onClick={() => { setPrioridadFiltro('ALL'); setEstadoFiltro('ALL'); }}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:bg-slate-600 rounded-lg text-slate-600 dark:text-slate-400 font-medium transition-colors flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Clear filters
            </button>
          )}
        </div>

        <div className="space-y-6">
          {(() => {
            const grouped = alertasFilt.slice(0, 40).reduce((acc, alerta) => {
              const key = alerta.tipo;
              if (!acc[key]) acc[key] = [];
              acc[key].push(alerta);
              return acc;
            }, {} as Record<string, Alerta[]>);

            return Object.entries(grouped).map(([tipo, alerts]) => (
              <div key={tipo}>
                <div className="flex items-center gap-3 mb-3 px-1">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-400">
                    {TIPO_ICONS[tipo] || <Bell className="w-4 h-4" />}
                  </div>
                  <h3 className="font-bold text-slate-700 dark:text-slate-300 capitalize">{tipo.replace(/_/g, ' ')}</h3>
                  <span className="px-2.5 py-0.5 bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-400 rounded-full text-xs font-bold">{alerts.length}</span>
                </div>
                <div className="space-y-3 ml-4 border-l-2 border-slate-200 dark:border-slate-700 pl-4">
                  {alerts.map((alerta) => (
                    <div
                      key={alerta.alerta_id}
                      className={`
                        p-5 rounded-2xl border-2 transition-all duration-300
                        ${alerta.estado === 'RESOLVED'
                          ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 opacity-60'
                          : `${PRIORIDAD_COLORS[alerta.prioridad]?.bg} ${PRIORIDAD_COLORS[alerta.prioridad]?.border}`
                        }
                      `}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1">
                          <div className={`
                            w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0
                            ${alerta.estado === 'RESOLVED'
                              ? 'bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400'
                              : `bg-gradient-to-br ${PRIORIDAD_COLORS[alerta.prioridad]?.gradient} text-white shadow-lg`
                            }
                          `}>
                            {alerta.estado === 'RESOLVED'
                              ? <CheckCircle className="w-6 h-6" />
                              : TIPO_ICONS[alerta.tipo] || PRIORIDAD_COLORS[alerta.prioridad]?.icon
                            }
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 flex-wrap mb-2">
                              <h3 className={`font-bold text-lg ${alerta.estado === 'RESOLVED' ? 'text-slate-500 dark:text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>
                                {alerta.titulo}
                              </h3>
                              <span className={`
                                px-3 py-1 rounded-full text-xs font-bold
                                ${PRIORIDAD_COLORS[alerta.prioridad]?.bg} ${PRIORIDAD_COLORS[alerta.prioridad]?.text}
                              `}>
                                {PRIORIDAD_LABELS[alerta.prioridad] || alerta.prioridad}
                              </span>
                            </div>
                            <p className={`text-sm ${alerta.estado === 'RESOLVED' ? 'text-slate-400 dark:text-slate-500' : 'text-slate-600 dark:text-slate-400'} mb-3`}>
                              {alerta.mensaje}
                            </p>
                            {alerta.accion_sugerida && (
                              <p className="text-xs text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg inline-block mb-2">
                                💡 {alerta.accion_sugerida}
                              </p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(alerta.fecha_creacion).toLocaleDateString('en-US', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                              <span className="capitalize">{alerta.tipo.replace(/_/g, ' ')}</span>
                              {alerta.datos && (
                                <span>
                                  {alerta.datos.stock !== undefined && `Stock: ${alerta.datos.stock} units`}
                                  {alerta.datos.monto !== undefined && `Amount: ${formatCompact(alerta.datos.monto)}`}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {alerta.estado === 'ACTIVE' && (
                          <button
                            onClick={() => resolverAlerta(alerta.alerta_id)}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold transition-colors shadow-lg shadow-emerald-500/30"
                          >
                            <Check className="w-4 h-4" />
                            Resolve
                          </button>
                        )}

                        {alerta.estado === 'RESOLVED' && (
                          <span className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400 rounded-xl font-semibold">
                            <CheckCircle className="w-4 h-4" />
                            Resolved
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ));
          })()}

          {alertasFilt.length === 0 && (
            <div className="text-center py-12">
              <Bell className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-500 mb-4" />
              <h3 className="text-xl font-bold text-slate-400 dark:text-slate-500">No alerts</h3>
              <p className="text-slate-400 dark:text-slate-500">All systems are running correctly</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
        <p className="text-sm text-indigo-700">
          <span className="font-bold">📌 Pattern:</span> {alertasCriticas > 0 ? `${alertasCriticas} critical alerts need immediate action. ` : 'No critical alerts. '}
          Most common type: {tipoDistribucion.length > 0 ? tipoDistribucion.sort((a,b) => b.cantidad - a.cantidad)[0]?.tipo.replace(/_/g, ' ') : 'none'}.
          {alertasResueltas > 0 ? ` ${alertasResueltas} resolved — ${Math.round((alertasResueltas/totalAlertas)*100)}% resolution rate.` : ''}
        </p>
      </div>
      <div className="flex gap-2 mt-2">
        <a href="/inventario" className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800">Inventory →</a>
        <a href="/cobranza" className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800">Collections →</a>
        <a href="/predicciones" className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800">Forecasts →</a>
      </div>

      <p className="text-[10px] text-slate-400 dark:text-slate-500 text-right mt-2">Source: Bsale API • Auto-generated alerts</p>
    </div>
  );
}
