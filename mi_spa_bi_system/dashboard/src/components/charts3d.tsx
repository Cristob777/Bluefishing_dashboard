'use client';
import { ReactNode, useState } from 'react';

// ============================================================================
// GAUGE 3D - Medidor con efecto de profundidad
// ============================================================================
interface Gauge3DProps {
  value: number;
  max: number;
  label: string;
  sublabel?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Gauge3D({ value, max, label, sublabel, size = 'md' }: Gauge3DProps) {
  const percentage = Math.min((value / max) * 100, 100);
  const sizes = { sm: 140, md: 180, lg: 220 };
  const svgSize = sizes[size];
  const strokeWidth = size === 'sm' ? 12 : size === 'md' ? 16 : 20;
  const radius = (svgSize / 2) - strokeWidth - 5;
  const circumference = Math.PI * radius;
  
  // Color basado en porcentaje
  const getGradientColors = () => {
    if (percentage >= 75) return ['#10b981', '#059669', '#047857'];
    if (percentage >= 50) return ['#f59e0b', '#d97706', '#b45309'];
    return ['#ef4444', '#dc2626', '#b91c1c'];
  };
  const [c1, c2, c3] = getGradientColors();

  return (
    <div className="relative group" style={{ perspective: '500px' }}>
      <div 
        className="transition-transform duration-300 group-hover:scale-105"
        style={{ transformStyle: 'preserve-3d' }}
      >
        <svg width={svgSize} height={svgSize / 2 + 30} className="overflow-visible drop-shadow-xl">
          <defs>
            {/* Gradiente principal */}
            <linearGradient id={`gauge-grad-${label}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={c1} />
              <stop offset="50%" stopColor={c2} />
              <stop offset="100%" stopColor={c3} />
            </linearGradient>
            {/* Sombra interna */}
            <filter id="inner-shadow">
              <feOffset dx="0" dy="2" />
              <feGaussianBlur stdDeviation="3" result="offset-blur" />
              <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse" />
              <feFlood floodColor="black" floodOpacity="0.2" result="color" />
              <feComposite operator="in" in="color" in2="inverse" result="shadow" />
              <feComposite operator="over" in="shadow" in2="SourceGraphic" />
            </filter>
            {/* Brillo */}
            <linearGradient id="shine" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="white" stopOpacity="0.3" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </linearGradient>
          </defs>
          
          {/* Sombra del fondo */}
          <ellipse 
            cx={svgSize / 2} 
            cy={svgSize / 2 + 5} 
            rx={radius + 10} 
            ry={10}
            fill="rgba(0,0,0,0.1)"
          />
          
          {/* Arco de fondo con efecto 3D */}
          <path
            d={`M ${strokeWidth + 5} ${svgSize / 2} A ${radius} ${radius} 0 0 1 ${svgSize - strokeWidth - 5} ${svgSize / 2}`}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            filter="url(#inner-shadow)"
          />
          
          {/* Arco de valor con gradiente */}
          <path
            d={`M ${strokeWidth + 5} ${svgSize / 2} A ${radius} ${radius} 0 0 1 ${svgSize - strokeWidth - 5} ${svgSize / 2}`}
            fill="none"
            stroke={`url(#gauge-grad-${label})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - (circumference * percentage) / 100}
            className="transition-all duration-1000 ease-out"
            style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))' }}
          />
          
          {/* Brillo superior */}
          <path
            d={`M ${strokeWidth + 5} ${svgSize / 2} A ${radius} ${radius} 0 0 1 ${svgSize - strokeWidth - 5} ${svgSize / 2}`}
            fill="none"
            stroke="url(#shine)"
            strokeWidth={strokeWidth / 2}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - (circumference * percentage) / 100}
            opacity="0.5"
          />
          
          {/* Valor central */}
          <text
            x={svgSize / 2}
            y={svgSize / 2 - 5}
            textAnchor="middle"
            className="text-3xl font-black"
            fill={c2}
            style={{ textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
          >
            {percentage.toFixed(0)}%
          </text>
          <text
            x={svgSize / 2}
            y={svgSize / 2 + 18}
            textAnchor="middle"
            className="text-sm font-medium"
            fill="#6b7280"
          >
            {label}
          </text>
          {sublabel && (
            <text
              x={svgSize / 2}
              y={svgSize / 2 + 35}
              textAnchor="middle"
              className="text-xs"
              fill="#9ca3af"
            >
              {sublabel}
            </text>
          )}
        </svg>
      </div>
    </div>
  );
}

// ============================================================================
// CARD 3D - Tarjeta con efecto de elevación
// ============================================================================
interface Card3DProps {
  children: ReactNode;
  className?: string;
  color?: 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'indigo' | 'pink';
  hover?: boolean;
}

export function Card3D({ children, className = '', color = 'blue', hover = true }: Card3DProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  const colorStyles: Record<string, string> = {
    blue: 'from-blue-500/10 to-blue-600/5 border-blue-200/50',
    green: 'from-green-500/10 to-green-600/5 border-green-200/50',
    red: 'from-red-500/10 to-red-600/5 border-red-200/50',
    amber: 'from-amber-500/10 to-amber-600/5 border-amber-200/50',
    purple: 'from-purple-500/10 to-purple-600/5 border-purple-200/50',
    indigo: 'from-indigo-500/10 to-indigo-600/5 border-indigo-200/50',
    pink: 'from-pink-500/10 to-pink-600/5 border-pink-200/50',
  };

  return (
    <div
      className={`
        relative rounded-2xl bg-gradient-to-br ${colorStyles[color]}
        border backdrop-blur-sm
        transition-all duration-300 ease-out
        ${hover ? 'cursor-pointer' : ''}
        ${className}
      `}
      style={{
        transform: isHovered && hover ? 'translateY(-8px) scale(1.02)' : 'translateY(0) scale(1)',
        boxShadow: isHovered && hover
          ? '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255,255,255,0.1) inset'
          : '0 10px 30px -10px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255,255,255,0.05) inset',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Efecto de brillo superior */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
      <div className="relative z-10 p-5">
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// KPI CARD 3D - KPI con efectos premium
// ============================================================================
interface KPICard3DProps {
  title: string;
  value: string | number;
  subtitle?: string;
  delta?: number;
  icon?: ReactNode;
  color?: 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'pink';
  trend?: number[];
}

export function KPICard3D({ title, value, subtitle, delta, icon, color = 'blue', trend }: KPICard3DProps) {
  const colorMap: Record<string, { bg: string; light: string; text: string; hex: string }> = {
    blue: { bg: 'from-blue-500 to-blue-600', light: 'bg-blue-100', text: 'text-blue-600', hex: '#3b82f6' },
    green: { bg: 'from-green-500 to-green-600', light: 'bg-green-100', text: 'text-green-600', hex: '#22c55e' },
    red: { bg: 'from-red-500 to-red-600', light: 'bg-red-100', text: 'text-red-600', hex: '#ef4444' },
    amber: { bg: 'from-amber-500 to-amber-600', light: 'bg-amber-100', text: 'text-amber-600', hex: '#f59e0b' },
    purple: { bg: 'from-purple-500 to-purple-600', light: 'bg-purple-100', text: 'text-purple-600', hex: '#a855f7' },
    pink: { bg: 'from-pink-500 to-pink-600', light: 'bg-pink-100', text: 'text-pink-600', hex: '#ec4899' },
  };
  const c = colorMap[color] || colorMap.blue;

  const buildSparklinePath = (data: number[]) => {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const w = 100;
    const h = 32;
    const pad = 2;
    const points = data.map((v, i) => ({
      x: pad + (i / (data.length - 1)) * (w - pad * 2),
      y: h - pad - ((v - min) / range) * (h - pad * 2),
    }));
    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const area = `${line} L ${points[points.length - 1].x} ${h} L ${points[0].x} ${h} Z`;
    return { line, area, w, h };
  };

  return (
    <Card3D color={color}>
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white truncate">
              {value}
            </p>
            {delta !== undefined && (
              <span className={`flex items-center text-sm font-bold shrink-0 ${delta >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                <span className="text-base">{delta >= 0 ? '↑' : '↓'}</span>
                {Math.abs(delta).toFixed(1)}%
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{subtitle}</p>}
        </div>
        {icon && (
          <div className={`p-2.5 rounded-xl bg-gradient-to-br ${c.bg} shadow-lg shrink-0`}>
            <div className="text-white">{icon}</div>
          </div>
        )}
      </div>
      
      {trend && trend.length > 1 && (() => {
        const { line, area, w, h } = buildSparklinePath(trend);
        return (
          <div className="mt-3">
            <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-8" preserveAspectRatio="none">
              <defs>
                <linearGradient id={`spark-fill-${color}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={c.hex} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={c.hex} stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <path d={area} fill={`url(#spark-fill-${color})`} />
              <path d={line} fill="none" stroke={c.hex} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        );
      })()}
    </Card3D>
  );
}

// ============================================================================
// PROGRESS BAR 3D
// ============================================================================
interface ProgressBar3DProps {
  value: number;
  max: number;
  label: string;
  showValue?: boolean;
  color?: 'blue' | 'green' | 'red' | 'amber' | 'auto';
}

export function ProgressBar3D({ value, max, label, showValue = true, color = 'auto' }: ProgressBar3DProps) {
  const percentage = Math.min((value / max) * 100, 100);
  
  const getGradient = () => {
    if (color !== 'auto') {
      const gradients = {
        blue: 'from-blue-400 via-blue-500 to-blue-600',
        green: 'from-green-400 via-green-500 to-green-600',
        red: 'from-red-400 via-red-500 to-red-600',
        amber: 'from-amber-400 via-amber-500 to-amber-600',
      };
      return gradients[color];
    }
    if (percentage >= 75) return 'from-green-400 via-green-500 to-green-600';
    if (percentage >= 50) return 'from-amber-400 via-amber-500 to-amber-600';
    return 'from-red-400 via-red-500 to-red-600';
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-300">{label}</span>
        {showValue && <span className="font-bold text-slate-900 dark:text-white">{percentage.toFixed(0)}%</span>}
      </div>
      <div className="relative h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner">
        <div
          className={`absolute inset-y-0 left-0 bg-gradient-to-r ${getGradient()} rounded-full transition-all duration-700 ease-out`}
          style={{ 
            width: `${percentage}%`,
            boxShadow: '0 2px 4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.3)'
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent rounded-full" />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// STAT PILL - Estadística compacta
// ============================================================================
interface StatPillProps {
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'blue' | 'green' | 'red' | 'amber';
}

export function StatPill({ label, value, trend, color = 'blue' }: StatPillProps) {
  const colorStyles = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
  };
  
  const trendIcons = {
    up: <span className="text-green-500">↑</span>,
    down: <span className="text-red-500">↓</span>,
    neutral: <span className="text-gray-400">→</span>,
  };

  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${colorStyles[color]} shadow-sm`}>
      <span className="text-xs font-medium opacity-70">{label}</span>
      <span className="text-sm font-bold">{value}</span>
      {trend && trendIcons[trend]}
    </div>
  );
}

// ============================================================================
// DONUT 3D - Donut chart con efecto de profundidad
// ============================================================================
interface Donut3DProps {
  data: { name: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
}

export function Donut3D({ data, size = 200, thickness = 40 }: Donut3DProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  
  let currentAngle = -90; // Start from top

  return (
    <div className="relative group" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90 drop-shadow-xl">
        <defs>
          <filter id="donut-shadow">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.3" />
          </filter>
        </defs>
        
        {/* Sombra base */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={thickness}
          filter="url(#donut-shadow)"
        />
        
        {/* Segmentos */}
        {data.map((segment, index) => {
          const percentage = (segment.value / total) * 100;
          const dashLength = (circumference * percentage) / 100;
          const dashOffset = circumference - (circumference * (currentAngle + 90) / 360);
          const startAngle = currentAngle;
          currentAngle += (percentage / 100) * 360;
          
          return (
            <circle
              key={segment.name}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={thickness}
              strokeDasharray={`${dashLength} ${circumference - dashLength}`}
              strokeDashoffset={-((startAngle + 90) / 360) * circumference}
              className="transition-all duration-500 hover:opacity-80"
              style={{
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
              }}
            />
          );
        })}
        
        {/* Brillo interior */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius - thickness / 2 + 5}
          fill="none"
          stroke="white"
          strokeWidth="2"
          opacity="0.3"
        />
      </svg>
      
      {/* Centro */}
      <div 
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ 
          background: 'radial-gradient(circle, white 0%, transparent 70%)',
        }}
      >
        <p className="text-2xl font-black text-gray-800">{total.toLocaleString()}</p>
        <p className="text-xs text-gray-500">Total</p>
      </div>
    </div>
  );
}

// ============================================================================
// ANIMATED NUMBER - Número con animación
// ============================================================================
interface AnimatedNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

export function AnimatedNumber({ value, prefix = '', suffix = '', decimals = 0, className = '' }: AnimatedNumberProps) {
  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toFixed(decimals);
  };

  return (
    <span 
      className={`font-black tabular-nums ${className}`}
      style={{ 
        textShadow: '0 2px 4px rgba(0,0,0,0.1)',
        background: 'linear-gradient(135deg, #1f2937 0%, #374151 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }}
    >
      {prefix}{formatNumber(value)}{suffix}
    </span>
  );
}

// ============================================================================
// RANKING ITEM - Item de ranking con efectos
// ============================================================================
interface RankingItemProps {
  rank: number;
  label: string;
  value: number;
  maxValue: number;
  formatValue?: (v: number) => string;
  onClick?: () => void;
  isSelected?: boolean;
}

export function RankingItem({ rank, label, value, maxValue, formatValue = (v) => v.toLocaleString(), onClick, isSelected }: RankingItemProps) {
  const percentage = (value / maxValue) * 100;
  
  const getMedal = () => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return rank;
  };

  return (
    <div
      className={`
        relative p-3 rounded-xl transition-all duration-300 cursor-pointer
        ${isSelected 
          ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-2 border-blue-300 dark:border-blue-700 shadow-lg' 
          : 'bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600 hover:shadow-md'
        }
      `}
      onClick={onClick}
      style={{
        transform: isSelected ? 'translateX(8px)' : 'translateX(0)',
      }}
    >
      <div className="flex items-center gap-3">
        <div className={`
          w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shrink-0
          ${rank <= 3 ? 'bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/30 dark:to-amber-800/30' : 'bg-slate-100 dark:bg-slate-700'}
        `}>
          {getMedal()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{label}</p>
          <div className="mt-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-slate-900 dark:text-white">{formatValue(value)}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// METRIC COMPARISON - Comparación visual
// ============================================================================
interface MetricComparisonProps {
  label: string;
  current: number;
  previous: number;
  formatValue?: (v: number) => string;
}

export function MetricComparison({ label, current, previous, formatValue = (v) => v.toLocaleString() }: MetricComparisonProps) {
  const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  const isPositive = change >= 0;

  return (
    <div className="p-4 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-800/50 border border-slate-200 dark:border-slate-700">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
      <div className="mt-2 flex items-end justify-between">
        <div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{formatValue(current)}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">Actual</p>
        </div>
        <div className="text-right">
          <div className={`
            inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-bold
            ${isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
          `}>
            {isPositive ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
          </div>
          <p className="text-xs text-gray-400 mt-1">vs {formatValue(previous)}</p>
        </div>
      </div>
    </div>
  );
}

