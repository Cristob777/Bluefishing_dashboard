'use client';
import { useEffect, useState } from 'react';
import { Card, Title, Text, Grid, BarChart, DonutChart, Table, TableHead, TableRow, TableHeaderCell, TableBody, TableCell, Badge, Flex, Select, SelectItem } from '@tremor/react';
import { MapPin, Users, TrendingUp, Package, Award, Globe, ChevronRight, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DEMO_MODE } from '@/lib/demo-mode';
import { getDemoRegiones } from '@/lib/demo-data';
import { formatCompact, Skeleton } from '@/components/ui';
import { Card3D, KPICard3D, Gauge3D, ProgressBar3D, RankingItem, Donut3D } from '@/components/charts3d';

interface ResumenRegional {
  region: string;
  ventas_bluefishing: number;
  venta_total: number;
  total_clientes: number;
  total_ventas: number;
}

interface TopRegion {
  region: string;
  clientes_activos: number;
  total_ventas: number;
  venta_total: number;
  ticket_promedio: number;
  ranking: number;
}

interface ProductoRegion {
  region: string;
  tienda: string;
  categoria: string;
  producto_id: number;
  producto: string;
  unidades: number;
  venta_total: number;
  rank_en_region: number;
}

interface ClienteRegion {
  region: string;
  cliente_id: number;
  razon_social: string;
  tienda: string;
  num_compras: number;
  total_comprado: number;
  rank_en_region: number;
}

interface CategoriaRegion {
  region: string;
  categoria: string;
  tienda: string;
  productos_vendidos: number;
  unidades: number;
  venta_total: number;
  porcentaje_region: number;
}

export default function RegionesPage() {
  const [resumen, setResumen] = useState<ResumenRegional[]>([]);
  const [topRegiones, setTopRegiones] = useState<TopRegion[]>([]);
  const [productos, setProductos] = useState<ProductoRegion[]>([]);
  const [clientes, setClientes] = useState<ClienteRegion[]>([]);
  const [categorias, setCategorias] = useState<CategoriaRegion[]>([]);
  const [loading, setLoading] = useState(true);
  const [regionSeleccionada, setRegionSeleccionada] = useState<string>('');
  const [tiendaFiltro] = useState('ALL');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (regionSeleccionada) {
      loadDetalleRegion(regionSeleccionada);
    }
  }, [regionSeleccionada, tiendaFiltro]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (DEMO_MODE) {
        const mock = getDemoRegiones();
        setResumen(mock.resumen as any);
        setTopRegiones(mock.topRegiones as any);
        setProductos(mock.productosPorRegion as any);
        setClientes(mock.clientesPorRegion as any);
        setCategorias(mock.categoriasPorRegion as any);
        if (mock.resumen.length) setRegionSeleccionada(mock.resumen[0].region);
        setLoading(false);
        return;
      }

      const [resumenData, topData] = await Promise.all([
        supabase.from('v_resumen_regional').select('*').limit(20),
        supabase.from('v_top_regiones').select('*').limit(10)
      ]);

      setResumen((resumenData.data || []) as ResumenRegional[]);
      setTopRegiones((topData.data || []) as TopRegion[]);
      
      if (resumenData.data?.length) {
        setRegionSeleccionada(resumenData.data[0].region);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadDetalleRegion = async (region: string) => {
    try {
      let queryProductos = supabase
        .from('v_productos_por_region')
        .select('*')
        .eq('region', region)
        .lte('rank_en_region', 10);
      
      let queryClientes = supabase
        .from('v_clientes_por_region')
        .select('*')
        .eq('region', region)
        .lte('rank_en_region', 10);
      
      let queryCategorias = supabase
        .from('v_categorias_por_region')
        .select('*')
        .eq('region', region);

      if (tiendaFiltro !== 'ALL') {
        queryProductos = queryProductos.eq('tienda', tiendaFiltro);
        queryClientes = queryClientes.eq('tienda', tiendaFiltro);
        queryCategorias = queryCategorias.eq('tienda', tiendaFiltro);
      }

      const [prodData, cliData, catData] = await Promise.all([
        queryProductos,
        queryClientes,
        queryCategorias
      ]);

      setProductos((prodData.data || []) as ProductoRegion[]);
      setClientes((cliData.data || []) as ClienteRegion[]);
      setCategorias((catData.data || []) as CategoriaRegion[]);
    } catch (e) {
      console.error(e);
    }
  };

  const totalVentas = resumen.reduce((sum, r) => sum + (r.venta_total || 0), 0);
  const totalClientes = resumen.reduce((sum, r) => sum + (r.total_clientes || 0), 0);
  const topRegion = topRegiones[0];
  const regionActual = resumen.find(r => r.region === regionSeleccionada);

  const chartDataRegiones = resumen.slice(0, 8).map(r => ({
    region: r.region.length > 15 ? r.region.slice(0, 15) + '...' : r.region,
    Bluefishing: r.ventas_bluefishing || 0
  }));

  const donutData = resumen.slice(0, 6).map(r => ({
    name: r.region.length > 12 ? r.region.slice(0, 12) + '...' : r.region,
    value: r.venta_total || 0
  }));

  if (loading) {
    return (
      <div className="p-6 min-h-screen flex items-center justify-center">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-indigo-200 rounded-full animate-spin border-t-indigo-600" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Globe className="w-8 h-8 text-indigo-600" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 min-h-screen">
      {/* Header Premium */}
      <div className="flex justify-end animate-slide-in">
        <div className="flex items-center gap-2 px-4 py-2 bg-sky-50 rounded-xl border border-sky-200">
          <span className="text-lg">🎣</span>
          <span className="text-sm font-semibold text-sky-700">Bluefishing.cl</span>
        </div>
      </div>

      {/* KPIs 3D */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="animate-slide-in stagger-1" style={{ animationFillMode: 'backwards' }}>
          <KPICard3D
            title="Total Sales"
            value={formatCompact(totalVentas)}
            subtitle={`${resumen.length} regions • vs prev. period`}
            icon={<TrendingUp className="w-6 h-6" />}
            color="blue"
          />
        </div>
        <div className="animate-slide-in stagger-2" style={{ animationFillMode: 'backwards' }}>
          <KPICard3D
            title="Active Customers"
            value={totalClientes.toLocaleString()}
            subtitle="with purchases in period"
            icon={<Users className="w-6 h-6" />}
            color="green"
          />
        </div>
        <div className="animate-slide-in stagger-3" style={{ animationFillMode: 'backwards' }}>
          <KPICard3D
            title="Leading Region"
            value={topRegion?.region?.slice(0, 12) || '-'}
            subtitle={formatCompact(topRegion?.venta_total || 0)}
            icon={<Award className="w-6 h-6" />}
            color="amber"
          />
        </div>
        <div className="animate-slide-in stagger-4" style={{ animationFillMode: 'backwards' }}>
          <KPICard3D
            title="Avg. Ticket"
            value={formatCompact(topRegion?.ticket_promedio || 0)}
            subtitle="in leading region"
            icon={<MapPin className="w-6 h-6" />}
            color="purple"
          />
        </div>
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 3D Bar Chart */}
        <div className="lg:col-span-2 card-3d p-6 animate-slide-in stagger-2" style={{ animationFillMode: 'backwards' }}>
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Sales by Region</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Click a bar to see details</p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-gradient-to-r from-sky-400 to-blue-600 shadow-md" />
                <span className="text-sm text-slate-600 dark:text-slate-400">Bluefishing</span>
              </div>
            </div>
          </div>
          <div className="chart-container p-4 bg-white/50 rounded-xl">
            <BarChart
              className="h-80"
              data={chartDataRegiones}
              index="region"
              categories={['Bluefishing']}
              colors={['blue']}
              valueFormatter={formatCompact}
              stack={true}
              layout="vertical"
              yAxisWidth={100}
              showAnimation={true}
              showGridLines={false}
              onValueChange={(v) => {
                if (v?.region) {
                  const regionCompleta = resumen.find(r => r.region.startsWith(String(v.region).replace('...', '')));
                  if (regionCompleta) setRegionSeleccionada(regionCompleta.region);
                }
              }}
            />
          </div>
        </div>

        {/* Distribution Map */}
        <div className="card-3d p-6 animate-slide-in stagger-3" style={{ animationFillMode: 'backwards' }}>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-6">Distribution</h2>
          <div className="flex justify-center mb-6">
            <Donut3D
              data={resumen.slice(0, 5).map((r, i) => ({
                name: r.region,
                value: r.venta_total,
                color: ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'][i]
              }))}
              size={180}
              thickness={40}
            />
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {resumen.slice(0, 6).map((r, idx) => (
              <div 
                key={r.region}
                onClick={() => setRegionSeleccionada(r.region)}
                className={`
                  p-3 rounded-xl cursor-pointer transition-all duration-300
                  ${regionSeleccionada === r.region 
                    ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-300 shadow-md transform scale-[1.02]' 
                    : 'bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:bg-slate-700 border border-transparent'
                  }
                `}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '📍'}</span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate max-w-24">{r.region}</span>
                  </div>
                  <span className="text-sm font-bold text-indigo-600">{formatCompact(r.venta_total)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Selected Region Detail */}
      <div className="card-3d p-6 animate-slide-in stagger-4" style={{ animationFillMode: 'backwards' }}>
        <div className="flex justify-between items-start mb-8">
          <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-200 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
                <MapPin className="w-6 h-6" />
              </div>
              {regionSeleccionada || 'Select a region'}
            </h2>
            {regionActual && (
              <div className="flex items-center gap-6 mt-4 flex-wrap">
                <div className="flex items-center gap-2 bg-green-50 px-4 py-2 rounded-full border border-green-200">
                  <span className="text-lg">💰</span>
                  <span className="text-sm text-slate-600 dark:text-slate-400">Sales:</span>
                  <span className="font-bold text-green-700">{formatCompact(regionActual.venta_total)}</span>
                </div>
                <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-full border border-blue-200">
                  <span className="text-lg">👥</span>
                  <span className="text-sm text-slate-600 dark:text-slate-400">Customers:</span>
                  <span className="font-bold text-blue-700">{regionActual.total_clientes}</span>
                </div>
                <div className="flex items-center gap-2 bg-purple-50 px-4 py-2 rounded-full border border-purple-200">
                  <span className="text-lg">🧾</span>
                  <span className="text-sm text-slate-600 dark:text-slate-400">Transactions:</span>
                  <span className="font-bold text-purple-700">{regionActual.total_ventas}</span>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {regionActual && (
              <Gauge3D
                value={regionActual.venta_total}
                max={topRegion?.venta_total || regionActual.venta_total}
                label="vs Leader"
                size="sm"
              />
            )}
            <Select value={regionSeleccionada} onValueChange={setRegionSeleccionada} className="w-64">
              {resumen.map(r => (
                <SelectItem key={r.region} value={r.region}>
                  {r.region} ({formatCompact(r.venta_total)})
                </SelectItem>
              ))}
            </Select>
          </div>
        </div>

        {/* Detail Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Top Products */}
          <Card3D color="blue" hover={false}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-200">Top Products</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">By sales in region</p>
              </div>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {productos.slice(0, 6).map((p, idx) => (
                <RankingItem
                  key={p.producto_id}
                  rank={idx + 1}
                  label={p.producto.length > 20 ? p.producto.slice(0, 20) + '...' : p.producto}
                  value={p.venta_total}
                  maxValue={productos[0]?.venta_total || 1}
                  formatValue={formatCompact}
                />
              ))}
              {productos.length === 0 && (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 text-slate-200 dark:text-slate-500 mx-auto mb-2" />
                  <p className="text-sm text-slate-400 dark:text-slate-500">No products</p>
                </div>
              )}
            </div>
          </Card3D>

          {/* Top Customers */}
          <Card3D color="green" hover={false}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-200">Top Customers</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">By purchases in region</p>
              </div>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {clientes.slice(0, 6).map((c, idx) => (
                <div 
                  key={c.cliente_id}
                  className="p-3 bg-white/50 dark:bg-slate-800/50 rounded-xl border border-green-100 dark:border-green-800/50 hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}</span>
                      <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate max-w-28">{c.razon_social || 'Customer'}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{c.num_compras} purchases</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-green-600">{formatCompact(c.total_comprado)}</span>
                  </div>
                </div>
              ))}
              {clientes.length === 0 && (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-slate-200 dark:text-slate-500 mx-auto mb-2" />
                  <p className="text-sm text-slate-400 dark:text-slate-500">No customers</p>
                </div>
              )}
            </div>
          </Card3D>

          {/* Categories */}
          <Card3D color="purple" hover={false}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-200">Categories</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Share in region</p>
              </div>
            </div>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {categorias.slice(0, 6).map((cat) => (
                <div key={`${cat.categoria}-${cat.tienda}`} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-sky-100 text-sky-700 rounded-full text-xs font-semibold">BF</span>
                      <span className="text-sm text-slate-700 dark:text-slate-300 truncate max-w-20">{cat.categoria || 'No Cat.'}</span>
                    </div>
                    <span className="text-sm font-bold text-purple-600">{cat.porcentaje_region}%</span>
                  </div>
                  <ProgressBar3D
                    value={cat.porcentaje_region}
                    max={100}
                    label=""
                    showValue={false}
                    color="auto"
                  />
                </div>
              ))}
              {categorias.length === 0 && (
                <div className="text-center py-8">
                  <TrendingUp className="w-12 h-12 text-slate-200 dark:text-slate-500 mx-auto mb-2" />
                  <p className="text-sm text-slate-400 dark:text-slate-500">No data</p>
                </div>
              )}
            </div>
          </Card3D>
        </div>
      </div>

      {/* Premium Ranking Table */}
      <div className="card-3d p-6 animate-slide-in stagger-5" style={{ animationFillMode: 'backwards' }}>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2">
          <span className="text-2xl">🏆</span> Region Ranking
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-slate-200 dark:border-slate-700">
                <th className="text-left py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400 w-16">#</th>
                <th className="text-left py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Region</th>
                <th className="text-right py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Customers</th>
                <th className="text-right py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Transactions</th>
                <th className="text-right py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Total Sales</th>
                <th className="text-right py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Avg. Ticket</th>
                <th className="text-center py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Performance</th>
              </tr>
            </thead>
            <tbody>
              {topRegiones.map((r, idx) => {
                const isSelected = regionSeleccionada === r.region;
                const percentOfTop = topRegion ? (r.venta_total / topRegion.venta_total) * 100 : 0;
                
                return (
                  <tr 
                    key={r.region} 
                    onClick={() => setRegionSeleccionada(r.region)}
                    className={`
                      cursor-pointer transition-all duration-300 border-b border-slate-100 dark:border-slate-700
                      ${isSelected 
                        ? 'bg-gradient-to-r from-indigo-50 to-purple-50 shadow-md' 
                        : 'hover:bg-slate-50 dark:bg-slate-800/50'
                      }
                    `}
                  >
                    <td className="py-4 px-4">
                      <div className={`
                        w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg
                        ${idx === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg' :
                          idx === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white' :
                          idx === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white' :
                          'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                        }
                      `}>
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : r.ranking}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-200">{r.region}</p>
                          <div className="w-32 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mt-1">
                            <div 
                              className="h-full bg-gradient-to-r from-indigo-400 to-purple-500 rounded-full transition-all duration-500"
                              style={{ width: `${percentOfTop}%` }}
                            />
                          </div>
                        </div>
                        {isSelected && <ChevronRight className="w-5 h-5 text-indigo-500" />}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="font-medium text-slate-700 dark:text-slate-300">{r.clientes_activos}</span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="text-slate-600 dark:text-slate-400">{r.total_ventas}</span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="text-lg font-bold text-indigo-600">{formatCompact(r.venta_total)}</span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="font-medium text-slate-700 dark:text-slate-300">{formatCompact(r.ticket_promedio)}</span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className={`
                        inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold
                        ${percentOfTop >= 80 ? 'bg-green-100 text-green-700' :
                          percentOfTop >= 50 ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }
                      `}>
                        <div className={`
                          w-2 h-2 rounded-full
                          ${percentOfTop >= 80 ? 'bg-green-500' :
                            percentOfTop >= 50 ? 'bg-amber-500' : 'bg-red-500'
                          }
                        `} />
                        {percentOfTop.toFixed(0)}%
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px] text-slate-400 dark:text-slate-500 text-right mt-2">Source: Bsale regional data • Synced daily</p>
    </div>
  );
}
