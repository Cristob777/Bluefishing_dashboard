'use client';
import { ReactNode } from 'react';

// ============================================================================
// GAUGE / MEDIDOR SEMICIRCULAR
// ============================================================================
interface GaugeProps {
  value: number;
  max: number;
  label: string;
  color?: 'blue' | 'green' | 'red' | 'amber';
  size?: 'sm' | 'md' | 'lg';
  showTarget?: number;
}

export function Gauge({ value, max, label, color = 'blue', size = 'md', showTarget }: GaugeProps) {
  const percentage = Math.min((value / max) * 100, 100);
  const angle = (percentage / 100) * 180;
  
  const sizes = { sm: 120, md: 160, lg: 200 };
  const svgSize = sizes[size];
  const strokeWidth = size === 'sm' ? 8 : size === 'md' ? 10 : 12;
  const radius = (svgSize / 2) - strokeWidth;
  const circumference = Math.PI * radius;
  
  const colors = {
    blue: { main: '#3b82f6', bg: '#dbeafe' },
    green: { main: '#10b981', bg: '#d1fae5' },
    red: { main: '#ef4444', bg: '#fee2e2' },
    amber: { main: '#f59e0b', bg: '#fef3c7' },
  };
  
  const getStatusColor = () => {
    if (percentage >= 80) return colors.green;
    if (percentage >= 50) return colors.amber;
    return colors.red;
  };
  
  const activeColor = color === 'blue' ? getStatusColor() : colors[color];

  return (
    <div className="flex flex-col items-center">
      <svg width={svgSize} height={svgSize / 2 + 20} className="overflow-visible">
        {/* Background arc */}
        <path
          d={`M ${strokeWidth} ${svgSize / 2} A ${radius} ${radius} 0 0 1 ${svgSize - strokeWidth} ${svgSize / 2}`}
          fill="none"
          stroke={activeColor.bg}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d={`M ${strokeWidth} ${svgSize / 2} A ${radius} ${radius} 0 0 1 ${svgSize - strokeWidth} ${svgSize / 2}`}
          fill="none"
          stroke={activeColor.main}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (circumference * percentage) / 100}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
        {/* Target marker */}
        {showTarget && (
          <line
            x1={svgSize / 2 + radius * Math.cos(Math.PI - (showTarget / max) * Math.PI)}
            y1={svgSize / 2 - radius * Math.sin((showTarget / max) * Math.PI)}
            x2={svgSize / 2 + (radius - 15) * Math.cos(Math.PI - (showTarget / max) * Math.PI)}
            y2={svgSize / 2 - (radius - 15) * Math.sin((showTarget / max) * Math.PI)}
            stroke="#374151"
            strokeWidth="3"
            strokeLinecap="round"
          />
        )}
        {/* Value text */}
        <text
          x={svgSize / 2}
          y={svgSize / 2 - 5}
          textAnchor="middle"
          className="text-2xl font-bold fill-gray-800"
        >
          {percentage.toFixed(0)}%
        </text>
        <text
          x={svgSize / 2}
          y={svgSize / 2 + 15}
          textAnchor="middle"
          className="text-xs fill-gray-500"
        >
          {label}
        </text>
      </svg>
    </div>
  );
}

// ============================================================================
// BULLET CHART - Actual vs Target
// ============================================================================
interface BulletChartProps {
  actual: number;
  target: number;
  max?: number;
  label: string;
  formatValue?: (v: number) => string;
}

export function BulletChart({ actual, target, max, label, formatValue = (v) => v.toLocaleString() }: BulletChartProps) {
  const maxValue = max || Math.max(actual, target) * 1.2;
  const actualPercent = (actual / maxValue) * 100;
  const targetPercent = (target / maxValue) * 100;
  const isAhead = actual >= target;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        <span className={`font-semibold ${isAhead ? 'text-green-600' : 'text-red-600'}`}>
          {formatValue(actual)} / {formatValue(target)}
        </span>
      </div>
      <div className="relative h-6 bg-gray-100 rounded overflow-hidden">
        {/* Target zone (light) */}
        <div 
          className="absolute h-full bg-gray-200"
          style={{ width: `${targetPercent}%` }}
        />
        {/* Actual bar */}
        <div 
          className={`absolute h-full ${isAhead ? 'bg-green-500' : 'bg-blue-500'} transition-all duration-500`}
          style={{ width: `${Math.min(actualPercent, 100)}%` }}
        />
        {/* Target marker */}
        <div 
          className="absolute h-full w-1 bg-gray-800"
          style={{ left: `${targetPercent}%` }}
        />
        {/* Indicator */}
        {isAhead && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-white font-medium">
            ✓
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// PROGRESS BAR con indicador
// ============================================================================
interface ProgressBarProps {
  value: number;
  max: number;
  label: string;
  showPercentage?: boolean;
  color?: 'auto' | 'blue' | 'green' | 'red' | 'amber';
  size?: 'sm' | 'md';
}

export function ProgressBar({ value, max, label, showPercentage = true, color = 'auto', size = 'md' }: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100);
  
  const getColor = () => {
    if (color !== 'auto') {
      const colors = { blue: 'bg-blue-500', green: 'bg-green-500', red: 'bg-red-500', amber: 'bg-amber-500' };
      return colors[color];
    }
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">{label}</span>
        {showPercentage && <span className="font-medium">{percentage.toFixed(0)}%</span>}
      </div>
      <div className={`w-full bg-gray-200 rounded-full ${size === 'sm' ? 'h-2' : 'h-3'}`}>
        <div
          className={`${getColor()} ${size === 'sm' ? 'h-2' : 'h-3'} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// SPARKLINE - Mini gráfico de tendencia
// ============================================================================
interface SparklineProps {
  data: number[];
  color?: 'blue' | 'green' | 'red';
  width?: number;
  height?: number;
  showDots?: boolean;
}

export function Sparkline({ data, color = 'blue', width = 80, height = 24, showDots = false }: SparklineProps) {
  if (!data.length) return null;
  
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  
  const colors = { blue: '#3b82f6', green: '#10b981', red: '#ef4444' };
  const trend = data[data.length - 1] > data[0] ? 'up' : data[data.length - 1] < data[0] ? 'down' : 'flat';
  const trendColor = trend === 'up' ? colors.green : trend === 'down' ? colors.red : colors.blue;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color === 'blue' ? trendColor : colors[color]}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDots && data.map((value, index) => {
        const x = (index / (data.length - 1)) * width;
        const y = height - ((value - min) / range) * height;
        return (
          <circle
            key={index}
            cx={x}
            cy={y}
            r="2"
            fill={index === data.length - 1 ? colors[color] : '#9ca3af'}
          />
        );
      })}
    </svg>
  );
}

// ============================================================================
// INDICADOR SEMÁFORO
// ============================================================================
interface TrafficLightProps {
  status: 'green' | 'yellow' | 'red';
  label?: string;
  size?: 'sm' | 'md';
}

export function TrafficLight({ status, label, size = 'md' }: TrafficLightProps) {
  const sizeClass = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  const colors = {
    green: 'bg-green-500 shadow-green-500/50',
    yellow: 'bg-yellow-500 shadow-yellow-500/50',
    red: 'bg-red-500 shadow-red-500/50',
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`${sizeClass} ${colors[status]} rounded-full shadow-lg`} />
      {label && <span className="text-sm text-gray-600">{label}</span>}
    </div>
  );
}

// ============================================================================
// VARIACIÓN / DELTA INDICATOR
// ============================================================================
interface DeltaProps {
  value: number;
  suffix?: string;
  positiveIsGood?: boolean;
}

export function Delta({ value, suffix = '%', positiveIsGood = true }: DeltaProps) {
  const isPositive = value > 0;
  const isGood = positiveIsGood ? isPositive : !isPositive;
  
  return (
    <span className={`inline-flex items-center gap-0.5 text-sm font-medium ${isGood ? 'text-green-600' : 'text-red-600'}`}>
      {isPositive ? '↑' : '↓'}
      {Math.abs(value).toFixed(1)}{suffix}
    </span>
  );
}

// ============================================================================
// KPI CARD MEJORADO
// ============================================================================
interface KPICardAdvancedProps {
  title: string;
  value: string | number;
  subtitle?: string;
  delta?: number;
  deltaLabel?: string;
  sparklineData?: number[];
  icon?: ReactNode;
  status?: 'green' | 'yellow' | 'red';
  target?: { value: number; current: number };
}

export function KPICardAdvanced({ 
  title, value, subtitle, delta, deltaLabel, sparklineData, icon, status, target 
}: KPICardAdvancedProps) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm text-gray-500 font-medium">{title}</p>
            {status && <TrafficLight status={status} size="sm" />}
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {delta !== undefined && <Delta value={delta} />}
          </div>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
          {deltaLabel && <p className="text-xs text-gray-400">{deltaLabel}</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
          {icon && <div className="p-2 bg-blue-50 rounded-lg">{icon}</div>}
          {sparklineData && <Sparkline data={sparklineData} />}
        </div>
      </div>
      {target && (
        <div className="mt-3">
          <ProgressBar 
            value={target.current} 
            max={target.value} 
            label={`Meta: ${target.value.toLocaleString()}`}
            size="sm"
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// HEATMAP SIMPLE
// ============================================================================
interface HeatmapProps {
  data: { x: string; y: string; value: number }[];
  xLabels: string[];
  yLabels: string[];
  colorScale?: 'blue' | 'green' | 'red';
}

export function Heatmap({ data, xLabels, yLabels, colorScale = 'blue' }: HeatmapProps) {
  const maxValue = Math.max(...data.map(d => d.value));
  
  const getColor = (value: number) => {
    const intensity = value / maxValue;
    if (colorScale === 'blue') {
      return `rgba(59, 130, 246, ${0.1 + intensity * 0.9})`;
    } else if (colorScale === 'green') {
      return `rgba(16, 185, 129, ${0.1 + intensity * 0.9})`;
    }
    return `rgba(239, 68, 68, ${0.1 + intensity * 0.9})`;
  };

  return (
    <div className="overflow-x-auto">
      <div className="inline-grid gap-1" style={{ gridTemplateColumns: `auto repeat(${xLabels.length}, 1fr)` }}>
        {/* Header row */}
        <div />
        {xLabels.map(label => (
          <div key={label} className="text-xs text-center text-gray-500 px-2 py-1">{label}</div>
        ))}
        
        {/* Data rows */}
        {yLabels.map(yLabel => (
          <>
            <div key={`y-${yLabel}`} className="text-xs text-gray-500 pr-2 flex items-center">{yLabel}</div>
            {xLabels.map(xLabel => {
              const cell = data.find(d => d.x === xLabel && d.y === yLabel);
              return (
                <div
                  key={`${xLabel}-${yLabel}`}
                  className="w-10 h-8 rounded flex items-center justify-center text-xs font-medium"
                  style={{ backgroundColor: getColor(cell?.value || 0) }}
                  title={`${yLabel}, ${xLabel}: ${cell?.value || 0}`}
                >
                  {cell?.value ? (cell.value > 999 ? `${(cell.value/1000).toFixed(0)}k` : cell.value) : '-'}
                </div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// COMPARATIVA HORIZONTAL (estilo Regional Sales Report)
// ============================================================================
interface ComparisonBarProps {
  label: string;
  actual: number;
  target: number;
  formatValue?: (v: number) => string;
}

export function ComparisonBar({ label, actual, target, formatValue = (v) => v.toLocaleString() }: ComparisonBarProps) {
  const percentage = (actual / target) * 100;
  const isAhead = actual >= target;
  const maxWidth = Math.max(actual, target);
  
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-24 text-sm text-gray-600 truncate">{label}</div>
      <div className="flex-1 flex items-center gap-2">
        {/* Actual bar */}
        <div className="flex-1 h-5 bg-gray-100 rounded relative">
          <div
            className={`h-full rounded ${isAhead ? 'bg-green-500' : 'bg-red-500'}`}
            style={{ width: `${(actual / maxWidth) * 100}%` }}
          />
          {/* Target line */}
          <div
            className="absolute top-0 h-full w-0.5 bg-gray-800"
            style={{ left: `${(target / maxWidth) * 100}%` }}
          />
        </div>
        <div className="w-20 text-right">
          <span className={`text-sm font-semibold ${isAhead ? 'text-green-600' : 'text-red-600'}`}>
            {formatValue(actual)}
          </span>
        </div>
        <TrafficLight status={isAhead ? 'green' : percentage > 80 ? 'yellow' : 'red'} size="sm" />
      </div>
    </div>
  );
}

