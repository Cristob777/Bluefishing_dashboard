'use client';
import { useEffect, useState } from 'react';
import { BarChart, DonutChart, Badge } from '@tremor/react';
import { Receipt, AlertCircle, CheckCircle, Clock, Banknote, TrendingUp, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DEMO_MODE } from '@/lib/demo-mode';
import { getDemoCobranza } from '@/lib/demo-data';
import { formatCompact, Skeleton } from '@/components/ui';
import { Card3D, KPICard3D, Gauge3D, Donut3D, ProgressBar3D } from '@/components/charts3d';

interface ResumenCobranza {
  tienda: string;
  estado: string;
  num_documentos: number;
  monto_total: number;
  monto_pagado: number;
  monto_pendiente: number;
}

interface DocumentoCobranza {
  documento_id: string;
  cliente_id: number;
  tienda: string;
  tipo_documento: string;
  numero_documento: string | null;
  fecha_emision: string;
  fecha_vencimiento: string;
  monto_original: number;
  monto_pagado: number;
  estado: string;
}

const ESTADO_COLORS: Record<string, { bg: string; text: string; border: string; chart: string; icon: JSX.Element }> = {
  'PAID': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', chart: '#10b981', icon: <CheckCircle className="w-4 h-4" /> },
  'PENDING': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', chart: '#f59e0b', icon: <Clock className="w-4 h-4" /> },
  'PARTIAL': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', chart: '#3b82f6', icon: <Receipt className="w-4 h-4" /> },
  'OVERDUE': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', chart: '#ef4444', icon: <AlertCircle className="w-4 h-4" /> }
};

const ESTADO_LABELS: Record<string, string> = {
  'PAID': 'PAID',
  'PENDING': 'PENDING',
  'PARTIAL': 'PARTIAL',
  'OVERDUE': 'OVERDUE'
};

export default function CobranzaPage() {
  const [resumen, setResumen] = useState<ResumenCobranza[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoCobranza[]>([]);
  const [loading, setLoading] = useState(true);
  const [estadoFiltro, setEstadoFiltro] = useState<'ALL' | string>('ALL');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      if (DEMO_MODE) {
        const mock = getDemoCobranza();
        setResumen(mock.resumen as any);
        setDocumentos(mock.documentos as any);
        setLoading(false);
        return;
      }

      const { data: resumenData } = await supabase
        .from('v_cobranza_resumen')
        .select('*');

      setResumen((resumenData || []) as ResumenCobranza[]);

      const { data: docsData } = await supabase
        .from('fact_cobranza')
        .select('*')
        .order('fecha_emision', { ascending: false })
        .limit(100);

      setDocumentos((docsData || []) as DocumentoCobranza[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const resumenFilt = resumen;
  const docsFilt = documentos.filter(d => estadoFiltro === 'ALL' || d.estado === estadoFiltro);

  const totalDocs = resumenFilt.reduce((s, r) => s + r.num_documentos, 0);
  const totalMonto = resumenFilt.reduce((s, r) => s + r.monto_total, 0);
  const totalPagado = resumenFilt.reduce((s, r) => s + r.monto_pagado, 0);
  const totalPendiente = resumenFilt.reduce((s, r) => s + r.monto_pendiente, 0);

  const estadoDistribucion = resumenFilt.reduce((acc, r) => {
    const existing = acc.find(x => x.estado === r.estado);
    if (existing) {
      existing.documentos += r.num_documentos;
      existing.monto += r.monto_total;
    } else {
      acc.push({ 
        estado: r.estado, 
        documentos: r.num_documentos, 
        monto: r.monto_total,
        color: ESTADO_COLORS[r.estado]?.chart || '#6b7280'
      });
    }
    return acc;
  }, [] as { estado: string; documentos: number; monto: number; color: string }[]);

  const porcentajeRecuperacion = totalMonto > 0 ? (totalPagado / totalMonto) * 100 : 0;

  if (loading) {
    return (
      <div className="p-6 min-h-screen flex items-center justify-center">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-teal-200 rounded-full animate-spin border-t-teal-600" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Banknote className="w-8 h-8 text-teal-600" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 min-h-screen">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="animate-slide-in stagger-1" style={{ animationFillMode: 'backwards' }}>
          <KPICard3D
            title="Documents"
            value={totalDocs.toLocaleString()}
            subtitle="in portfolio"
            icon={<FileText className="w-6 h-6" />}
            color="blue"
          />
        </div>
        <div className="animate-slide-in stagger-2" style={{ animationFillMode: 'backwards' }}>
          <KPICard3D
            title="Total Amount"
            value={formatCompact(totalMonto)}
            subtitle="invoiced"
            icon={<Receipt className="w-6 h-6" />}
            color="purple"
          />
        </div>
        <div className="animate-slide-in stagger-3" style={{ animationFillMode: 'backwards' }}>
          <KPICard3D
            title="Collected"
            value={formatCompact(totalPagado)}
            subtitle={`${porcentajeRecuperacion.toFixed(1)}% recovered`}
            icon={<CheckCircle className="w-6 h-6" />}
            color="green"
          />
        </div>
        <div className="animate-slide-in stagger-4" style={{ animationFillMode: 'backwards' }}>
          <KPICard3D
            title="Outstanding"
            value={formatCompact(totalPendiente)}
            subtitle="to collect"
            icon={<Clock className="w-6 h-6" />}
            color="amber"
            delta={totalPendiente > 0 ? undefined : undefined}
          />
        </div>
      </div>

      {/* Recovery Gauge + Status Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card3D color="green" hover={false}>
          <div className="flex flex-col items-center">
            <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-4">Recovery Rate</h3>
            <Gauge3D 
              value={totalPagado} 
              max={totalMonto} 
              label={`${porcentajeRecuperacion.toFixed(1)}%`}
            />
            <div className="mt-4 grid grid-cols-2 gap-4 w-full">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl border border-emerald-200 dark:border-emerald-800 text-center">
                <p className="text-lg font-black text-emerald-600">{formatCompact(totalPagado)}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Collected</p>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-xl border border-amber-200 dark:border-amber-800 text-center">
                <p className="text-lg font-black text-amber-600">{formatCompact(totalPendiente)}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Outstanding</p>
              </div>
            </div>
          </div>
        </Card3D>
        
        <div className="lg:col-span-2 card-3d p-6 animate-slide-in stagger-3" style={{ animationFillMode: 'backwards' }}>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Distribution by Status</h2>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {estadoDistribucion.map(e => (
              <button
                key={e.estado}
                onClick={() => setEstadoFiltro(estadoFiltro === e.estado ? 'ALL' : e.estado)}
                className={`
                  p-4 rounded-xl border-2 transition-all duration-300
                  ${estadoFiltro === e.estado 
                    ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-slate-500 shadow-lg' 
                    : ''
                  }
                  ${ESTADO_COLORS[e.estado]?.bg}
                  ${ESTADO_COLORS[e.estado]?.border}
                `}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`${ESTADO_COLORS[e.estado]?.text}`}>
                    {ESTADO_COLORS[e.estado]?.icon}
                  </span>
                  <span className={`text-2xl font-black ${ESTADO_COLORS[e.estado]?.text}`}>
                    {e.documentos}
                  </span>
                </div>
                <p className={`text-sm font-semibold ${ESTADO_COLORS[e.estado]?.text}`}>{ESTADO_LABELS[e.estado] || e.estado}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{formatCompact(e.monto)}</p>
              </button>
            ))}
          </div>
          
          <div className="chart-container p-4 bg-white/50 dark:bg-slate-800/50 rounded-xl">
            <BarChart
              className="h-48"
              data={estadoDistribucion}
              index="estado"
              categories={['monto']}
              colors={['cyan']}
              valueFormatter={formatCompact}
              showAnimation={true}
              showGridLines={false}
            />
          </div>
          <div className="mt-3 p-3 bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800 rounded-xl">
            <p className="text-[11px] text-teal-700 dark:text-teal-300">
              <span className="font-bold">📌 Insight:</span> {porcentajeRecuperacion >= 80
                ? `Strong recovery at ${porcentajeRecuperacion.toFixed(1)}%. Focus on converting remaining PENDING documents to maintain cash flow momentum.`
                : `Recovery rate at ${porcentajeRecuperacion.toFixed(1)}% — below the 80% healthy threshold. Prioritize OVERDUE documents and escalate aged receivables.`}
            </p>
          </div>
          <div className="flex gap-2 mt-2">
            <a href="/finanzas" className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800">Finance overview →</a>
            <a href="/flujo-caja" className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800">Cash flow →</a>
          </div>
        </div>
      </div>

      {/* Document List */}
      <div className="card-3d p-6 animate-slide-in stagger-4" style={{ animationFillMode: 'backwards' }}>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Collection Documents</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {estadoFiltro !== 'ALL' ? `Filtered by: ${ESTADO_LABELS[estadoFiltro] || estadoFiltro}` : 'All statuses'}
            </p>
          </div>
          {estadoFiltro !== 'ALL' && (
            <button
              onClick={() => setEstadoFiltro('ALL')}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-slate-600 dark:text-slate-400 font-medium transition-colors"
            >
              Clear filter
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-slate-200 dark:border-slate-700">
                <th className="text-left py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Document</th>
                <th className="text-left py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Store</th>
                <th className="text-left py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Type</th>
                <th className="text-left py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Issued</th>
                <th className="text-left py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Due Date</th>
                <th className="text-right py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Amount</th>
                <th className="text-right py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Paid</th>
                <th className="text-center py-4 px-4 text-sm font-bold text-slate-600 dark:text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {docsFilt.slice(0, 20).map((doc) => {
                const pctPagado = doc.monto_original > 0 ? (doc.monto_pagado / doc.monto_original) * 100 : 0;
                
                return (
                  <tr key={doc.documento_id} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-4 px-4">
                      <span className="font-mono text-sm text-slate-600 dark:text-slate-400">{doc.numero_documento || doc.documento_id}</span>
                    </td>
                    <td className="py-4 px-4 text-sm text-slate-600 dark:text-slate-400">{doc.tienda}</td>
                    <td className="py-4 px-4 text-slate-600 dark:text-slate-400">{doc.tipo_documento}</td>
                    <td className="py-4 px-4 text-slate-600 dark:text-slate-400 text-sm">
                      {doc.fecha_emision ? new Date(doc.fecha_emision).toLocaleDateString('en-US') : '-'}
                    </td>
                    <td className="py-4 px-4 text-sm">
                      <span className={`
                        ${doc.estado === 'OVERDUE' ? 'text-red-600 font-bold' : 'text-slate-600 dark:text-slate-400'}
                      `}>
                        {doc.fecha_vencimiento ? new Date(doc.fecha_vencimiento).toLocaleDateString('en-US') : '-'}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right font-bold text-slate-900 dark:text-white">{formatCompact(doc.monto_original)}</td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-bold text-emerald-600">{formatCompact(doc.monto_pagado)}</span>
                        <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full mt-1 overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full"
                            style={{ width: `${pctPagado}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`
                        inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold
                        ${ESTADO_COLORS[doc.estado]?.bg} ${ESTADO_COLORS[doc.estado]?.text}
                      `}>
                        {ESTADO_COLORS[doc.estado]?.icon}
                        {ESTADO_LABELS[doc.estado] || doc.estado}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl">
          <p className="text-[11px] text-amber-700 dark:text-amber-300">
            <span className="font-bold">📌 Insight:</span> {docsFilt.filter(d => d.estado === 'OVERDUE').length > 0
              ? `${docsFilt.filter(d => d.estado === 'OVERDUE').length} overdue documents detected. Review aging receivables to minimize bad debt exposure.`
              : 'All documents are within their due dates. Maintain proactive follow-up to sustain healthy collection cycles.'}
          </p>
        </div>
        <div className="flex gap-2 mt-2">
          <a href="/finanzas" className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800">Finance overview →</a>
          <a href="/flujo-caja" className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800">Cash flow →</a>
        </div>
      </div>
      <p className="text-[10px] text-slate-400 dark:text-slate-500 text-right mt-2">Source: Bsale payments API • Synced daily</p>
    </div>
  );
}
