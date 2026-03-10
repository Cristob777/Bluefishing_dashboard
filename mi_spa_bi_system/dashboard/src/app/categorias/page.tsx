'use client';
import { useEffect, useState } from 'react';
import { Card, Title, Text, Grid, BarChart, DonutChart, Table, TableHead, TableRow, TableHeaderCell, TableBody, TableCell, Badge } from '@tremor/react';
import { Folder, Package, TrendingUp, BarChart3, X, Layers } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DEMO_MODE } from '@/lib/demo-mode';
import { getDemoCategorias } from '@/lib/demo-data';
import { formatCompact, Skeleton } from '@/components/ui';
import { Card3D, KPICard3D, RankingItem, Donut3D, ProgressBar3D } from '@/components/charts3d';

interface Categoria {
  categoria_id: number;
  categoria: string;
  tienda: string;
  bsale_category_id: number;
  total_productos: number;
  productos_activos: number;
}

interface VentaCategoria {
  categoria_id: number;
  categoria: string;
  tienda: string;
  venta_total: number;
  unidades_vendidas: number;
  num_documentos: number;
  productos_vendidos: number;
}

interface ProductoCategoria {
  producto_id: number;
  nombre: string;
  sku: string | null;
  tienda: string;
  precio_venta: number;
  es_activo: boolean;
}

const CHART_COLORS = ['cyan', 'violet', 'amber', 'emerald', 'rose', 'indigo', 'orange', 'teal', 'pink', 'lime'];
const DONUT_COLORS = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#f43f5e', '#6366f1', '#f97316', '#14b8a6', '#ec4899', '#84cc16'];

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [ventasCat, setVentasCat] = useState<VentaCategoria[]>([]);
  const [productos, setProductos] = useState<ProductoCategoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [tienda] = useState('ALL');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<number | null>(null);
  const [loadingProductos, setLoadingProductos] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (categoriaSeleccionada) {
      loadProductosCategoria(categoriaSeleccionada);
    }
  }, [categoriaSeleccionada]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (DEMO_MODE) {
        const mock = getDemoCategorias();
        setCategorias(mock.categorias as any);
        setVentasCat(mock.ventasCat as any);
        setProductos(mock.productos as any);
        setLoading(false);
        return;
      }

      const { data: catData } = await supabase
        .from('v_productos_por_categoria')
        .select('*')
        .order('total_productos', { ascending: false });

      setCategorias((catData || []) as Categoria[]);

      const { data: ventasData } = await supabase
        .from('v_ventas_por_categoria')
        .select('*')
        .order('venta_total', { ascending: false });

      setVentasCat((ventasData || []) as VentaCategoria[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadProductosCategoria = async (catId: number) => {
    setLoadingProductos(true);
    try {
      const { data } = await supabase
        .from('dim_productos')
        .select('producto_id, nombre, sku, tienda, precio_venta, es_activo')
        .eq('categoria_id', catId)
        .order('nombre');

      setProductos((data || []) as ProductoCategoria[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingProductos(false);
    }
  };

  const categoriasFilt = tienda === 'ALL' ? categorias : categorias.filter(c => c.tienda === tienda);
  const ventasFilt = tienda === 'ALL' ? ventasCat : ventasCat.filter(v => v.tienda === tienda);

  const totalCategorias = categoriasFilt.length;
  const totalProductos = categoriasFilt.reduce((s, c) => s + c.total_productos, 0);
  const totalVentas = ventasFilt.reduce((s, v) => s + v.venta_total, 0);

  const topCategoriasPorProductos = categoriasFilt
    .filter(c => c.total_productos > 0)
    .slice(0, 10)
    .map(c => ({ name: c.categoria, value: c.total_productos, tienda: c.tienda }));

  const topCategoriasPorVentas = ventasFilt
    .filter(v => v.venta_total > 0)
    .slice(0, 10)
    .map(v => ({ name: v.categoria, value: v.venta_total, tienda: v.tienda }));

  const distribucionTienda = [
    { name: 'BLUEFISHING', categorias: categorias.length, productos: categorias.reduce((s, c) => s + c.total_productos, 0) }
  ];

  const categoriaActual = categorias.find(c => c.categoria_id === categoriaSeleccionada);

  if (loading) {
    return (
      <div className="p-6 min-h-screen flex items-center justify-center">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-cyan-200 rounded-full animate-spin border-t-cyan-600" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Layers className="w-8 h-8 text-cyan-600" />
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
            title="Categories"
            value={totalCategorias.toString()}
            subtitle="active categories"
            icon={<Folder className="w-6 h-6" />}
            color="blue"
          />
        </div>
        <div className="animate-slide-in stagger-2" style={{ animationFillMode: 'backwards' }}>
          <KPICard3D
            title="Products"
            value={totalProductos.toLocaleString()}
            subtitle="in catalog"
            icon={<Package className="w-6 h-6" />}
            color="green"
          />
        </div>
        <div className="animate-slide-in stagger-3" style={{ animationFillMode: 'backwards' }}>
          <KPICard3D
            title="Sales (30d)"
            value={formatCompact(totalVentas)}
            subtitle="by category • vs last period"
            icon={<TrendingUp className="w-6 h-6" />}
            color="purple"
          />
        </div>
        <div className="animate-slide-in stagger-4" style={{ animationFillMode: 'backwards' }}>
          <KPICard3D
            title="Avg. Prod/Cat"
            value={totalCategorias > 0 ? Math.round(totalProductos / totalCategorias).toString() : '0'}
            subtitle="products per category"
            icon={<BarChart3 className="w-6 h-6" />}
            color="amber"
          />
        </div>
      </div>

      {/* Store Distribution */}
      {tienda === 'ALL' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card-3d p-6 animate-slide-in stagger-2" style={{ animationFillMode: 'backwards' }}>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-6">Bluefishing Summary</h2>
            <div className="flex justify-center">
              <Donut3D
                data={[{
                  name: 'BLUEFISHING',
                  value: distribucionTienda[0]?.categorias || 0,
                  color: '#3b82f6'
                }]}
                size={200}
                thickness={45}
              />
            </div>
            <div className="mt-4">
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-center">
                <p className="text-2xl font-black text-blue-600">{distribucionTienda[0]?.categorias || 0}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Bluefishing Categories</p>
              </div>
            </div>
          </div>
          
          <div className="card-3d p-6 animate-slide-in stagger-3" style={{ animationFillMode: 'backwards' }}>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-6">Bluefishing Products</h2>
            <div className="flex justify-center">
              <Donut3D
                data={[{
                  name: 'BLUEFISHING',
                  value: distribucionTienda[0]?.productos || 0,
                  color: '#3b82f6'
                }]}
                size={200}
                thickness={45}
              />
            </div>
            <div className="mt-4">
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-center">
                <p className="text-2xl font-black text-blue-600">{(distribucionTienda[0]?.productos || 0).toLocaleString()}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Bluefishing Products</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Categories Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-3d p-6 animate-slide-in stagger-3" style={{ animationFillMode: 'backwards' }}>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Top 10 Categories by Products</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Number of products per category</p>
          <div className="chart-container p-4 bg-white/50 rounded-xl">
            <BarChart
              className="h-72"
              data={topCategoriasPorProductos}
              index="name"
              categories={['value']}
              colors={['cyan']}
              valueFormatter={(v) => `${v} prods`}
              layout="vertical"
              showAnimation={true}
              showGridLines={false}
            />
          </div>
        </div>
        
        <div className="card-3d p-6 animate-slide-in stagger-4" style={{ animationFillMode: 'backwards' }}>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Top 10 Categories by Sales</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Last 30 days</p>
          <div className="chart-container p-4 bg-white/50 rounded-xl">
            <BarChart
              className="h-72"
              data={topCategoriasPorVentas}
              index="name"
              categories={['value']}
              colors={['violet']}
              valueFormatter={formatCompact}
              layout="vertical"
              showAnimation={true}
              showGridLines={false}
            />
          </div>
        </div>
      </div>

      <div className="mt-3 p-3 bg-sky-50 border border-sky-200 rounded-xl">
        <p className="text-sm text-sky-700">
          <span className="font-bold">📌 Insight:</span> Category concentration reveals which product families drive revenue. Diversify if top 2 categories exceed 60% of total — reduces dependency risk.
        </p>
      </div>

      {/* Categories Table */}
      <div className="card-3d p-6 animate-slide-in stagger-4" style={{ animationFillMode: 'backwards' }}>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">All Categories</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Click on a category to view its products</p>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-slate-200 dark:border-slate-700">
                <th className="text-left py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Category</th>
                <th className="text-left py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Store</th>
                <th className="text-center py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Products</th>
                <th className="text-center py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Active</th>
                <th className="text-right py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Sales (30d)</th>
                <th className="text-center py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Units</th>
              </tr>
            </thead>
            <tbody>
              {categoriasFilt.slice(0, 20).map((cat, idx) => {
                const ventas = ventasCat.find(v => v.categoria_id === cat.categoria_id);
                const isSelected = categoriaSeleccionada === cat.categoria_id;
                return (
                  <tr 
                    key={cat.categoria_id}
                    onClick={() => setCategoriaSeleccionada(cat.categoria_id)}
                    className={`
                      cursor-pointer transition-all duration-300 border-b border-slate-100 dark:border-slate-700
                      ${isSelected 
                        ? 'bg-gradient-to-r from-cyan-50 to-violet-50 shadow-md' 
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }
                    `}
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className={`
                          w-10 h-10 rounded-xl flex items-center justify-center
                          ${isSelected ? 'bg-gradient-to-br from-cyan-400 to-violet-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}
                        `}>
                          <Folder className="w-5 h-5" />
                        </div>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{cat.categoria}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4"><span className="px-2 py-1 bg-sky-100 text-sky-700 rounded-full text-xs font-semibold">Bluefishing</span></td>
                    <td className="py-4 px-4 text-center">
                      <span className="px-3 py-1 bg-cyan-100 text-cyan-700 rounded-full text-sm font-bold">
                        {cat.total_productos}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center text-slate-600 dark:text-slate-400">{cat.productos_activos}</td>
                    <td className="py-4 px-4 text-right">
                      <span className="font-bold text-violet-600">{formatCompact(ventas?.venta_total || 0)}</span>
                    </td>
                    <td className="py-4 px-4 text-center text-slate-600 dark:text-slate-400">{ventas?.unidades_vendidas || 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Category Product Detail */}
      {categoriaSeleccionada && (
        <div className="card-3d p-6 animate-scale-in">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center text-white">
                  <Package className="w-5 h-5" />
                </div>
                Products in: {categoriaActual?.categoria}
              </h2>
              <div className="flex items-center gap-3 mt-2">
                <span className="px-2 py-1 bg-sky-100 text-sky-700 rounded-full text-xs font-semibold">Bluefishing</span>
                <span className="text-sm text-slate-500 dark:text-slate-400">{productos.length} products</span>
              </div>
            </div>
            <button 
              onClick={() => setCategoriaSeleccionada(null)}
              className="p-2 hover:bg-slate-100 dark:bg-slate-700 rounded-xl transition-colors"
            >
              <X className="w-6 h-6 text-slate-400 dark:text-slate-500" />
            </button>
          </div>

          {loadingProductos ? (
            <div className="flex justify-center py-12">
              <div className="w-12 h-12 border-4 border-cyan-200 rounded-full animate-spin border-t-cyan-600" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-slate-200 dark:border-slate-700">
                    <th className="text-left py-3 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">SKU</th>
                    <th className="text-left py-3 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Product</th>
                    <th className="text-right py-3 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Sale Price</th>
                    <th className="text-center py-3 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {productos.slice(0, 50).map((prod) => (
                    <tr key={prod.producto_id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono text-sm">{prod.sku || '-'}</td>
                      <td className="py-3 px-4 max-w-md truncate text-slate-800 dark:text-slate-200">{prod.nombre}</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-700 dark:text-slate-300">{formatCompact(prod.precio_venta)}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`
                          px-3 py-1 rounded-full text-xs font-bold
                          ${prod.es_activo ? 'bg-green-100 text-green-700' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}
                        `}>
                          {prod.es_activo ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {productos.length > 50 && (
                <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
                  Showing 50 of {productos.length} products
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-slate-400 dark:text-slate-500 text-right mt-2">Source: Bsale products API • Synced daily</p>
    </div>
  );
}
