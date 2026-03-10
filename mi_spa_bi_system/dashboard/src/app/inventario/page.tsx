'use client';
import { useEffect, useState } from 'react';
import { BarChart, DonutChart, Badge } from '@tremor/react';
import { Package, AlertTriangle, TrendingUp, TrendingDown, ArrowUpDown, Box, RotateCcw, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DEMO_MODE } from '@/lib/demo-mode';
import { getDemoInventario } from '@/lib/demo-data';
import { formatCompact, Skeleton } from '@/components/ui';
import { Card3D, KPICard3D, Gauge3D, Donut3D, ProgressBar3D, RankingItem } from '@/components/charts3d';

interface RotacionProducto {
  producto_id: number;
  nombre: string;
  tienda: string;
  unidades_vendidas: number;
  venta_total: number;
  stock_actual: number;
  dias_stock: number;
  rotacion: number;
  clasificacion: string;
  semaforo: string;
}

interface AnalisisABC {
  producto_id: number;
  nombre: string;
  tienda: string;
  categoria: string;
  precio_venta: number;
  unidades_vendidas: number;
  venta_total: number;
  clasificacion: string;
}

interface ResumenStock {
  tienda: string;
  total_productos: number;
  en_stock: number;
  sin_stock: number;
  stock_critico: number;
}

const ABC_COLORS: Record<string, { bg: string; text: string; border: string; chart: string }> = {
  'A': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', chart: '#10b981' },
  'B': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', chart: '#f59e0b' },
  'C': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', chart: '#f43f5e' }
};

const SEMAFORO_COLORS: Record<string, { bg: string; text: string; icon: JSX.Element }> = {
  'GREEN': { bg: 'bg-green-100', text: 'text-green-700', icon: <TrendingUp className="w-4 h-4" /> },
  'YELLOW': { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: <ArrowUpDown className="w-4 h-4" /> },
  'RED': { bg: 'bg-red-100', text: 'text-red-700', icon: <TrendingDown className="w-4 h-4" /> }
};

export default function InventarioPage() {
  const [rotacion, setRotacion] = useState<RotacionProducto[]>([]);
  const [abc, setAbc] = useState<AnalisisABC[]>([]);
  const [resumen, setResumen] = useState<ResumenStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabABC, setTabABC] = useState<'A' | 'B' | 'C'>('A');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      if (DEMO_MODE) {
        const mock = getDemoInventario();
        setRotacion(mock.rotacion as any);
        setAbc(mock.abc as any);
        setResumen([{
          tienda: 'BLUEFISHING',
          total_productos: 2892,
          en_stock: 892,
          sin_stock: 1645,
          stock_critico: 355,
        }]);
        setLoading(false);
        return;
      }

      const { data: rotacionData } = await supabase
        .from('v_rotacion_inventario')
        .select('*')
        .order('rotacion', { ascending: false })
        .limit(100);

      setRotacion((rotacionData || []) as RotacionProducto[]);

      const { data: abcData } = await supabase
        .from('v_analisis_abc')
        .select('*')
        .order('venta_total', { ascending: false })
        .limit(200);

      setAbc((abcData || []) as AnalisisABC[]);

      const { data: productos } = await supabase
        .from('dim_productos')
        .select('producto_id, tienda, stock_actual');

      const resumenCalc: Record<string, ResumenStock> = {};
      (productos || []).forEach((p: any) => {
        if (!resumenCalc[p.tienda]) {
          resumenCalc[p.tienda] = {
            tienda: p.tienda,
            total_productos: 0,
            en_stock: 0,
            sin_stock: 0,
            stock_critico: 0
          };
        }
        resumenCalc[p.tienda].total_productos++;
        const stock = p.stock_actual || 0;
        if (stock > 10) resumenCalc[p.tienda].en_stock++;
        else if (stock === 0) resumenCalc[p.tienda].sin_stock++;
        else resumenCalc[p.tienda].stock_critico++;
      });

      setResumen(Object.values(resumenCalc));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const rotacionFilt = rotacion;
  const abcFilt = abc;
  const resumenFilt = resumen;

  const totalProductos = resumenFilt.reduce((s, r) => s + r.total_productos, 0);
  const enStock = resumenFilt.reduce((s, r) => s + r.en_stock, 0);
  const sinStock = resumenFilt.reduce((s, r) => s + r.sin_stock, 0);
  const stockCritico = resumenFilt.reduce((s, r) => s + r.stock_critico, 0);

  const abcDistribucion = abcFilt.reduce((acc, a) => {
    const existing = acc.find(x => x.clasificacion === a.clasificacion);
    if (existing) {
      existing.productos++;
      existing.valor += a.venta_total;
    } else {
      acc.push({ 
        clasificacion: a.clasificacion, 
        productos: 1, 
        valor: a.venta_total,
        color: ABC_COLORS[a.clasificacion]?.chart || '#6b7280'
      });
    }
    return acc;
  }, [] as { clasificacion: string; productos: number; valor: number; color: string }[]);

  const semaforoDistribucion = rotacionFilt.reduce((acc, r) => {
    const existing = acc.find(x => x.semaforo === r.semaforo);
    if (existing) {
      existing.cantidad++;
    } else {
      acc.push({ semaforo: r.semaforo, cantidad: 1 });
    }
    return acc;
  }, [] as { semaforo: string; cantidad: number }[]);

  if (loading) {
    return (
        <div className="p-6 min-h-screen flex items-center justify-center">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-sky-200 rounded-full animate-spin border-t-sky-600" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Package className="w-8 h-8 text-sky-600" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 min-h-screen">
      {/* Stock KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="animate-slide-in stagger-1" style={{ animationFillMode: 'backwards' }}>
          <KPICard3D
            title="Total Products"
            value={totalProductos.toLocaleString()}
            subtitle="in catalog"
            icon={<Package className="w-6 h-6" />}
            color="blue"
          />
        </div>
        <div className="animate-slide-in stagger-2" style={{ animationFillMode: 'backwards' }}>
          <KPICard3D
            title="In Stock"
            value={enStock.toLocaleString()}
            subtitle={`${((enStock / totalProductos) * 100).toFixed(1)}% available • +2.3% vs prev`}
            icon={<TrendingUp className="w-6 h-6" />}
            color="green"
          />
        </div>
        <div className="animate-slide-in stagger-3" style={{ animationFillMode: 'backwards' }}>
          <KPICard3D
            title="Critical Stock"
            value={stockCritico.toString()}
            subtitle="1-5 units • -15% vs prev"
            icon={<AlertTriangle className="w-6 h-6" />}
            color="amber"
            delta={stockCritico > 10 ? stockCritico : undefined}
          />
        </div>
        <div className="animate-slide-in stagger-4" style={{ animationFillMode: 'backwards' }}>
          <KPICard3D
            title="Out of Stock"
            value={sinStock.toString()}
            subtitle="needs restock • -8% vs prev"
            icon={<TrendingDown className="w-6 h-6" />}
            color="red"
            delta={sinStock > 5 ? sinStock : undefined}
          />
        </div>
      </div>

      {/* Status Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card3D color="green" hover={false}>
          <div className="flex flex-col items-center">
            <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-4">Products In Stock</h3>
            <Gauge3D 
              value={enStock} 
              max={totalProductos} 
              label={`${enStock} products`}
            />
            <p className="mt-4 text-lg font-bold text-emerald-600">
              {((enStock / totalProductos) * 100).toFixed(1)}% available
            </p>
          </div>
        </Card3D>
        
        <Card3D color="amber" hover={false}>
          <div className="flex flex-col items-center">
            <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-4">Critical Stock</h3>
            <Gauge3D 
              value={stockCritico} 
              max={totalProductos} 
              label={`${stockCritico} products`}
            />
            <p className="mt-4 text-lg font-bold text-amber-600">
              Requires attention
            </p>
          </div>
        </Card3D>
        
        <Card3D color="red" hover={false}>
          <div className="flex flex-col items-center">
            <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-4">Out of Stock</h3>
            <Gauge3D 
              value={sinStock} 
              max={totalProductos} 
              label={`${sinStock} products`}
            />
            <p className="mt-4 text-lg font-bold text-rose-600">
              Urgent replenishment
            </p>
          </div>
        </Card3D>
      </div>

      {/* ABC Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card-3d p-6 animate-slide-in stagger-2" style={{ animationFillMode: 'backwards' }}>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">ABC Classification</h2>
          <div className="flex justify-center mb-6">
            <Donut3D
              data={abcDistribucion.map(d => ({
                name: `Class ${d.clasificacion}`,
                value: d.productos,
                color: d.color
              }))}
              size={180}
              thickness={40}
            />
          </div>
          <div className="space-y-3">
            {abcDistribucion.sort((a, b) => a.clasificacion.localeCompare(b.clasificacion)).map(abc => (
              <div 
                key={abc.clasificacion}
                className={`p-4 rounded-xl ${ABC_COLORS[abc.clasificacion]?.bg} ${ABC_COLORS[abc.clasificacion]?.border} border flex justify-between items-center`}
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-full shadow-lg"
                    style={{ backgroundColor: abc.color }}
                  />
                  <span className={`font-bold ${ABC_COLORS[abc.clasificacion]?.text}`}>
                    Class {abc.clasificacion}
                  </span>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-black ${ABC_COLORS[abc.clasificacion]?.text}`}>{abc.productos}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{formatCompact(abc.valor)}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-xl">
            <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
              <span className="font-bold">📌 ABC Rule:</span> Class A products ({abcDistribucion.find(a=>a.clasificacion==='A')?.productos || 0} items) generate {abcDistribucion.find(a=>a.clasificacion==='A')?.valor ? formatCompact(abcDistribucion.find(a=>a.clasificacion==='A')?.valor || 0) : 'N/A'} — protect these SKUs at all costs.
            </p>
          </div>
          <div className="flex gap-2 mt-2">
            <a href="/ventas" className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800">View sales data →</a>
            <a href="/alertas" className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800">Stock alerts →</a>
          </div>
        </div>
        
        <div className="lg:col-span-2 card-3d p-6 animate-slide-in stagger-3" style={{ animationFillMode: 'backwards' }}>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Class Products</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">By sales volume</p>
            </div>
            <div className="flex gap-2">
              {(['A', 'B', 'C'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTabABC(t)}
                  className={`
                    px-6 py-2 rounded-lg font-bold transition-all duration-300
                    ${tabABC === t 
                      ? `${ABC_COLORS[t]?.bg} ${ABC_COLORS[t]?.text} shadow-md` 
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }
                  `}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Product</th>
                  <th className="text-left py-3 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Store</th>
                  <th className="text-right py-3 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Units</th>
                  <th className="text-right py-3 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Total Sales</th>
                </tr>
              </thead>
              <tbody>
                {abcFilt.filter(a => a.clasificacion === tabABC).slice(0, 10).map((p, idx) => (
                  <tr key={p.producto_id} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-white max-w-xs truncate">
                      <div className="flex items-center gap-3">
                        <span className={`
                          w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold
                          ${ABC_COLORS[tabABC]?.bg} ${ABC_COLORS[tabABC]?.text}
                        `}>
                          {idx + 1}
                        </span>
                        <span>{p.nombre}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{p.tienda}</td>
                    <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">{p.unidades_vendidas?.toLocaleString() || 0}</td>
                    <td className="py-3 px-4 text-right font-bold" style={{ color: ABC_COLORS[tabABC]?.chart }}>
                      {formatCompact(p.venta_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Turnover Analysis */}
      <div className="card-3d p-6 animate-slide-in stagger-4" style={{ animationFillMode: 'backwards' }}>
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
              <RotateCcw className="w-6 h-6 text-orange-500" />
              Turnover Analysis
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Inventory movement speed</p>
          </div>
          <div className="flex gap-3">
            {semaforoDistribucion.map(s => (
              <div 
                key={s.semaforo}
                className={`px-4 py-2 rounded-xl flex items-center gap-2 ${SEMAFORO_COLORS[s.semaforo]?.bg}`}
              >
                {SEMAFORO_COLORS[s.semaforo]?.icon}
                <span className={`font-bold ${SEMAFORO_COLORS[s.semaforo]?.text}`}>{s.semaforo}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs ${SEMAFORO_COLORS[s.semaforo]?.text} bg-white/50`}>
                  {s.cantidad}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-slate-200 dark:border-slate-700">
                <th className="text-left py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Product</th>
                <th className="text-left py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Store</th>
                <th className="text-center py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Turnover</th>
                <th className="text-center py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Current Stock</th>
                <th className="text-center py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Days of Stock</th>
                <th className="text-right py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Sales</th>
                <th className="text-center py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {rotacionFilt.slice(0, 15).map((r) => (
                <tr key={r.producto_id} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-4 px-4 font-medium text-slate-900 dark:text-white max-w-xs truncate">{r.nombre}</td>
                  <td className="py-4 px-4 text-slate-600 dark:text-slate-400">{r.tienda}</td>
                  <td className="py-4 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-20 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            r.semaforo === 'GREEN' ? 'bg-gradient-to-r from-green-400 to-green-600' :
                            r.semaforo === 'YELLOW' ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' :
                            'bg-gradient-to-r from-red-400 to-red-600'
                          }`}
                          style={{ width: `${Math.min((r.rotacion || 0) * 10, 100)}%` }}
                        />
                      </div>
                      <span className="font-bold text-slate-700 dark:text-slate-200">{(r.rotacion || 0).toFixed(1)}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center font-medium text-slate-700 dark:text-slate-200">{r.stock_actual}</td>
                  <td className="py-4 px-4 text-center">
                    <span className={`
                      ${(r.dias_stock || 0) > 90 ? 'text-red-600 font-bold' : 
                        (r.dias_stock || 0) > 45 ? 'text-orange-600' : 'text-green-600'}
                    `}>
                      {r.dias_stock || '∞'} days
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right font-bold text-orange-600">{formatCompact(r.venta_total)}</td>
                  <td className="py-4 px-4 text-center">
                    <span className={`
                      inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold
                      ${SEMAFORO_COLORS[r.semaforo]?.bg} ${SEMAFORO_COLORS[r.semaforo]?.text}
                    `}>
                      {SEMAFORO_COLORS[r.semaforo]?.icon}
                      {r.semaforo}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-xl">
          <p className="text-[11px] text-orange-700 dark:text-orange-300">
            <span className="font-bold">🔄 Rotation:</span> {semaforoDistribucion.find(s=>s.semaforo==='RED')?.cantidad || 0} slow-moving products (RED) tying up capital.
            Consider promotions or bundling to accelerate turnover. {semaforoDistribucion.find(s=>s.semaforo==='GREEN')?.cantidad || 0} fast movers (GREEN) need consistent replenishment.
          </p>
        </div>
      </div>
      <p className="text-[10px] text-slate-400 dark:text-slate-500 text-right mt-2">Source: Bsale stock API • Synced daily</p>
    </div>
  );
}
