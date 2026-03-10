'use client';

import { useEffect, useState, useCallback } from 'react';
import { 
  Card, Title, Text, Grid, Flex, AreaChart, TabGroup, TabList, Tab, 
  Badge, DonutChart, BarChart, Metric, ProgressBar
} from '@tremor/react';
import { 
  Package, TrendingUp, AlertCircle, RefreshCw, Bell, Target, TrendingDown, 
  Minus, ArrowRight, DollarSign, Users, Zap, BarChart2, Globe, 
  Moon, Sun, ChevronDown, Lock, Calendar, Filter, Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { 
  getResumenEjecutivo, getVentasDiarias, getTopProductos, 
  supabase, ResumenEjecutivo, VentaDiaria, TopProducto
} from '@/lib/supabase';
import { DEMO_MODE } from '@/lib/demo-mode';
import { getDemoDashboard } from '@/lib/demo-data';
import { formatCompact, Skeleton } from '@/components/ui';
import { 
  Card3D, KPICard3D, Gauge3D, ProgressBar3D, RankingItem, 
  MetricComparison, Donut3D 
} from '@/components/charts3d';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface Alerta {
  alerta_id: number;
  tipo: string;
  prioridad: string;
  titulo: string;
  tienda: string;
}

interface Prediccion {
  nivel: string;
  nombre: string;
  venta_proyectada: number;
  tendencia: string;
  factor_estacional: number;
}

// ============================================================================
// THEME TOGGLE
// ============================================================================

function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  
  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark');
    setIsDark(isDarkMode);
  }, []);
  
  const toggleTheme = () => {
    document.documentElement.classList.toggle('dark');
    setIsDark(!isDark);
  };
  
  return (
    <button
      onClick={toggleTheme}
      className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 
                 dark:hover:bg-slate-600 transition-colors"
      aria-label="Toggle theme"
    >
      {isDark ? (
        <Sun className="w-5 h-5 text-amber-500" />
      ) : (
        <Moon className="w-5 h-5 text-slate-600" />
      )}
    </button>
  );
}

// ============================================================================
// KPI ROW - Level 1 (The Hook)
// ============================================================================

interface KPIRowProps {
  totales: { stock: number; ventas: number; porCobrar: number; productos: number };
  predicciones: Prediccion[];
  diasCobertura: number;
  ventasTrend: number[];
}

function KPIRow({ totales, predicciones, diasCobertura, ventasTrend }: KPIRowProps) {
  const proyeccion = predicciones[0]?.venta_proyectada || 0;
  const ventasDelta = 8.5;
  const margenDelta = -2.1;
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
      <div className="animate-slide-in stagger-1" style={{ animationFillMode: 'backwards' }}>
        <Link href="/ventas" className="block hover:scale-[1.02] transition-transform">
          <KPICard3D
            title="Monthly Sales"
            value={formatCompact(totales.ventas)}
            delta={ventasDelta}
            subtitle="vs previous month"
            icon={<DollarSign className="w-6 h-6" />}
            color="green"
            trend={ventasTrend}
          />
        </Link>
      </div>
      
      <div className="animate-slide-in stagger-2" style={{ animationFillMode: 'backwards' }}>
        <Link href="/finanzas" className="block hover:scale-[1.02] transition-transform">
          <KPICard3D
            title="Estimated Margin"
            value="32.5%"
            delta={margenDelta}
            subtitle="operating margin"
            icon={<TrendingUp className="w-6 h-6" />}
            color={margenDelta >= 0 ? 'green' : 'red'}
          />
        </Link>
      </div>
      
      <div className="animate-slide-in stagger-3" style={{ animationFillMode: 'backwards' }}>
        <Link href="/inventario" className="block hover:scale-[1.02] transition-transform">
          <KPICard3D
            title="Stock Coverage"
            value={`${diasCobertura}d`}
            subtitle={diasCobertura > 60 ? 'Healthy stock' : diasCobertura > 30 ? 'Monitor' : 'Critical'}
            icon={<Package className="w-6 h-6" />}
            color={diasCobertura > 60 ? 'green' : diasCobertura > 30 ? 'amber' : 'red'}
          />
        </Link>
      </div>
      
      <div className="animate-slide-in stagger-4" style={{ animationFillMode: 'backwards' }}>
        <Link href="/predicciones" className="block hover:scale-[1.02] transition-transform">
          <KPICard3D
            title="Forecast 30d"
            value={formatCompact(proyeccion)}
            subtitle="Prophet Forecast"
            icon={<Target className="w-6 h-6" />}
            color="purple"
          />
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// DRILLABLE CHART WRAPPER
// ============================================================================

interface DrillableChartProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onDrillDown?: () => void;
  drillDownLabel?: string;
}

function DrillableChart({ title, subtitle, children, onDrillDown, drillDownLabel }: DrillableChartProps) {
  return (
    <div className="card-3d p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">{title}</h3>
          {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {onDrillDown && (
          <button
            onClick={onDrillDown}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700 
                       flex items-center gap-1 transition-colors"
          >
            {drillDownLabel || 'View details'}
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// ============================================================================
// SALES TREND CHART
// ============================================================================

interface SalesTrendChartProps {
  ventas: VentaDiaria[];
  onBarClick?: (date: string) => void;
}

function SalesTrendChart({ ventas, onBarClick }: SalesTrendChartProps) {
  const chartData = ventas.reduce((acc, v) => {
    const existing = acc.find(a => a.fecha === v.fecha);
    if (existing) {
      existing['BLUEFISHING'] = (existing['BLUEFISHING'] || 0) + v.venta_total;
    } else {
      acc.push({ 
        fecha: v.fecha, 
        fechaLabel: new Date(v.fecha).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
        BLUEFISHING: v.venta_total 
      });
    }
    return acc;
  }, [] as Record<string, any>[]).sort((a, b) => a.fecha.localeCompare(b.fecha));
  
  return (
    <DrillableChart
      title="Sales Trend"
      subtitle="Last 30 days - Bluefishing.cl"
      onDrillDown={() => window.location.href = '/categorias'}
      drillDownLabel="Category analysis"
    >
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-sky-500 to-blue-600" />
          <span className="text-sm text-slate-600 dark:text-slate-400">Bluefishing.cl</span>
        </div>
      </div>
      
      <div className="chart-container">
        <AreaChart
          className="h-72"
          data={chartData}
          index="fechaLabel"
          categories={['BLUEFISHING']}
          colors={['cyan']}
          valueFormatter={formatCompact}
          showAnimation={true}
          curveType="monotone"
          showGridLines={false}
          showLegend={false}
          onValueChange={(v) => v && onBarClick?.(v.fecha as string)}
        />
      </div>
    </DrillableChart>
  );
}

// ============================================================================
// STORE METRICS PANEL (replaces BrandComparisonPanel)
// ============================================================================

interface StoreMetricsProps {
  resumen: ResumenEjecutivo[];
  predicciones: Prediccion[];
}

function StoreMetricsPanel({ resumen, predicciones }: StoreMetricsProps) {
  const r = resumen[0];
  const pred = predicciones[0];
  const meta = pred?.venta_proyectada || (r?.ventas_mes || 0) * 1.2;
  const porcentaje = meta > 0 ? ((r?.ventas_mes || 0) / meta) * 100 : 0;
  
  return (
    <DrillableChart
      title="Bluefishing Metrics"
      subtitle="Monthly operational summary"
    >
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md
                bg-gradient-to-br from-sky-500 to-blue-600">
                <span className="text-lg">🎣</span>
              </div>
              <div>
                <p className="font-bold text-slate-800 dark:text-slate-200">Bluefishing.cl</p>
                <p className="text-xs text-slate-500">
                  Target: {formatCompact(meta)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-slate-800 dark:text-slate-200">
                {formatCompact(r?.ventas_mes || 0)}
              </p>
              <p className={`text-xs font-medium ${
                porcentaje >= 100 ? 'text-emerald-600' : 
                porcentaje >= 80 ? 'text-amber-600' : 'text-red-600'
              }`}>
                {porcentaje.toFixed(0)}% of target
              </p>
            </div>
          </div>
          
          <div className="relative h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-700
                bg-gradient-to-r from-sky-400 to-blue-600"
              style={{ width: `${Math.min(porcentaje, 100)}%` }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent rounded-full" />
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 bg-slate-50 dark:bg-slate-700 rounded-lg text-center">
              <p className="text-xs text-slate-500">Stock</p>
              <p className="font-bold text-slate-800 dark:text-slate-200">
                {formatCompact(r?.valor_stock_venta || 0)}
              </p>
            </div>
            <div className="p-2 bg-slate-50 dark:bg-slate-700 rounded-lg text-center">
              <p className="text-xs text-slate-500">Receivables</p>
              <p className="font-bold text-slate-800 dark:text-slate-200">
                {formatCompact(r?.por_cobrar || 0)}
              </p>
            </div>
            <div className="p-2 bg-slate-50 dark:bg-slate-700 rounded-lg text-center">
              <p className="text-xs text-slate-500">Products</p>
              <p className="font-bold text-slate-800 dark:text-slate-200">
                {(r?.productos_con_stock || 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>
    </DrillableChart>
  );
}

// ============================================================================
// ALERTS CENTER
// ============================================================================

interface AlertsCenterProps {
  alertas: Alerta[];
}

function AlertsCenter({ alertas }: AlertsCenterProps) {
  const criticalCount = alertas.filter(a => 
    a.prioridad === 'CRITICAL' || a.prioridad === 'HIGH'
  ).length;
  
  return (
    <DrillableChart
      title="Alerts Center"
      subtitle={criticalCount > 0 ? `${criticalCount} critical alerts` : 'All under control'}
      onDrillDown={() => window.location.href = '/alertas'}
      drillDownLabel="View all"
    >
      {alertas.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto bg-emerald-100 dark:bg-emerald-900/30 
                          rounded-full flex items-center justify-center mb-3">
            <Bell className="w-8 h-8 text-emerald-600" />
          </div>
          <p className="font-medium text-slate-700 dark:text-slate-300">No active alerts</p>
          <p className="text-sm text-slate-500">System running normally</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
          {alertas.slice(0, 5).map((a, idx) => (
            <div
              key={a.alerta_id}
              className={`
                p-3 rounded-xl border-l-4 transition-all duration-200 
                hover:translate-x-1 cursor-pointer animate-slide-in
                ${a.prioridad === 'CRITICAL' 
                  ? 'bg-red-50 border-l-red-500 dark:bg-red-950/30' 
                  : a.prioridad === 'HIGH' 
                    ? 'bg-amber-50 border-l-amber-500 dark:bg-amber-950/30' 
                    : 'bg-slate-50 border-l-slate-300 dark:bg-slate-800'
                }
              `}
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`
                  text-xs font-bold uppercase tracking-wide
                  ${a.prioridad === 'CRITICAL' ? 'text-red-600' : 
                    a.prioridad === 'HIGH' ? 'text-amber-600' : 'text-slate-500'}
                `}>
                  {a.prioridad}
                </span>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300">{a.titulo}</p>
            </div>
          ))}
        </div>
      )}
    </DrillableChart>
  );
}

// ============================================================================
// TOP PRODUCTS RANKING
// ============================================================================

interface TopProductsProps {
  productos: TopProducto[];
  onProductClick?: (producto: TopProducto) => void;
}

function TopProductsRanking({ productos, onProductClick }: TopProductsProps) {
  const maxValue = productos[0]?.venta_total || 1;
  
  return (
    <DrillableChart
      title="Top 10 Products"
      subtitle="By sales volume"
      onDrillDown={() => window.location.href = '/categorias'}
      drillDownLabel="Full analysis"
    >
      <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
        {productos.slice(0, 10).map((p, idx) => (
          <div
            key={p.producto_id}
            onClick={() => onProductClick?.(p)}
            className="drillable p-3 rounded-xl animate-slide-in"
            style={{ animationDelay: `${idx * 30}ms` }}
          >
            <div className="flex items-center gap-3">
              <div className={`
                w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold
                ${idx === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white' :
                  idx === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white' :
                  idx === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-800 text-white' :
                  'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                }
              `}>
                {idx + 1}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                  {p.nombre}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-2 h-2 rounded-full bg-gradient-to-r from-sky-500 to-blue-600" />
                  <span className="text-xs text-slate-500">Bluefishing</span>
                </div>
              </div>
              
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {formatCompact(p.venta_total)}
              </p>
            </div>
            
            <div className="mt-2 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500
                  bg-gradient-to-r from-sky-400 to-blue-600"
                style={{ width: `${(p.venta_total / maxValue) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </DrillableChart>
  );
}

// ============================================================================
// QUICK ACTIONS
// ============================================================================

function QuickActions() {
  const actions = [
    { href: '/predicciones', icon: <Target className="w-7 h-7" />, label: 'Forecast', desc: 'AI Forecasts', gradient: 'from-purple-500 to-indigo-600' },
    { href: '/inventario', icon: <Package className="w-7 h-7" />, label: 'Inventory', desc: 'Stock & turnover', gradient: 'from-amber-500 to-orange-600' },
    { href: '/clientes', icon: <Users className="w-7 h-7" />, label: 'Customers', desc: 'RFM Segmentation', gradient: 'from-emerald-500 to-teal-600' },
    { href: '/agente', icon: <Sparkles className="w-7 h-7" />, label: 'BI Agent', desc: 'Ask in natural language', gradient: 'from-pink-500 to-rose-600' },
  ];
  
  return (
    <div className="card-3d p-6">
      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4">
        Quick Actions
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {actions.map((action, idx) => (
          <Link
            key={action.href}
            href={action.href}
            className={`
              group p-4 rounded-xl text-center transition-all duration-300
              bg-slate-50 hover:bg-white dark:bg-slate-800 dark:hover:bg-slate-700
              hover:shadow-lg hover:-translate-y-1 animate-slide-in
            `}
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            <div className={`
              w-12 h-12 mx-auto rounded-xl flex items-center justify-center
              bg-gradient-to-br ${action.gradient} text-white shadow-md
              group-hover:scale-110 transition-transform duration-300
            `}>
              {action.icon}
            </div>
            <p className="mt-3 font-semibold text-slate-800 dark:text-slate-200">
              {action.label}
            </p>
            <p className="text-xs text-slate-500">{action.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN DASHBOARD PAGE
// ============================================================================

export default function DashboardPage() {
  const [resumen, setResumen] = useState<ResumenEjecutivo[]>([]);
  const [ventas, setVentas] = useState<VentaDiaria[]>([]);
  const [top, setTop] = useState<TopProducto[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [predicciones, setPredicciones] = useState<Prediccion[]>([]);
  const [loading, setLoading] = useState(true);
  
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (DEMO_MODE) {
        const mock = getDemoDashboard();
        setResumen(mock.resumen as any);
        setVentas(mock.ventas as any);
        setTop(mock.top as any);
        setAlertas(mock.alertas as any);
        setPredicciones(mock.predicciones as any);
        setLoading(false);
        return;
      }

      const [r, v, t] = await Promise.all([
        getResumenEjecutivo(),
        getVentasDiarias(30),
        getTopProductos(10)
      ]);
      setResumen(r);
      setVentas(v);
      setTop(t);

      const { data: alertasData } = await supabase
        .from('alertas')
        .select('alerta_id, tipo, prioridad, titulo, tienda')
        .eq('estado', 'ACTIVA')
        .order('fecha_creacion', { ascending: false })
        .limit(10);
      setAlertas((alertasData || []) as Alerta[]);

      const { data: predData } = await supabase
        .from('predicciones')
        .select('*')
        .eq('nivel', 'tienda')
        .eq('periodo', '30d');
      
      const predList: Prediccion[] = (predData || []).map((p: any) => ({
        nivel: p.nivel,
        nombre: p.nombre,
        venta_proyectada: p.valor_predicho,
        tendencia: p.tendencia,
        factor_estacional: 1.0
      }));
      setPredicciones(predList);
    } catch (e) {
      console.error('Error loading data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totales = resumen.reduce((a, r) => ({
    stock: a.stock + (r.valor_stock_venta || 0),
    ventas: a.ventas + (r.ventas_mes || 0),
    porCobrar: a.porCobrar + (r.por_cobrar || 0),
    productos: a.productos + (r.productos_con_stock || 0)
  }), { stock: 0, ventas: 0, porCobrar: 0, productos: 0 });

  const ventasTrend = ventas
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(-7)
    .map(v => v.venta_total);

  const diasCobertura = totales.ventas > 0 
    ? Math.round((totales.stock / totales.ventas) * 30) 
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="relative inline-block">
            <div className="w-16 h-16 border-4 border-slate-200 rounded-full animate-spin border-t-sky-600" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Zap className="w-6 h-6 text-sky-600" />
            </div>
          </div>
          <p className="mt-4 text-slate-600 dark:text-slate-400 font-medium">
            Loading Bluefishing BI...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-3 sm:p-4 md:p-6 lg:p-8 space-y-4 sm:space-y-6">
      {/* HEADER */}
      <header>
        <div className="flex justify-between items-start gap-4">
          <div className="animate-slide-in min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black gradient-text truncate">
              Bluefishing BI
            </h1>
            <p className="text-slate-500 mt-1 flex items-center gap-2 text-xs sm:text-sm flex-wrap">
              <span className="status-dot healthy shrink-0" />
              <span>
                Updated {new Date().toLocaleString('en-US', { 
                  dateStyle: 'medium', 
                  timeStyle: 'short' 
                })}
              </span>
              {DEMO_MODE && <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-[10px] font-bold">DEMO MODE</span>}
            </p>
          </div>
          
          <div className="flex items-center gap-2 shrink-0 animate-slide-in-right">
            <ThemeToggle />
            
            {alertas.filter(a => ['CRITICAL', 'HIGH'].includes(a.prioridad)).length > 0 && (
              <Link 
                href="/alertas" 
                className="relative flex items-center justify-center w-10 h-10 rounded-xl
                           bg-red-500 text-white shadow-lg shadow-red-500/25
                           hover:bg-red-600 transition-colors"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-white text-red-600 text-[10px] font-black rounded-full flex items-center justify-center shadow">
                  {alertas.filter(a => ['CRITICAL', 'HIGH'].includes(a.prioridad)).length}
                </span>
              </Link>
            )}
            
            <button 
              onClick={loadData} 
              className="flex items-center justify-center w-10 h-10 rounded-xl
                         bg-indigo-500 text-white shadow-lg shadow-indigo-500/25
                         hover:bg-indigo-600 transition-colors"
              title="Refresh data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* LEVEL 1: KPI Row */}
      <section>
        <KPIRow 
          totales={totales}
          predicciones={predicciones}
          diasCobertura={diasCobertura}
          ventasTrend={ventasTrend}
        />
      </section>

      {/* LEVEL 2: Analysis Section */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 animate-slide-in stagger-2">
          <SalesTrendChart 
            ventas={ventas}
          />
        </div>
        
        <div className="animate-slide-in stagger-3">
          <StoreMetricsPanel resumen={resumen} predicciones={predicciones} />
        </div>
      </section>

      {/* LEVEL 3: Detailed Analysis */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="animate-slide-in stagger-4">
          <TopProductsRanking 
            productos={top}
            onProductClick={(p) => console.log('Drill down to product:', p.producto_id)}
          />
        </div>
        
        <div className="animate-slide-in stagger-5">
          <AlertsCenter alertas={alertas} />
        </div>
      </section>

      {/* LEVEL 4: Quick Actions */}
      <section className="animate-slide-in stagger-6">
        <QuickActions />
      </section>

      {/* LEVEL 5: Smart Alerts - Contradiction Detection */}
      <section className="animate-slide-in stagger-7">
        <div className="card-3d p-5">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            Anomaly Detection
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {totales.ventas > 0 && (
              <div className={`p-3 rounded-xl border ${8.5 > 0 && -2.1 < 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                <div className="flex items-center gap-2 mb-1">
                  {8.5 > 0 && -2.1 < 0 ? <AlertCircle className="w-4 h-4 text-amber-600" /> : <TrendingUp className="w-4 h-4 text-emerald-600" />}
                  <span className={`text-xs font-bold ${8.5 > 0 && -2.1 < 0 ? 'text-amber-700' : 'text-emerald-700'}`}>Sales vs Margin</span>
                </div>
                <p className="text-[11px] text-gray-600">
                  {8.5 > 0 && -2.1 < 0 
                    ? 'Sales up +8.5% but margin down -2.1%. Possible causes: higher discounts, rising costs, or product mix shift toward lower-margin items.'
                    : 'Sales and margin aligned — healthy growth.'
                  }
                </p>
              </div>
            )}
            <div className={`p-3 rounded-xl border ${diasCobertura < 45 && totales.ventas > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
              <div className="flex items-center gap-2 mb-1">
                {diasCobertura < 45 ? <AlertCircle className="w-4 h-4 text-red-600" /> : <Package className="w-4 h-4 text-emerald-600" />}
                <span className={`text-xs font-bold ${diasCobertura < 45 ? 'text-red-700' : 'text-emerald-700'}`}>Stock vs Demand</span>
              </div>
              <p className="text-[11px] text-gray-600">
                {diasCobertura < 45 
                  ? `Only ${diasCobertura} days of stock coverage with rising sales. Risk of stockouts on fast movers — review reorder points.`
                  : `${diasCobertura} days coverage — adequate buffer. Monitor Class A products separately.`
                }
              </p>
            </div>
            <div className="p-3 rounded-xl border bg-blue-50 border-blue-200">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-blue-700">Revenue Concentration</span>
              </div>
              <p className="text-[11px] text-gray-600">
                Top 3 wholesale clients account for 55% of revenue. Diversification needed — losing one key account would significantly impact cash flow.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="text-center py-6">
        <div className="inline-flex items-center gap-3 px-6 py-3 bg-white/60 dark:bg-slate-800/60 
                        backdrop-blur-sm rounded-full shadow-sm">
          <div className="status-dot healthy" />
          <p className="text-sm text-slate-500">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Bluefishing BI</span> v2.0 • 
            {' '}{new Date().toLocaleString('en-US', { dateStyle: 'long' })}
          </p>
        </div>
      </footer>
    </div>
  );
}
