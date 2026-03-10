'use client';

import { useEffect, useState } from 'react';
import { 
  FileText, Search, Filter, Download, ExternalLink,
  CheckCircle, Clock, AlertTriangle, XCircle, ChevronDown
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DEMO_MODE } from '@/lib/demo-mode';
import { getDemoFacturas } from '@/lib/demo-data';
import { formatCompact } from '@/components/ui';
import { KPICard3D } from '@/components/charts3d';

// ============================================================================
// INTERFACES
// ============================================================================

interface Factura {
  factura_id: string;
  cliente_rut: string;
  cliente_nombre: string;
  bsale_folio: string;
  numero_documento: string;
  issue_date: string;
  due_date: string;
  total_amount: number;
  outstanding_balance: number;
  financial_status: string;
  tienda: string;
  dias_desde_emision: number;
  dias_mora: number;
  total_pagado: number;
  num_pagos_aplicados: number;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function FacturasPage() {
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('ALL');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    loadFacturas();
  }, []);

  const loadFacturas = async () => {
    setLoading(true);
    if (DEMO_MODE) {
      setFacturas(getDemoFacturas() as any);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('v_factura_conciliaciones')
      .select('*')
      .order('due_date', { ascending: true });
    
    if (!error) {
      setFacturas(data || []);
    }
    setLoading(false);
  };

  // Filters
  const facturasFiltradas = facturas.filter(f => {
    const matchSearch = 
      f.cliente_nombre?.toLowerCase().includes(search.toLowerCase()) ||
      f.cliente_rut?.includes(search) ||
      f.bsale_folio?.includes(search) ||
      f.numero_documento?.includes(search);
    const matchEstado = filtroEstado === 'ALL' || f.financial_status === filtroEstado;
    return matchSearch && matchEstado;
  });

  // Stats
  const totalFacturas = facturas.length;
  const facturasPendientes = facturas.filter(f => f.outstanding_balance > 0);
  const totalPorCobrar = facturasPendientes.reduce((s, f) => s + f.outstanding_balance, 0);
  const facturasVencidas = facturas.filter(f => f.dias_mora > 0 && f.outstanding_balance > 0);
  const totalVencido = facturasVencidas.reduce((s, f) => s + f.outstanding_balance, 0);

  const STATUS_STYLES: Record<string, { bg: string; text: string; icon: JSX.Element }> = {
    PENDING: { bg: 'bg-amber-100', text: 'text-amber-700', icon: <Clock className="w-4 h-4" /> },
    PARTIAL: { bg: 'bg-blue-100', text: 'text-blue-700', icon: <AlertTriangle className="w-4 h-4" /> },
    PAID: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: <CheckCircle className="w-4 h-4" /> },
    OVERDUE: { bg: 'bg-red-100', text: 'text-red-700', icon: <XCircle className="w-4 h-4" /> },
    VOIDED: { bg: 'bg-gray-100', text: 'text-gray-700', icon: <XCircle className="w-4 h-4" /> },
  };

  if (loading) {
    return (
      <div className="p-6 min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-blue-200 rounded-full animate-spin border-t-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 min-h-screen">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <KPICard3D title="Total Invoices" value={totalFacturas.toString()} subtitle="in system" icon={<FileText className="w-6 h-6" />} color="blue" />
        <KPICard3D title="Pending" value={facturasPendientes.length.toString()} subtitle="to collect" icon={<Clock className="w-6 h-6" />} color="amber" />
        <KPICard3D title="Receivable" value={formatCompact(totalPorCobrar)} subtitle="total outstanding" icon={<FileText className="w-6 h-6" />} color="purple" />
        <KPICard3D title="Overdue" value={formatCompact(totalVencido)} subtitle={`${facturasVencidas.length} invoices`} icon={<AlertTriangle className="w-6 h-6" />} color="red" delta={facturasVencidas.length} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search by customer, tax ID, or folio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500"
          />
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        </div>
        
        <div className="flex gap-2">
          {['ALL', 'PENDING', 'PARTIAL', 'OVERDUE', 'PAID'].map(estado => (
            <button
              key={estado}
              onClick={() => setFiltroEstado(estado)}
              className={`
                px-4 py-2 rounded-lg text-sm font-semibold transition-all
                ${filtroEstado === estado 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }
              `}
            >
              {estado === 'ALL' ? 'All' : estado}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices Table */}
      <div className="card-3d p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-4 px-4 text-sm font-bold text-gray-600">Document</th>
                <th className="text-left py-4 px-4 text-sm font-bold text-gray-600">Customer</th>
                <th className="text-center py-4 px-4 text-sm font-bold text-gray-600">Status</th>
                <th className="text-center py-4 px-4 text-sm font-bold text-gray-600">Issue Date</th>
                <th className="text-center py-4 px-4 text-sm font-bold text-gray-600">Due Date</th>
                <th className="text-right py-4 px-4 text-sm font-bold text-gray-600">Total</th>
                <th className="text-right py-4 px-4 text-sm font-bold text-gray-600">Outstanding</th>
                <th className="text-center py-4 px-4 text-sm font-bold text-gray-600">Progress</th>
              </tr>
            </thead>
            <tbody>
              {facturasFiltradas.slice(0, 50).map(factura => {
                const status = STATUS_STYLES[factura.financial_status] || STATUS_STYLES.PENDING;
                const pctPagado = factura.total_amount > 0 
                  ? ((factura.total_amount - factura.outstanding_balance) / factura.total_amount) * 100 
                  : 0;
                
                return (
                  <tr 
                    key={factura.factura_id} 
                    className={`
                      border-b border-gray-100 transition-colors cursor-pointer
                      ${expandedRow === factura.factura_id ? 'bg-blue-50' : 'hover:bg-gray-50'}
                    `}
                    onClick={() => setExpandedRow(expandedRow === factura.factura_id ? null : factura.factura_id)}
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedRow === factura.factura_id ? 'rotate-180' : ''}`} />
                        <div>
                          <p className="font-medium text-gray-800">{factura.bsale_folio || factura.numero_documento}</p>
                          <p className="text-xs text-gray-500">{factura.tienda}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <p className="font-medium text-gray-800 truncate max-w-[200px]">{factura.cliente_nombre}</p>
                      <p className="text-xs text-gray-500">{factura.cliente_rut}</p>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold ${status.bg} ${status.text}`}>
                        {status.icon}
                        {factura.financial_status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center text-sm text-gray-600">
                      {new Date(factura.issue_date).toLocaleDateString('en-US')}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`text-sm ${factura.dias_mora > 0 ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
                        {new Date(factura.due_date).toLocaleDateString('en-US')}
                        {factura.dias_mora > 0 && (
                          <span className="block text-xs">({factura.dias_mora}d overdue)</span>
                        )}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right font-bold text-gray-800">
                      {formatCompact(factura.total_amount)}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className={factura.outstanding_balance > 0 ? 'font-bold text-amber-600' : 'text-emerald-600'}>
                        {formatCompact(factura.outstanding_balance)}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              pctPagado === 100 ? 'bg-emerald-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${pctPagado}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold w-10 text-right">{pctPagado.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {facturasFiltradas.length > 50 && (
          <p className="text-center text-sm text-gray-500 mt-4">
            Showing 50 of {facturasFiltradas.length} invoices
          </p>
        )}
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-sm text-blue-700">
            <span className="font-bold">📌 Insight:</span> {facturasVencidas.length > 0
              ? `${facturasVencidas.length} invoices are overdue totaling ${formatCompact(totalVencido)}. Prioritize collection on oldest outstanding balances to reduce DSO.`
              : 'All invoices are current — no overdue balances detected. Strong accounts receivable health.'}
          </p>
        </div>
      </div>
      <p className="text-[10px] text-gray-400 text-right mt-2">Source: Bsale financial API • Synced daily</p>
    </div>
  );
}
