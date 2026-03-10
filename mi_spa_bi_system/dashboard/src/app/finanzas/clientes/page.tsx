'use client';

import { useEffect, useState } from 'react';
import { 
  Users, Search, Plus, Edit2, Lock, Unlock, ChevronRight,
  CheckCircle, AlertTriangle, TrendingDown, Clock, Filter, X
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DEMO_MODE } from '@/lib/demo-mode';
import { getDemoClientesFinanzas } from '@/lib/demo-data';
import { formatCompact } from '@/components/ui';
import { KPICard3D, Card3D, ProgressBar3D } from '@/components/charts3d';

// ============================================================================
// INTERFACES
// ============================================================================

interface Cliente {
  cliente_id: string;
  rut: string;
  razon_social: string;
  nombre_fantasia: string | null;
  email: string | null;
  telefono: string | null;
  credit_limit: number;
  payment_terms_days: number;
  is_credit_blocked: boolean;
  total_debt: number;
  overdue_debt: number;
  available_credit: number;
  credit_status: 'OK' | 'DELINQUENT' | 'OVERDRAWN' | 'BLOCKED';
  facturas_pendientes: number;
  facturas_vencidas: number;
  dias_mora_promedio: number;
  credit_utilization_pct: number;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ClientesFinanzasPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('ALL');
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadClientes();
  }, []);

  const loadClientes = async () => {
    setLoading(true);
    if (DEMO_MODE) {
      setClientes(getDemoClientesFinanzas() as any);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('v_client_credit_health')
      .select('*')
      .order('razon_social');
    
    if (!error) {
      setClientes(data || []);
    }
    setLoading(false);
  };

  const toggleBloqueo = async (cliente: Cliente) => {
    const { error } = await supabase
      .from('fin_clientes')
      .update({ is_credit_blocked: !cliente.is_credit_blocked })
      .eq('cliente_id', cliente.cliente_id);
    
    if (!error) {
      loadClientes();
    }
  };

  const guardarCliente = async (formData: Partial<Cliente>) => {
    if (!clienteEditando) return;
    
    const { error } = await supabase
      .from('fin_clientes')
      .update({
        credit_limit: formData.credit_limit,
        payment_terms_days: formData.payment_terms_days,
      })
      .eq('cliente_id', clienteEditando.cliente_id);
    
    if (!error) {
      setShowModal(false);
      setClienteEditando(null);
      loadClientes();
    }
  };

  // Filters
  const clientesFiltrados = clientes.filter(c => {
    const matchSearch = c.razon_social.toLowerCase().includes(search.toLowerCase()) ||
                       c.rut.includes(search);
    const matchEstado = filtroEstado === 'ALL' || c.credit_status === filtroEstado;
    return matchSearch && matchEstado;
  });

  // Stats
  const totalClientes = clientes.length;
  const clientesOK = clientes.filter(c => c.credit_status === 'OK').length;
  const clientesMorosos = clientes.filter(c => c.credit_status === 'DELINQUENT').length;
  const clientesBloqueados = clientes.filter(c => c.is_credit_blocked).length;

  const STATUS_COLORS = {
    OK: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: <CheckCircle className="w-4 h-4" /> },
    DELINQUENT: { bg: 'bg-red-100', text: 'text-red-700', icon: <AlertTriangle className="w-4 h-4" /> },
    OVERDRAWN: { bg: 'bg-orange-100', text: 'text-orange-700', icon: <TrendingDown className="w-4 h-4" /> },
    BLOCKED: { bg: 'bg-gray-100', text: 'text-gray-700', icon: <Lock className="w-4 h-4" /> },
  };

  if (loading) {
    return (
      <div className="p-6 min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-indigo-200 rounded-full animate-spin border-t-indigo-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 min-h-screen">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <KPICard3D title="Total Customers" value={totalClientes.toString()} subtitle="in portfolio" icon={<Users className="w-6 h-6" />} color="blue" />
        <KPICard3D title="Current" value={clientesOK.toString()} subtitle="no overdue debt" icon={<CheckCircle className="w-6 h-6" />} color="green" />
        <KPICard3D title="Delinquent" value={clientesMorosos.toString()} subtitle="with overdue debt" icon={<AlertTriangle className="w-6 h-6" />} color="red" delta={clientesMorosos} />
        <KPICard3D title="Blocked" value={clientesBloqueados.toString()} subtitle="credit suspended" icon={<Lock className="w-6 h-6" />} color="purple" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search by tax ID or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500"
          />
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        </div>
        
        <div className="flex gap-2">
          {['ALL', 'OK', 'DELINQUENT', 'OVERDRAWN', 'BLOCKED'].map(estado => (
            <button
              key={estado}
              onClick={() => setFiltroEstado(estado)}
              className={`
                px-4 py-2 rounded-lg text-sm font-semibold transition-all
                ${filtroEstado === estado 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }
              `}
            >
              {estado === 'ALL' ? 'All' : estado}
            </button>
          ))}
        </div>
      </div>

      {/* Customers Table */}
      <div className="card-3d p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-4 px-4 text-sm font-bold text-gray-600">Customer</th>
                <th className="text-center py-4 px-4 text-sm font-bold text-gray-600">Status</th>
                <th className="text-right py-4 px-4 text-sm font-bold text-gray-600">Limit</th>
                <th className="text-right py-4 px-4 text-sm font-bold text-gray-600">Debt</th>
                <th className="text-right py-4 px-4 text-sm font-bold text-gray-600">Overdue</th>
                <th className="text-center py-4 px-4 text-sm font-bold text-gray-600">Utilization</th>
                <th className="text-center py-4 px-4 text-sm font-bold text-gray-600">Terms</th>
                <th className="text-center py-4 px-4 text-sm font-bold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clientesFiltrados.map(cliente => {
                const status = STATUS_COLORS[cliente.credit_status] || STATUS_COLORS.OK;
                
                return (
                  <tr key={cliente.cliente_id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-medium text-gray-800">{cliente.razon_social}</p>
                        <p className="text-xs text-gray-500">{cliente.rut}</p>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold ${status.bg} ${status.text}`}>
                        {status.icon}
                        {cliente.credit_status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right font-bold text-gray-800">
                      {formatCompact(cliente.credit_limit)}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className={cliente.total_debt > cliente.credit_limit ? 'text-red-600 font-bold' : ''}>
                        {formatCompact(cliente.total_debt)}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className={cliente.overdue_debt > 0 ? 'text-red-600 font-bold' : 'text-gray-600'}>
                        {formatCompact(cliente.overdue_debt)}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              cliente.credit_utilization_pct > 100 ? 'bg-red-500' :
                              cliente.credit_utilization_pct > 80 ? 'bg-orange-500' :
                              'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(cliente.credit_utilization_pct, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold w-12 text-right">
                          {cliente.credit_utilization_pct.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="px-2 py-1 bg-gray-100 rounded text-xs font-semibold">
                        {cliente.payment_terms_days}d
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => { setClienteEditando(cliente); setShowModal(true); }}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Edit credit"
                        >
                          <Edit2 className="w-4 h-4 text-gray-500" />
                        </button>
                        <button
                          onClick={() => toggleBloqueo(cliente)}
                          className={`p-2 rounded-lg transition-colors ${
                            cliente.is_credit_blocked 
                              ? 'bg-emerald-100 hover:bg-emerald-200' 
                              : 'bg-red-100 hover:bg-red-200'
                          }`}
                          title={cliente.is_credit_blocked ? 'Unblock' : 'Block'}
                        >
                          {cliente.is_credit_blocked 
                            ? <Unlock className="w-4 h-4 text-emerald-600" />
                            : <Lock className="w-4 h-4 text-red-600" />
                          }
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {showModal && clienteEditando && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Edit Credit</h3>
              <button onClick={() => setShowModal(false)}>
                <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              guardarCliente({
                credit_limit: parseFloat(formData.get('credit_limit') as string) || 0,
                payment_terms_days: parseInt(formData.get('payment_terms_days') as string) || 0,
              });
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                  <p className="text-gray-800 font-semibold">{clienteEditando.razon_social}</p>
                  <p className="text-xs text-gray-500">{clienteEditando.rut}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Credit Limit ($)</label>
                  <input
                    type="number"
                    name="credit_limit"
                    defaultValue={clienteEditando.credit_limit}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms (days)</label>
                  <input
                    type="number"
                    name="payment_terms_days"
                    defaultValue={clienteEditando.payment_terms_days}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 border border-gray-200 rounded-xl text-gray-600 font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
