'use client';

import { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Calendar, Target, Info, AlertCircle } from 'lucide-react';
import { formatCompact } from './ui';

// ============================================================================
// TYPES
// ============================================================================

export interface ForecastDataPoint {
  fecha: string;
  fecha_label?: string;
  
  // Valor real (null para fechas futuras)
  valor_real: number | null;
  
  // Predicción Prophet
  valor_predicho: number;
  limite_inferior: number;
  limite_superior: number;
  
  // Componentes del modelo
  tendencia?: number;
  estacionalidad?: number;
  efecto_feriado?: number;
  
  // Eventos especiales
  es_feriado?: boolean;
  nombre_evento?: string;
  es_cyber?: boolean;
}

interface ForecastChartProps {
  data: ForecastDataPoint[];
  title?: string;
  subtitle?: string;
  height?: number;
  brandColor?: 'bluefishing' | 'neutral';
  showComponents?: boolean;
  onPointClick?: (point: ForecastDataPoint) => void;
}

interface TooltipData {
  point: ForecastDataPoint;
  x: number;
  y: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

function calculateTrend(data: ForecastDataPoint[]): { direction: 'up' | 'down' | 'stable'; percentage: number } {
  const predicted = data.filter(d => d.valor_predicho != null);
  if (predicted.length < 2) return { direction: 'stable', percentage: 0 };
  
  const first = predicted[0].valor_predicho;
  const last = predicted[predicted.length - 1].valor_predicho;
  const percentage = ((last - first) / first) * 100;
  
  if (percentage > 2) return { direction: 'up', percentage };
  if (percentage < -2) return { direction: 'down', percentage };
  return { direction: 'stable', percentage };
}

// ============================================================================
// SVG PATH GENERATORS
// ============================================================================

function generateLinePath(
  points: { x: number; y: number }[],
  smooth = true
): string {
  if (points.length === 0) return '';
  
  if (!smooth || points.length < 3) {
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  }
  
  // Catmull-Rom to Bezier conversion for smooth curves
  let path = `M ${points[0].x} ${points[0].y}`;
  
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  
  return path;
}

function generateAreaPath(
  upperPoints: { x: number; y: number }[],
  lowerPoints: { x: number; y: number }[]
): string {
  if (upperPoints.length === 0) return '';
  
  const upperPath = generateLinePath(upperPoints, true);
  const lowerReversed = [...lowerPoints].reverse();
  
  let areaPath = upperPath;
  areaPath += ` L ${lowerReversed[0].x} ${lowerReversed[0].y}`;
  lowerReversed.slice(1).forEach(p => {
    areaPath += ` L ${p.x} ${p.y}`;
  });
  areaPath += ' Z';
  
  return areaPath;
}

// ============================================================================
// TOOLTIP COMPONENT
// ============================================================================

function ForecastTooltip({ data, x, y }: { data: TooltipData; x: number; y: number }) {
  const { point } = data;
  const isActual = point.valor_real !== null;
  
  // Calculate delta if we have both actual and predicted
  const delta = isActual && point.valor_real !== null
    ? ((point.valor_real - point.valor_predicho) / point.valor_predicho) * 100
    : null;
  
  return (
    <div 
      className="tooltip-rich animate-scale-in"
      style={{
        left: x,
        top: y,
        transform: 'translate(-50%, -100%) translateY(-16px)'
      }}
    >
      {/* Date header */}
      <div className="flex items-center justify-between gap-4 mb-2 pb-2 border-b border-slate-100 dark:border-slate-700">
        <span className="font-medium text-slate-600 dark:text-slate-400">
          {formatDate(point.fecha)}
        </span>
        {point.es_feriado && (
          <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
            {point.nombre_evento || 'Feriado'}
          </span>
        )}
        {point.es_cyber && (
          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
            CyberDay
          </span>
        )}
      </div>
      
      {/* Values */}
      <div className="space-y-1.5">
        {isActual && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Real:</span>
            <span className="tooltip-value">{formatCompact(point.valor_real!)}</span>
          </div>
        )}
        
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {isActual ? 'Predicho:' : 'Forecast:'}
          </span>
          <div className="flex items-center">
            <span className={`tooltip-value ${!isActual ? 'text-sky-600' : 'text-slate-400'}`}>
              {formatCompact(point.valor_predicho)}
            </span>
            {delta !== null && (
              <span className={`tooltip-delta ${delta >= 0 ? 'positive' : 'negative'}`}>
                {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
        
        {!isActual && (
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Rango 95%:</span>
            <span>{formatCompact(point.limite_inferior)} - {formatCompact(point.limite_superior)}</span>
          </div>
        )}
      </div>
      
      {/* Model components */}
      {point.tendencia !== undefined && (
        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-400">
          <div className="flex justify-between">
            <span>Tendencia:</span>
            <span className={point.tendencia >= 0 ? 'text-emerald-500' : 'text-red-500'}>
              {point.tendencia >= 0 ? '+' : ''}{formatCompact(point.tendencia)}
            </span>
          </div>
          {point.efecto_feriado && point.efecto_feriado !== 0 && (
            <div className="flex justify-between">
              <span>Efecto evento:</span>
              <span className="text-purple-500">+{formatCompact(point.efecto_feriado)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT: FORECAST CHART
// ============================================================================

export default function ForecastChart({
  data,
  title = 'Forecast de Ventas',
  subtitle = 'Predicción con intervalo de confianza 95%',
  height = 320,
  brandColor = 'neutral',
  showComponents = false,
  onPointClick
}: ForecastChartProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  // Chart dimensions
  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartWidth = 800;
  const chartHeight = height;
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;
  
  // Calculate scales
  const { xScale, yScale, points, actualPoints, predictedPoints, confidenceArea } = useMemo(() => {
    const allValues = data.flatMap(d => [
      d.valor_real ?? 0,
      d.valor_predicho,
      d.limite_superior,
      d.limite_inferior
    ]).filter(v => v > 0);
    
    const minY = Math.min(...allValues) * 0.9;
    const maxY = Math.max(...allValues) * 1.1;
    
    const xScale = (index: number) => padding.left + (index / (data.length - 1)) * innerWidth;
    const yScale = (value: number) => padding.top + innerHeight - ((value - minY) / (maxY - minY)) * innerHeight;
    
    const points = data.map((d, i) => ({
      x: xScale(i),
      y: d.valor_real !== null ? yScale(d.valor_real) : yScale(d.valor_predicho),
      data: d
    }));
    
    const actualPoints = data
      .map((d, i) => d.valor_real !== null ? { x: xScale(i), y: yScale(d.valor_real) } : null)
      .filter((p): p is { x: number; y: number } => p !== null);
    
    const predictedPoints = data.map((d, i) => ({
      x: xScale(i),
      y: yScale(d.valor_predicho)
    }));
    
    const upperPoints = data.map((d, i) => ({
      x: xScale(i),
      y: yScale(d.limite_superior)
    }));
    
    const lowerPoints = data.map((d, i) => ({
      x: xScale(i),
      y: yScale(d.limite_inferior)
    }));
    
    const confidenceArea = generateAreaPath(upperPoints, lowerPoints);
    
    return { xScale, yScale, points, actualPoints, predictedPoints, confidenceArea, minY, maxY };
  }, [data, innerWidth, innerHeight, padding]);
  
  // Trend calculation
  const trend = calculateTrend(data);
  
  // Brand colors
  const brandColors = {
    bluefishing: { primary: '#0ea5e9', gradient: 'from-sky-500 to-blue-600' },
    neutral: { primary: '#6366f1', gradient: 'from-indigo-500 to-purple-600' }
  };
  const colors = brandColors[brandColor];
  
  // Find transition point (last actual data point)
  const transitionIndex = data.findIndex(d => d.valor_real === null);
  const transitionX = transitionIndex > 0 ? xScale(transitionIndex - 1) : null;
  
  return (
    <div className="card-3d overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-500" />
              {title}
            </h3>
            <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
          </div>
          
          {/* Trend indicator */}
          <div className={`
            flex items-center gap-2 px-4 py-2 rounded-full
            ${trend.direction === 'up' ? 'bg-emerald-50 text-emerald-700' : ''}
            ${trend.direction === 'down' ? 'bg-red-50 text-red-700' : ''}
            ${trend.direction === 'stable' ? 'bg-slate-50 text-slate-600' : ''}
          `}>
            {trend.direction === 'up' && <TrendingUp className="w-4 h-4" />}
            {trend.direction === 'down' && <TrendingDown className="w-4 h-4" />}
            {trend.direction === 'stable' && <Minus className="w-4 h-4" />}
            <span className="text-sm font-semibold">
              {trend.direction === 'up' ? '+' : ''}{trend.percentage.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
      
      {/* Chart */}
      <div className="relative p-4">
        <svg 
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto"
          style={{ maxHeight: `${height}px` }}
        >
          <defs>
            {/* Confidence gradient */}
            <linearGradient id="confidenceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.primary} stopOpacity="0.3" />
              <stop offset="100%" stopColor={colors.primary} stopOpacity="0.05" />
            </linearGradient>
            
            {/* Actual line gradient */}
            <linearGradient id="actualGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="100%" stopColor="#64748b" />
            </linearGradient>
            
            {/* Prediction line gradient */}
            <linearGradient id="predictionGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={colors.primary} stopOpacity="1" />
              <stop offset="100%" stopColor={colors.primary} stopOpacity="0.7" />
            </linearGradient>
          </defs>
          
          {/* Grid lines */}
          {[0.25, 0.5, 0.75, 1].map((ratio) => (
            <g key={ratio}>
              <line
                x1={padding.left}
                y1={padding.top + innerHeight * (1 - ratio)}
                x2={padding.left + innerWidth}
                y2={padding.top + innerHeight * (1 - ratio)}
                stroke="#e2e8f0"
                strokeDasharray="4 4"
              />
            </g>
          ))}
          
          {/* Transition zone (where actual ends and forecast begins) */}
          {transitionX && (
            <g>
              <line
                x1={transitionX}
                y1={padding.top}
                x2={transitionX}
                y2={padding.top + innerHeight}
                stroke="#94a3b8"
                strokeDasharray="8 4"
                strokeWidth="1"
              />
              <text
                x={transitionX + 8}
                y={padding.top + 16}
                className="text-xs"
                fill="#64748b"
              >
                Hoy
              </text>
            </g>
          )}
          
          {/* Confidence interval (tunnel of uncertainty) */}
          <path
            d={confidenceArea}
            fill="url(#confidenceGradient)"
            className="transition-opacity duration-300"
          />
          
          {/* Upper and lower bounds */}
          <path
            d={generateLinePath(data.map((d, i) => ({ x: xScale(i), y: yScale(d.limite_superior) })))}
            fill="none"
            stroke={colors.primary}
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.4"
          />
          <path
            d={generateLinePath(data.map((d, i) => ({ x: xScale(i), y: yScale(d.limite_inferior) })))}
            fill="none"
            stroke={colors.primary}
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.4"
          />
          
          {/* Prediction line (dashed for future) */}
          <path
            d={generateLinePath(predictedPoints)}
            fill="none"
            stroke="url(#predictionGradient)"
            strokeWidth="2.5"
            strokeDasharray="8 4"
            className="animate-draw-line"
          />
          
          {/* Actual line (solid) */}
          {actualPoints.length > 0 && (
            <path
              d={generateLinePath(actualPoints)}
              fill="none"
              stroke="url(#actualGradient)"
              strokeWidth="3"
              strokeLinecap="round"
              className="animate-draw-line"
            />
          )}
          
          {/* Data points */}
          {points.map((point, i) => {
            const isActual = data[i].valor_real !== null;
            const isFeriado = data[i].es_feriado;
            const isHovered = hoveredIndex === i;
            
            return (
              <g 
                key={i}
                className="cursor-pointer"
                onMouseEnter={(e) => {
                  setHoveredIndex(i);
                  setTooltip({ point: point.data, x: point.x, y: point.y });
                }}
                onMouseLeave={() => {
                  setHoveredIndex(null);
                  setTooltip(null);
                }}
                onClick={() => onPointClick?.(point.data)}
              >
                {/* Hover highlight */}
                {isHovered && (
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="16"
                    fill={colors.primary}
                    opacity="0.1"
                    className="animate-scale-in"
                  />
                )}
                
                {/* Point */}
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isHovered ? 8 : 6}
                  fill={isActual ? '#334155' : colors.primary}
                  stroke="white"
                  strokeWidth="2"
                  className="transition-all duration-200"
                />
                
                {/* Holiday indicator */}
                {isFeriado && (
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="12"
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="2"
                    strokeDasharray="4 2"
                  />
                )}
              </g>
            );
          })}
          
          {/* X-axis labels */}
          {data.filter((_, i) => i % Math.ceil(data.length / 8) === 0).map((d, i, arr) => {
            const originalIndex = data.indexOf(d);
            return (
              <text
                key={originalIndex}
                x={xScale(originalIndex)}
                y={chartHeight - 8}
                textAnchor="middle"
                className="text-xs"
                fill="#64748b"
              >
                {d.fecha_label || formatDate(d.fecha)}
              </text>
            );
          })}
        </svg>
        
        {/* Tooltip */}
        {tooltip && (
          <ForecastTooltip data={tooltip} x={tooltip.x} y={tooltip.y} />
        )}
      </div>
      
      {/* Legend */}
      <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 dark:bg-slate-800 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-slate-600 rounded" />
              <span className="text-xs text-slate-600">Ventas Reales</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 rounded" style={{ 
                background: colors.primary,
                borderStyle: 'dashed',
                borderWidth: '0 0 2px 0',
                borderColor: colors.primary
              }} />
              <span className="text-xs text-slate-600">Forecast Prophet</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 rounded-sm opacity-30" style={{ background: colors.primary }} />
              <span className="text-xs text-slate-600">Intervalo 95%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border-2 border-purple-500 border-dashed" />
              <span className="text-xs text-slate-600">Evento Especial</span>
            </div>
          </div>
          
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <Info className="w-3 h-3" />
            <span>Click en un punto para ver detalle</span>
          </div>
        </div>
      </div>
    </div>
  );
}
