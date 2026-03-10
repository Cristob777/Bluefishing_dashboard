'use client';

import { useState } from 'react';
import { Lock, Truck, Globe, TrendingUp, TrendingDown, AlertTriangle, ChevronRight, Package } from 'lucide-react';
import { formatCompact } from './ui';

// ============================================================================
// TYPES
// ============================================================================

export interface InventoryItem {
  producto_id: number;
  sku: string;
  nombre: string;
  tienda: 'BLUEFISHING';
  categoria?: string;
  
  // Stock por ubicación
  stock_casa_matriz: number;
  stock_web: number;
  stock_curanipe: number;
  stock_meli: number;
  stock_total: number;
  
  // Métricas de salud
  dias_cobertura: number;
  venta_diaria_promedio: number;
  lead_time_dias: number;
  
  // Forecasting
  demanda_forecast_30d?: number;
  tendencia?: 'CRECIENTE' | 'DECRECIENTE' | 'ESTABLE';
  
  // Flags especiales
  es_exclusivo_curanipe?: boolean;
}

interface InventoryStatusCardProps {
  items: InventoryItem[];
  onItemClick?: (item: InventoryItem) => void;
  maxItems?: number;
  showFilters?: boolean;
  brandFilter?: 'ALL' | 'BLUEFISHING';
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getStockHealthStatus(item: InventoryItem): 'healthy' | 'warning' | 'critical' {
  const { dias_cobertura, lead_time_dias } = item;
  
  // CRÍTICO: Stock menor que el lead time (no llegaría reposición a tiempo)
  if (dias_cobertura < lead_time_dias) return 'critical';
  
  // ADVERTENCIA: Stock cubre menos de 1.5x el lead time
  if (dias_cobertura < lead_time_dias * 1.5) return 'warning';
  
  // SALUDABLE: Stock cubre más de 60 días o más de 2x lead time
  return 'healthy';
}

function getStockHealthLabel(status: 'healthy' | 'warning' | 'critical'): string {
  switch (status) {
    case 'healthy': return 'Stock Saludable';
    case 'warning': return 'Stock Bajo';
    case 'critical': return 'Quiebre Inminente';
  }
}

function getTrendIcon(tendencia?: string) {
  switch (tendencia) {
    case 'CRECIENTE':
      return <TrendingUp className="w-4 h-4 text-emerald-500" />;
    case 'DECRECIENTE':
      return <TrendingDown className="w-4 h-4 text-red-500" />;
    default:
      return null;
  }
}

// ============================================================================
// VISUAL BAR COMPONENT
// ============================================================================

function StockVisualBar({ 
  value, 
  max, 
  status 
}: { 
  value: number; 
  max: number; 
  status: 'healthy' | 'warning' | 'critical';
}) {
  const percentage = Math.min((value / max) * 100, 100);
  
  return (
    <div className="visual-bar w-full h-2">
      <div 
        className={`visual-bar-fill ${status}`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

// ============================================================================
// LOCATION BADGES
// ============================================================================

function LocationBadge({ 
  location, 
  stock, 
  isExclusive = false 
}: { 
  location: string; 
  stock: number; 
  isExclusive?: boolean;
}) {
  const getIcon = () => {
    switch (location) {
      case 'Casa Matriz': return <Truck className="w-3 h-3" />;
      case 'Web': return <Globe className="w-3 h-3" />;
      case 'Curanipe': return isExclusive ? <Lock className="w-3 h-3" /> : <Package className="w-3 h-3" />;
      case 'MELI': return <Package className="w-3 h-3" />;
      default: return <Package className="w-3 h-3" />;
    }
  };
  
  return (
    <div className={`
      flex items-center gap-1.5 px-2 py-1 rounded text-xs
      ${isExclusive 
        ? 'bg-amber-100 text-amber-800 border border-amber-200' 
        : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
      }
    `}>
      {getIcon()}
      <span className="font-medium">{location}</span>
      <span className="font-bold">{stock}</span>
      {isExclusive && (
        <span className="badge-physical-exclusive ml-1">
          <Lock className="w-2.5 h-2.5" />
          Físico Exclusivo
        </span>
      )}
    </div>
  );
}

// ============================================================================
// SINGLE INVENTORY ITEM ROW
// ============================================================================

function InventoryItemRow({ 
  item, 
  onClick,
  maxStock
}: { 
  item: InventoryItem; 
  onClick?: () => void;
  maxStock: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const status = getStockHealthStatus(item);
  
  const stockLocations = [
    { name: 'Casa Matriz', stock: item.stock_casa_matriz },
    { name: 'Web', stock: item.stock_web },
    { name: 'Curanipe', stock: item.stock_curanipe, isExclusive: item.es_exclusivo_curanipe },
    { name: 'MELI', stock: item.stock_meli },
  ].filter(loc => loc.stock > 0);
  
  return (
    <div 
      className={`
        group relative rounded-xl border transition-all duration-200
        ${status === 'critical' ? 'border-red-200 bg-red-50/50 dark:bg-red-950/20' : ''}
        ${status === 'warning' ? 'border-amber-200 bg-amber-50/50 dark:bg-amber-950/20' : ''}
        ${status === 'healthy' ? 'border-slate-200 bg-white dark:bg-slate-800' : ''}
        hover:shadow-md cursor-pointer
      `}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      {/* Header Row */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Product Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {/* Brand indicator */}
              <span className="w-2 h-2 rounded-full bg-gradient-to-r from-sky-500 to-blue-600" />
              
              <span className="text-xs font-mono text-slate-400">{item.sku}</span>
              
              {item.categoria && (
                <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded dark:bg-slate-700 dark:text-slate-400">
                  {item.categoria}
                </span>
              )}
            </div>
            
            <h4 className="font-semibold text-slate-800 dark:text-slate-200 truncate pr-4">
              {item.nombre}
            </h4>
            
            {/* Quick metrics */}
            <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
              <span>Venta: {item.venta_diaria_promedio.toFixed(1)}/día</span>
              <span>Lead Time: {item.lead_time_dias}d</span>
              {item.tendencia && (
                <span className="flex items-center gap-1">
                  {getTrendIcon(item.tendencia)}
                  {item.tendencia.toLowerCase()}
                </span>
              )}
            </div>
          </div>
          
          {/* Stock Summary */}
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
              <span className={`status-dot ${status}`} />
              <span className={`text-xs font-medium ${
                status === 'critical' ? 'text-red-600' :
                status === 'warning' ? 'text-amber-600' :
                'text-emerald-600'
              }`}>
                {getStockHealthLabel(status)}
              </span>
            </div>
            
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-200 mt-1">
              {item.stock_total.toLocaleString()}
            </p>
            
            <p className="text-xs text-slate-400">
              {item.dias_cobertura} días de cobertura
            </p>
          </div>
        </div>
        
        {/* Visual Bar */}
        <div className="mt-3">
          <StockVisualBar 
            value={item.stock_total} 
            max={maxStock} 
            status={status}
          />
        </div>
        
        {/* Expand indicator */}
        <div className="flex items-center justify-center mt-2">
          <ChevronRight className={`
            w-4 h-4 text-slate-400 transition-transform duration-200
            ${isExpanded ? 'rotate-90' : ''}
          `} />
        </div>
      </div>
      
      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-0 border-t border-slate-100 dark:border-slate-700 animate-slide-in">
          <div className="mt-3">
            <p className="text-xs font-medium text-slate-500 mb-2">Distribución por Bodega:</p>
            <div className="flex flex-wrap gap-2">
              {stockLocations.map(loc => (
                <LocationBadge 
                  key={loc.name}
                  location={loc.name}
                  stock={loc.stock}
                  isExclusive={loc.isExclusive}
                />
              ))}
            </div>
          </div>
          
          {/* Curanipe Warning */}
          {item.es_exclusivo_curanipe && item.stock_curanipe > 0 && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg dark:bg-amber-950/30 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <Lock className="w-4 h-4 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                    Stock Físico Exclusivo - Curanipe
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    {item.stock_curanipe} unidades NO disponibles para e-commerce. 
                    Solo venta en tienda física.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Forecast info */}
          {item.demanda_forecast_30d && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="p-2 bg-slate-50 rounded-lg dark:bg-slate-700">
                <p className="text-xs text-slate-500">Demanda Forecast 30d</p>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-200">
                  {Math.round(item.demanda_forecast_30d).toLocaleString()}
                </p>
              </div>
              <div className="p-2 bg-slate-50 rounded-lg dark:bg-slate-700">
                <p className="text-xs text-slate-500">Stock Web Disponible</p>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-200">
                  {(item.stock_total - (item.es_exclusivo_curanipe ? item.stock_curanipe : 0)).toLocaleString()}
                </p>
              </div>
            </div>
          )}
          
          {/* Action button */}
          {onClick && (
            <button
              onClick={(e) => { e.stopPropagation(); onClick(); }}
              className="mt-3 w-full py-2 text-sm font-medium text-slate-600 bg-slate-100 
                         hover:bg-slate-200 rounded-lg transition-colors
                         dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
            >
              Ver Detalle Completo →
            </button>
          )}
        </div>
      )}
      
      {/* Critical Alert Indicator */}
      {status === 'critical' && (
        <div className="absolute top-2 right-2">
          <div className="animate-pulse">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT: INVENTORY STATUS CARD
// ============================================================================

export default function InventoryStatusCard({
  items,
  onItemClick,
  maxItems = 10,
  showFilters = true,
  brandFilter = 'ALL'
}: InventoryStatusCardProps) {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'critical' | 'warning' | 'healthy'>('ALL');
  const [sortBy, setSortBy] = useState<'coverage' | 'stock' | 'sales'>('coverage');
  
  // Filter items
  let filteredItems = items;
  
  if (brandFilter !== 'ALL') {
    filteredItems = filteredItems.filter(item => item.tienda === brandFilter);
  }
  
  if (statusFilter !== 'ALL') {
    filteredItems = filteredItems.filter(item => getStockHealthStatus(item) === statusFilter);
  }
  
  // Sort items
  filteredItems = [...filteredItems].sort((a, b) => {
    switch (sortBy) {
      case 'coverage':
        return a.dias_cobertura - b.dias_cobertura; // Lowest coverage first (most urgent)
      case 'stock':
        return b.stock_total - a.stock_total; // Highest stock first
      case 'sales':
        return b.venta_diaria_promedio - a.venta_diaria_promedio; // Highest sales first
      default:
        return 0;
    }
  });
  
  // Get max stock for visual bar scaling
  const maxStock = Math.max(...filteredItems.map(i => i.stock_total), 1);
  
  // Summary stats
  const criticalCount = items.filter(i => getStockHealthStatus(i) === 'critical').length;
  const warningCount = items.filter(i => getStockHealthStatus(i) === 'warning').length;
  const healthyCount = items.filter(i => getStockHealthStatus(i) === 'healthy').length;
  
  return (
    <div className="card-3d overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Package className="w-5 h-5 text-indigo-500" />
              Estado del Inventario
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Matriz híbrida de stock por ubicación
            </p>
          </div>
          
          {/* Summary badges */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStatusFilter(statusFilter === 'critical' ? 'ALL' : 'critical')}
              className={`status-badge-critical ${statusFilter === 'critical' ? 'ring-2 ring-red-300' : ''}`}
            >
              <AlertTriangle className="w-3 h-3" />
              {criticalCount} Críticos
            </button>
            <button
              onClick={() => setStatusFilter(statusFilter === 'warning' ? 'ALL' : 'warning')}
              className={`status-badge-warning ${statusFilter === 'warning' ? 'ring-2 ring-amber-300' : ''}`}
            >
              {warningCount} Advertencia
            </button>
            <button
              onClick={() => setStatusFilter(statusFilter === 'healthy' ? 'ALL' : 'healthy')}
              className={`status-badge-healthy ${statusFilter === 'healthy' ? 'ring-2 ring-emerald-300' : ''}`}
            >
              {healthyCount} Saludables
            </button>
          </div>
        </div>
        
        {/* Filters */}
        {showFilters && (
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Ordenar por:</span>
              <div className="tab-group-premium">
                <button 
                  className={`tab-premium ${sortBy === 'coverage' ? 'active' : ''}`}
                  onClick={() => setSortBy('coverage')}
                >
                  Cobertura
                </button>
                <button 
                  className={`tab-premium ${sortBy === 'stock' ? 'active' : ''}`}
                  onClick={() => setSortBy('stock')}
                >
                  Stock
                </button>
                <button 
                  className={`tab-premium ${sortBy === 'sales' ? 'active' : ''}`}
                  onClick={() => setSortBy('sales')}
                >
                  Ventas
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Items List */}
      <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
        {filteredItems.slice(0, maxItems).map((item, idx) => (
          <div 
            key={item.producto_id} 
            className="animate-slide-in"
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            <InventoryItemRow
              item={item}
              onClick={onItemClick ? () => onItemClick(item) : undefined}
              maxStock={maxStock}
            />
          </div>
        ))}
        
        {filteredItems.length === 0 && (
          <div className="text-center py-8">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No hay productos que coincidan con los filtros</p>
          </div>
        )}
        
        {filteredItems.length > maxItems && (
          <div className="text-center py-4">
            <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
              Ver {filteredItems.length - maxItems} productos más →
            </button>
          </div>
        )}
      </div>
      
      {/* Footer with Curanipe Legend */}
      <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 dark:bg-slate-800 dark:border-slate-700">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Lock className="w-3 h-3" />
          <span>
            Los productos marcados con <span className="badge-physical-exclusive inline mx-1">Físico Exclusivo</span> 
            son de la bodega Curanipe y NO están disponibles para venta online.
          </span>
        </div>
      </div>
    </div>
  );
}
