'use client';
import { useEffect, useState } from 'react';
import { BarChart, AreaChart, Badge } from '@tremor/react';
import { TrendingUp, TrendingDown, Target, Zap, Calendar, ArrowRight, Sparkles, Brain } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DEMO_MODE } from '@/lib/demo-mode';
import { getDemoPredicciones } from '@/lib/demo-data';
import { formatCompact, Skeleton } from '@/components/ui';
import { Card3D, KPICard3D, Gauge3D, ProgressBar3D, Donut3D } from '@/components/charts3d';

interface Prediccion {
  prediccion_id: number;
  tipo: string;
  nivel: string;
  nombre: string;
  tienda: string;
  fecha_prediccion: string;
  periodo: string;
  valor_actual: number;
  valor_predicho: number;
  limite_inferior: number;
  limite_superior: number;
  tendencia: 'GROWTH' | 'STABLE' | 'DECLINE';
  confianza: number;
}

const TENDENCIA_COLORS: Record<string, { bg: string; text: string; icon: JSX.Element; gradient: string }> = {
  'GROWTH': { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: <TrendingUp className="w-4 h-4" />, gradient: 'from-emerald-400 to-teal-500' },
  'STABLE': { bg: 'bg-blue-50', text: 'text-blue-700', icon: <Target className="w-4 h-4" />, gradient: 'from-blue-400 to-cyan-500' },
  'DECLINE': { bg: 'bg-rose-50', text: 'text-rose-700', icon: <TrendingDown className="w-4 h-4" />, gradient: 'from-rose-400 to-red-500' }
};

const TENDENCIA_LABELS: Record<string, string> = {
  'GROWTH': 'GROWTH',
  'STABLE': 'STABLE',
  'DECLINE': 'DECLINE'
};

export default function PrediccionesPage() {
  const [predicciones, setPredicciones] = useState<Prediccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipoFiltro, setTipoFiltro] = useState<'ALL' | string>('ALL');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      if (DEMO_MODE) {
        setPredicciones(getDemoPredicciones() as any);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('predicciones')
        .select('*')
        .order('fecha_prediccion', { ascending: false })
        .limit(100);

      setPredicciones((data || []) as Prediccion[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const prediccionesFilt = predicciones
    .filter(p => tipoFiltro === 'ALL' || p.tipo === tipoFiltro);

  const tipos = Array.from(new Set(predicciones.map(p => p.tipo)));

  const totalPredicciones = prediccionesFilt.length;
  const promedioConfianza = prediccionesFilt.length > 0 
    ? prediccionesFilt.reduce((s, p) => s + (p.confianza || 0), 0) / prediccionesFilt.length 
    : 0;
  const crecimiento = prediccionesFilt.filter(p => p.tendencia === 'GROWTH').length;
  const decrecimiento = prediccionesFilt.filter(p => p.tendencia === 'DECLINE').length;

  const tendenciaDistribucion = prediccionesFilt.reduce((acc, p) => {
    const existing = acc.find(x => x.tendencia === p.tendencia);
    if (existing) {
      existing.cantidad++;
    } else {
      acc.push({ 
        tendencia: p.tendencia, 
        cantidad: 1,
        color: p.tendencia === 'GROWTH' ? '#10b981' : p.tendencia === 'DECLINE' ? '#f43f5e' : '#3b82f6'
      });
    }
    return acc;
  }, [] as { tendencia: string; cantidad: number; color: string }[]);

  const prediccionesVentas = prediccionesFilt.filter(p => p.tipo === 'venta' && p.nivel === 'tienda');

  if (loading) {
    return (
      <div className="p-6 min-h-screen flex items-center justify-center">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-purple-200 rounded-full animate-spin border-t-purple-600" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Brain className="w-8 h-8 text-purple-600" />
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
            <button
              onClick={() => setTipoFiltro('ALL')}
              className={`
                px-4 py-2 rounded-lg font-semibold transition-all duration-300
                ${tipoFiltro === 'ALL' 
                  ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-white/80'
                }
              `}
            >
              All
            </button>
            {tipos.map(t => (
              <button
                key={t}
                onClick={() => setTipoFiltro(t)}
                className={`
                  px-4 py-2 rounded-lg font-semibold transition-all duration-300 capitalize
                  ${tipoFiltro === t 
                    ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-white/80'
                  }
                `}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="animate-slide-in stagger-1" style={{ animationFillMode: 'backwards' }}>
          <KPICard3D
            title="Forecasts"
            value={totalPredicciones.toString()}
            subtitle="active models"
            icon={<Brain className="w-6 h-6" />}
            color="purple"
          />
        </div>
        <div className="animate-slide-in stagger-2" style={{ animationFillMode: 'backwards' }}>
          <KPICard3D
            title="Avg. Confidence"
            value={`${promedioConfianza.toFixed(0)}%`}
            subtitle="model accuracy"
            icon={<Target className="w-6 h-6" />}
            color="blue"
          />
        </div>
        <div className="animate-slide-in stagger-3" style={{ animationFillMode: 'backwards' }}>
          <KPICard3D
            title="Growing"
            value={crecimiento.toString()}
            subtitle="positive trends"
            icon={<TrendingUp className="w-6 h-6" />}
            color="green"
          />
        </div>
        <div className="animate-slide-in stagger-4" style={{ animationFillMode: 'backwards' }}>
          <KPICard3D
            title="Declining"
            value={decrecimiento.toString()}
            subtitle="need attention"
            icon={<TrendingDown className="w-6 h-6" />}
            color="red"
            delta={decrecimiento > 0 ? decrecimiento : undefined}
          />
        </div>
      </div>

      {/* Confidence Gauge + Trend Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card3D color="purple" hover={false}>
          <div className="flex flex-col items-center">
            <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-4">Model Confidence</h3>
            <Gauge3D 
              value={promedioConfianza} 
              max={100} 
              label={`${promedioConfianza.toFixed(0)}%`}
            />
            <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
              {promedioConfianza >= 80 ? '🎯 High accuracy' : 
               promedioConfianza >= 60 ? '✅ Good accuracy' : '⚠️ Moderate accuracy'}
            </p>
          </div>
        </Card3D>
        
        <div className="lg:col-span-2 card-3d p-6 animate-slide-in stagger-3" style={{ animationFillMode: 'backwards' }}>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-6">Distribution by Trend</h2>
          
          <div className="flex justify-center mb-6">
            <Donut3D
              data={tendenciaDistribucion.map(t => ({
                name: TENDENCIA_LABELS[t.tendencia] || t.tendencia,
                value: t.cantidad,
                color: t.color
              }))}
              size={180}
              thickness={40}
            />
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            {tendenciaDistribucion.map(t => (
              <div 
                key={t.tendencia}
                className={`p-4 rounded-xl ${TENDENCIA_COLORS[t.tendencia]?.bg} border ${
                  t.tendencia === 'GROWTH' ? 'border-emerald-200' :
                  t.tendencia === 'DECLINE' ? 'border-rose-200' : 'border-blue-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {TENDENCIA_COLORS[t.tendencia]?.icon}
                  <span className={`text-sm font-semibold ${TENDENCIA_COLORS[t.tendencia]?.text}`}>
                    {TENDENCIA_LABELS[t.tendencia] || t.tendencia}
                  </span>
                </div>
                <p className={`text-3xl font-black ${TENDENCIA_COLORS[t.tendencia]?.text}`}>
                  {t.cantidad}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sales Forecasts by Store */}
      {prediccionesVentas.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {prediccionesVentas.map((p) => (
            <Card3D 
              key={p.prediccion_id} 
              color="blue" 
              hover={false}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🎣</span>
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-200">Bluefishing</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{p.tipo} forecast</p>
                  </div>
                </div>
                <span className={`
                  inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold
                  ${TENDENCIA_COLORS[p.tendencia]?.bg} ${TENDENCIA_COLORS[p.tendencia]?.text}
                `}>
                  {TENDENCIA_COLORS[p.tendencia]?.icon}
                  {TENDENCIA_LABELS[p.tendencia] || p.tendencia}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-3 bg-white/50 rounded-xl">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Current Value</p>
                  <p className="text-xl font-black text-slate-700 dark:text-slate-300">{formatCompact(p.valor_actual)}</p>
                </div>
                <div className={`p-3 rounded-xl bg-gradient-to-r ${TENDENCIA_COLORS[p.tendencia]?.gradient}`}>
                  <p className="text-xs text-white/80 mb-1">Forecast</p>
                  <p className="text-xl font-black text-white">{formatCompact(p.valor_predicho)}</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between text-sm mb-3">
                <span className="text-slate-500 dark:text-slate-400">Confidence range:</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {formatCompact(p.limite_inferior)} - {formatCompact(p.limite_superior)}
                </span>
              </div>
              
              <ProgressBar3D
                value={p.confianza}
                max={100}
                label={`${p.confianza?.toFixed(0) || 0}% confidence`}
                color={p.confianza >= 80 ? 'green' : p.confianza >= 60 ? 'blue' : 'amber'}
              />
            </Card3D>
          ))}
        </div>
      )}

      {/* Confidence Range Chart */}
      <div className="card-3d p-6 animate-slide-in stagger-3" style={{ animationFillMode: 'backwards' }}>
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-5 h-5 text-purple-500" />
          <h3 className="font-bold text-slate-800 dark:text-slate-200">Forecast Confidence Ranges</h3>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Shaded area shows uncertainty range — wider band = less certainty</p>
        <BarChart
          data={prediccionesFilt.slice(0, 10).map(p => ({
            name: (p.nombre || p.nivel).slice(0, 20),
            'Lower Bound': p.limite_inferior,
            'Forecast': p.valor_predicho - p.limite_inferior,
            'Upper Range': p.limite_superior - p.valor_predicho,
          }))}
          index="name"
          categories={['Lower Bound', 'Forecast', 'Upper Range']}
          colors={['slate', 'purple', 'violet']}
          stack={true}
          className="h-72"
          valueFormatter={(v: number) => {
            if (v >= 1000000) return `$${(v/1000000).toFixed(1)}M`;
            if (v >= 1000) return `$${(v/1000).toFixed(0)}K`;
            return `$${v}`;
          }}
          showLegend={true}
        />
        <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-xl">
          <p className="text-sm text-purple-700">
            <span className="font-bold">🎯 Confidence:</span> Average model confidence is {promedioConfianza.toFixed(0)}%.
            {prediccionesFilt.filter(p => (p.confianza || 0) < 70).length > 0
              ? ` ${prediccionesFilt.filter(p => (p.confianza || 0) < 70).length} forecasts below 70% confidence — treat as directional estimates only.`
              : ' All models above 70% — predictions are reliable.'}
          </p>
        </div>
        <div className="flex gap-2 mt-2">
          <a href="/ventas" className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800">Current sales →</a>
          <a href="/inventario" className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800">Stock levels →</a>
        </div>
      </div>

      {/* All Forecasts List */}
      <div className="card-3d p-6 animate-slide-in stagger-4" style={{ animationFillMode: 'backwards' }}>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-6">All Forecasts</h2>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-slate-200 dark:border-slate-700">
                <th className="text-left py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Name</th>
                <th className="text-left py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Type</th>
                <th className="text-left py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Store</th>
                <th className="text-right py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Current</th>
                <th className="text-center py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400"></th>
                <th className="text-right py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Forecast</th>
                <th className="text-center py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Confidence</th>
                <th className="text-center py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Trend</th>
              </tr>
            </thead>
            <tbody>
              {prediccionesFilt.slice(0, 20).map((p) => {
                const cambio = p.valor_actual > 0 
                  ? ((p.valor_predicho - p.valor_actual) / p.valor_actual) * 100 
                  : 0;
                
                return (
                  <tr key={p.prediccion_id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className={`
                          w-10 h-10 rounded-xl flex items-center justify-center
                          bg-gradient-to-br ${TENDENCIA_COLORS[p.tendencia]?.gradient} text-white
                        `}>
                          {TENDENCIA_COLORS[p.tendencia]?.icon}
                        </div>
                        <div>
                          <span className="font-medium text-slate-800 dark:text-slate-200">{p.nombre || p.nivel}</span>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{p.periodo}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold capitalize">
                        {p.tipo}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                        Bluefishing
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right font-medium text-slate-700 dark:text-slate-300">
                      {formatCompact(p.valor_actual)}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <ArrowRight className={`w-5 h-5 ${
                        cambio > 0 ? 'text-emerald-500' : cambio < 0 ? 'text-rose-500' : 'text-slate-400 dark:text-slate-500'
                      }`} />
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className={`font-bold ${
                        cambio > 0 ? 'text-emerald-600' : cambio < 0 ? 'text-rose-600' : 'text-slate-600 dark:text-slate-400'
                      }`}>
                        {formatCompact(p.valor_predicho)}
                      </span>
                      <span className={`ml-2 text-xs ${
                        cambio > 0 ? 'text-emerald-500' : cambio < 0 ? 'text-rose-500' : 'text-slate-400 dark:text-slate-500'
                      }`}>
                        ({cambio > 0 ? '+' : ''}{cambio.toFixed(1)}%)
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              (p.confianza || 0) >= 80 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : 
                              (p.confianza || 0) >= 60 ? 'bg-gradient-to-r from-blue-400 to-blue-600' : 
                              'bg-gradient-to-r from-amber-400 to-amber-500'
                            }`}
                            style={{ width: `${p.confianza || 0}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{p.confianza?.toFixed(0) || 0}%</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`
                        inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold
                        ${TENDENCIA_COLORS[p.tendencia]?.bg} ${TENDENCIA_COLORS[p.tendencia]?.text}
                      `}>
                        {TENDENCIA_COLORS[p.tendencia]?.icon}
                        {TENDENCIA_LABELS[p.tendencia] || p.tendencia}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px] text-slate-400 dark:text-slate-500 text-right mt-2">Source: Prophet ML models • Updated daily</p>
    </div>
  );
}
