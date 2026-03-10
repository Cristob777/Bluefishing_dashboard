'use client';

import { useEffect, useState } from 'react';
import { 
  CreditCard, Search, Plus, Check, X, ChevronDown,
  Banknote, Calendar, Hash, Building2, AlertCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DEMO_MODE } from '@/lib/demo-mode';
import { getDemoPagos, getDemoConciliacion } from '@/lib/demo-data';
import { formatCompact } from '@/components/ui';
import { KPICard3D } from '@/components/charts3d';

// ============================================================================
// INTERFACES
// ============================================================================

interface Pago {
  pago_id: string;
  cliente_rut: string;
  cliente_nombre: string;
  pagador_rut: string | null;
  pagador_nombre: string | null;
  payment_date: string;
  payment_method: string;
  reference_code: string | null;
  banco: string | null;
  amount_received: number;
  unallocated_balance: number;
  monto_asignado: number;
  pct_asignado: number;
  num_facturas_pagadas: number;
}

interface Cliente {
  cliente_id: string;
  rut: string;
  razon_social: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PagosPage() {
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroSinAsignar, setFiltroSinAsignar] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // New payment form
  const [formData, setFormData] = useState({
    cliente_id: '',
    amount_received: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'TRANSFERENCIA',
    reference_code: '',
    banco: '',
    notas: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    if (DEMO_MODE) {
      setPagos(getDemoPagos() as any);
      const mockConc = getDemoConciliacion();
      setClientes(mockConc.clientes as any);
      setLoading(false);
      return;
    }
    
    const [pagosRes, clientesRes] = await Promise.all([
      supabase.from('v_pago_asignaciones').select('*').order('payment_date', { ascending: false }),
      supabase.from('fin_clientes').select('cliente_id, rut, razon_social').order('razon_social'),
    ]);
    
    setPagos(pagosRes.data || []);
    setClientes(clientesRes.data || []);
    setLoading(false);
  };

  const registrarPago = async () => {
    if (!formData.cliente_id || !formData.amount_received) return;
    
    const monto = parseFloat(formData.amount_received);
    
    const { error } = await supabase.from('fin_pagos').insert({
      cliente_id: formData.cliente_id,
      amount_received: monto,
      unallocated_balance: monto,
      payment_date: formData.payment_date,
      payment_method: formData.payment_method,
      reference_code: formData.reference_code || null,
      banco: formData.banco || null,
      notas: formData.notas || null,
    });
    
    if (!error) {
      setShowModal(false);
      setFormData({
        cliente_id: '',
        amount_received: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'TRANSFERENCIA',
        reference_code: '',
        banco: '',
        notas: '',
      });
      loadData();
    }
  };

  // Filters
  const pagosFiltrados = pagos.filter(p => {
    const matchSearch = 
      p.cliente_nombre?.toLowerCase().includes(search.toLowerCase()) ||
      p.cliente_rut?.includes(search) ||
      p.reference_code?.includes(search);
    const matchSinAsignar = !filtroSinAsignar || p.unallocated_balance > 0;
    return matchSearch && matchSinAsignar;
  });

  // Stats
  const totalPagos = pagos.length;
  const totalRecibido = pagos.reduce((s, p) => s + p.amount_received, 0);
  const totalSinAsignar = pagos.reduce((s, p) => s + p.unallocated_balance, 0);
  const pagosSinAsignar = pagos.filter(p => p.unallocated_balance > 0).length;

  const METODOS = ['TRANSFERENCIA', 'CHEQUE', 'EFECTIVO', 'TARJETA_CREDITO', 'TARJETA_DEBITO', 'DEPOSITO', 'WEBPAY', 'OTRO'];

  if (loading) {
    return (
      <div className="p-6 min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-emerald-200 rounded-full animate-spin border-t-emerald-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 min-h-screen">
      <div className="flex justify-end">
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
        >
          <Plus className="w-5 h-5" />
          New Payment
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <KPICard3D title="Total Payments" value={totalPagos.toString()} subtitle="recorded" icon={<CreditCard className="w-6 h-6" />} color="blue" />
        <KPICard3D title="Total Received" value={formatCompact(totalRecibido)} subtitle="in payments" icon={<Banknote className="w-6 h-6" />} color="green" />
        <KPICard3D title="Unallocated" value={formatCompact(totalSinAsignar)} subtitle={`${pagosSinAsignar} payments`} icon={<AlertCircle className="w-6 h-6" />} color="amber" delta={pagosSinAsignar} />
        <KPICard3D title="Allocation Rate" value={`${totalRecibido > 0 ? (((totalRecibido - totalSinAsignar) / totalRecibido) * 100).toFixed(0) : 0}%`} subtitle="of total" icon={<Check className="w-6 h-6" />} color="purple" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search by customer or reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500"
          />
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        </div>
        
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filtroSinAsignar}
            onChange={(e) => setFiltroSinAsignar(e.target.checked)}
            className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span className="text-sm font-medium text-gray-700">Only with available balance</span>
        </label>
      </div>

      {/* Payments Table */}
      <div className="card-3d p-6">
        <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl mb-4">
          <p className="text-sm text-emerald-700">
            <span className="font-bold">📌 Insight:</span> {pagosSinAsignar > 0
              ? `${pagosSinAsignar} payments with ${formatCompact(totalSinAsignar)} unallocated. Go to Reconciliation to match these to outstanding invoices.`
              : 'All payments are fully allocated to invoices. Reconciliation is up to date.'}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-4 px-4 text-sm font-bold text-gray-600">Date</th>
                <th className="text-left py-4 px-4 text-sm font-bold text-gray-600">Customer</th>
                <th className="text-center py-4 px-4 text-sm font-bold text-gray-600">Method</th>
                <th className="text-left py-4 px-4 text-sm font-bold text-gray-600">Reference</th>
                <th className="text-right py-4 px-4 text-sm font-bold text-gray-600">Received</th>
                <th className="text-right py-4 px-4 text-sm font-bold text-gray-600">Available</th>
                <th className="text-center py-4 px-4 text-sm font-bold text-gray-600">Allocation</th>
                <th className="text-center py-4 px-4 text-sm font-bold text-gray-600">Invoices</th>
              </tr>
            </thead>
            <tbody>
              {pagosFiltrados.slice(0, 50).map(pago => (
                <tr 
                  key={pago.pago_id} 
                  className={`
                    border-b border-gray-100 transition-colors cursor-pointer
                    ${expandedRow === pago.pago_id ? 'bg-emerald-50' : 'hover:bg-gray-50'}
                  `}
                  onClick={() => setExpandedRow(expandedRow === pago.pago_id ? null : pago.pago_id)}
                >
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-800">
                        {new Date(pago.payment_date).toLocaleDateString('en-US')}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <p className="font-medium text-gray-800 truncate max-w-[200px]">{pago.cliente_nombre}</p>
                    <p className="text-xs text-gray-500">{pago.cliente_rut}</p>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-semibold text-gray-700">
                      {pago.payment_method}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      {pago.reference_code && <Hash className="w-3 h-3 text-gray-400" />}
                      <span className="text-sm text-gray-600 truncate max-w-[150px]">
                        {pago.reference_code || '-'}
                      </span>
                    </div>
                    {pago.banco && (
                      <div className="flex items-center gap-1 mt-1">
                        <Building2 className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-500">{pago.banco}</span>
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-4 text-right font-bold text-gray-800">
                    {formatCompact(pago.amount_received)}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className={pago.unallocated_balance > 0 ? 'font-bold text-amber-600' : 'text-emerald-600'}>
                      {formatCompact(pago.unallocated_balance)}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            pago.pct_asignado === 100 ? 'bg-emerald-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${pago.pct_asignado}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold w-10 text-right">{pago.pct_asignado.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">
                      {pago.num_facturas_pagadas}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px] text-gray-400 text-right mt-2">Source: Bsale financial API • Synced daily</p>

      {/* New Payment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Register New Payment</h3>
              <button onClick={() => setShowModal(false)}>
                <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
                <select
                  value={formData.cliente_id}
                  onChange={(e) => setFormData({ ...formData, cliente_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Select customer...</option>
                  {clientes.map(c => (
                    <option key={c.cliente_id} value={c.cliente_id}>
                      {c.razon_social} ({c.rut})
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($) *</label>
                  <input
                    type="number"
                    value={formData.amount_received}
                    onChange={(e) => setFormData({ ...formData, amount_received: e.target.value })}
                    placeholder="0"
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                  <input
                    type="date"
                    value={formData.payment_date}
                    onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                  <select
                    value={formData.payment_method}
                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  >
                    {METODOS.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bank</label>
                  <input
                    type="text"
                    value={formData.banco}
                    onChange={(e) => setFormData({ ...formData, banco: e.target.value })}
                    placeholder="E.g.: Bank of America"
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference / Transaction #</label>
                <input
                  type="text"
                  value={formData.reference_code}
                  onChange={(e) => setFormData({ ...formData, reference_code: e.target.value })}
                  placeholder="E.g.: TRF-2024-001"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notas}
                  onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2 border border-gray-200 rounded-xl text-gray-600 font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={registrarPago}
                disabled={!formData.cliente_id || !formData.amount_received}
                className={`
                  flex-1 py-2 rounded-xl font-semibold transition-all
                  ${formData.cliente_id && formData.amount_received
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                Register Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
