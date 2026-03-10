'use client';
import { Card, Metric, Text, Flex, BadgeDelta } from '@tremor/react';
import { clsx } from 'clsx';

// ============================================================================
// FORMATTING UTILITIES
// ============================================================================

export function formatCLP(value: number): string {
  return new Intl.NumberFormat('es-CL', { 
    style: 'currency', 
    currency: 'CLP', 
    maximumFractionDigits: 0 
  }).format(value);
}

export function formatCompact(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}MM`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return formatCLP(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-CL').format(value);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatDelta(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

// ============================================================================
// BRAND UTILITIES
// ============================================================================

export type TiendaTipo = 'BLUEFISHING';

export const BRAND_COLORS = {
  BLUEFISHING: {
    primary: '#0ea5e9',
    light: '#bae6fd',
    dark: '#0369a1',
    gradient: 'from-sky-500 to-blue-600',
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
  },
} as const;

export function getBrandColor(tienda: TiendaTipo) {
  return BRAND_COLORS[tienda];
}

// ============================================================================
// STORE BADGE COMPONENT
// ============================================================================

interface StoreBadgeProps {
  tienda: TiendaTipo;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'default' | 'pill' | 'dot';
  showIcon?: boolean;
  showLabel?: boolean;
}

export function StoreBadge({ 
  tienda, 
  size = 'md', 
  variant = 'default',
  showIcon = true,
  showLabel = true 
}: StoreBadgeProps) {
  const colors = BRAND_COLORS.BLUEFISHING;
  
  const sizes = { 
    xs: 'text-[10px] px-1.5 py-0.5',
    sm: 'text-xs px-2 py-0.5', 
    md: 'text-sm px-2.5 py-1', 
    lg: 'text-base px-3 py-1.5' 
  };
  
  if (variant === 'dot') {
    return (
      <span 
        className="inline-block w-2 h-2 rounded-full bg-gradient-to-r from-sky-500 to-blue-600"
        title={tienda}
      />
    );
  }
  
  if (variant === 'pill') {
    return (
      <span 
        className={clsx(
          'inline-flex items-center gap-1 rounded-full font-semibold text-white',
          sizes[size],
          'bg-gradient-to-r from-sky-500 to-blue-600'
        )}
      >
        {showIcon && <span>🎣</span>}
        {showLabel && <span>BLUEFISHING</span>}
      </span>
    );
  }
  
  return (
    <span 
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        sizes[size],
        colors.bg,
        colors.text,
        `border ${colors.border}`
      )}
    >
      {showIcon && <span>🎣</span>}
      {showLabel && <span>BLUEFISHING</span>}
    </span>
  );
}

// ============================================================================
// STATUS BADGE COMPONENT
// ============================================================================

type StatusType = 'healthy' | 'warning' | 'critical' | 'info' | 'neutral';

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
}

export function StatusBadge({ status, label, size = 'md', showDot = true }: StatusBadgeProps) {
  const statusConfig = {
    healthy: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', border: 'border-emerald-200' },
    warning: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', border: 'border-amber-200' },
    critical: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', border: 'border-red-200' },
    info: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', border: 'border-blue-200' },
    neutral: { bg: 'bg-slate-50', text: 'text-slate-700', dot: 'bg-slate-400', border: 'border-slate-200' },
  };
  
  const sizes = { sm: 'text-xs px-2 py-0.5', md: 'text-sm px-2.5 py-1', lg: 'text-base px-3 py-1.5' };
  const config = statusConfig[status];
  
  const defaultLabels = {
    healthy: 'Saludable',
    warning: 'Advertencia',
    critical: 'Crítico',
    info: 'Información',
    neutral: 'Normal',
  };
  
  return (
    <span 
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full font-medium border',
        sizes[size],
        config.bg,
        config.text,
        config.border
      )}
    >
      {showDot && (
        <span className={clsx('w-1.5 h-1.5 rounded-full', config.dot)} />
      )}
      <span>{label || defaultLabels[status]}</span>
    </span>
  );
}

// ============================================================================
// TREND INDICATOR
// ============================================================================

interface TrendIndicatorProps {
  value: number;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
}

export function TrendIndicator({ value, size = 'md', showValue = true }: TrendIndicatorProps) {
  const isPositive = value >= 0;
  const isNeutral = Math.abs(value) < 0.5;
  
  const sizes = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' };
  
  if (isNeutral) {
    return (
      <span className={clsx('inline-flex items-center gap-1 text-slate-500', sizes[size])}>
        <span>→</span>
        {showValue && <span>{formatDelta(value)}</span>}
      </span>
    );
  }
  
  return (
    <span 
      className={clsx(
        'inline-flex items-center gap-1 font-medium',
        sizes[size],
        isPositive ? 'text-emerald-600' : 'text-red-600'
      )}
    >
      <span className="text-lg">{isPositive ? '↑' : '↓'}</span>
      {showValue && <span>{formatDelta(value)}</span>}
    </span>
  );
}

export function KPICard({ title, value, subtitle, trend, icon, color = 'slate' }: {
  title: string; value: string | number; subtitle?: string; trend?: number; icon?: React.ReactNode; color?: 'slate' | 'red' | 'blue' | 'green' | 'amber';
}) {
  const colors = { slate: 'border-l-slate-500', red: 'border-l-red-500', blue: 'border-l-blue-500', green: 'border-l-green-500', amber: 'border-l-amber-500' };
  return (
    <Card className={clsx('border-l-4', colors[color])}>
      <Flex alignItems="start">
        <div className="truncate">
          <Text>{title}</Text>
          <Metric className="truncate">{value}</Metric>
          {subtitle && <Text className="text-slate-500">{subtitle}</Text>}
        </div>
        {icon && <div className="p-2 bg-slate-100 rounded-lg">{icon}</div>}
      </Flex>
      {trend !== undefined && (
        <Flex className="mt-4 space-x-2">
          <BadgeDelta deltaType={trend > 0 ? 'increase' : trend < 0 ? 'decrease' : 'unchanged'}>
            {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
          </BadgeDelta>
        </Flex>
      )}
    </Card>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse bg-slate-200 rounded', className)} />;
}
