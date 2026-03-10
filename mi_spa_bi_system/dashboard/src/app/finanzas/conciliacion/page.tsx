'use client';

import { useEffect, useState, useCallback } from 'react';
import { 
  ArrowRightLeft, Search, CheckCircle, AlertTriangle, FileText,
  CreditCard, ChevronRight, X, Check, Zap, Info, RefreshCw
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DEMO_MODE } from '@/lib/demo-mode';
import { getDemoConciliacion } from '@/lib/demo-data';
import { formatCompact } from '@/components/ui';
import { Card3D, KPICard3D } from '@/components/charts3d';

// ============================================================================
// INTERFACES
// ============================================================================

interface Cliente {
  cliente_id: string;
  rut: string;
  razon_social: string;
}

interface Factura {
  factura_id: string;
  bsale_folio: string;
  numero_documento: string;
  issue_date: string;
  due_date: string;
  total_amount: number;
  outstanding_balance: number;
  financial_status: string;
  dias_mora: number;
}

interface Pago {
  pago_id: string;
  payment_date: string;
  payment_method: string;
  reference_code: string;
  amount_received: number;
  unallocated_balance: number;
}

interface Conciliacion {
  factura_id: string;
  amount: number;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ConciliacionPage() {
  // State
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [facturasPendientes, setFacturasPendientes] = useState<Factura[]>([]);
  const [pagosDisponibles, setPagosDisponibles] = useState<Pago[]>([]);
  const [pagoSeleccionado, setPagoSeleccionado] = useState<Pago | null>(null);
  
  // Active reconciliation
  const [conciliaciones, setConciliaciones] = useState<Conciliacion[]>([]);
  const [montoRestante, setMontoRestante] = useState(0);
  
  // UI
  const [searchCliente, setSearchCliente] = useState('');
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    loadClientes();
  }, []);

  const loadClientes = async () => {
    if (DEMO_MODE) {
      const mock = getDemoConciliacion();
      setClientes(mock.clientes as any);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('fin_clientes')
      .select('cliente_id, rut, razon_social')
      .order('razon_social');
    setClientes(data || []);
    setLoading(false);
  };

  const loadDataCliente = useCallback(async (clienteId: string) => {
    setLoading(true);
    
    if (DEMO_MODE) {
      const mock = getDemoConciliacion();
      const facturasCliente = mock.facturas.filter(f => f.cliente_id === clienteId);
      const pagosCliente = mock.pagos.filter(p => p.cliente_id === clienteId);
      setFacturasPendientes(facturasCliente.map(f => ({
        ...f,
        dias_mora: f.due_date && new Date(f.due_date) < new Date()
          ? Math.floor((Date.now() - new Date(f.due_date).getTime()) / 86400000) : 0,
      })) as any);
      setPagosDisponibles(pagosCliente as any);
      setPagoSeleccionado(null);
      setConciliaciones([]);
      setLoading(false);
      return;
    }
    
    const { data: facturas } = await supabase
      .from('v_factura_conciliaciones')
      .select('*')
      .eq('cliente_id', clienteId)
      .gt('outstanding_balance', 0)
      .order('due_date');
    
    setFacturasPendientes((facturas || []).map(f => ({
      ...f,
      dias_mora: f.due_date && new Date(f.due_date) < new Date() 
        ? Math.floor((Date.now() - new Date(f.due_date).getTime()) / (1000 * 60 * 60 * 24))
        : 0
    })));
    
    const { data: pagos } = await supabase
      .from('fin_pagos')
      .select('*')
      .eq('cliente_id', clienteId)
      .gt('unallocated_balance', 0)
      .order('payment_date', { ascending: false });
    
    setPagosDisponibles(pagos || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (clienteSeleccionado) {
      loadDataCliente(clienteSeleccionado.cliente_id);
      setConciliaciones([]);
      setPagoSeleccionado(null);
    }
  }, [clienteSeleccionado, loadDataCliente]);

  useEffect(() => {
    if (pagoSeleccionado) {
      setMontoRestante(pagoSeleccionado.unallocated_balance);
      setConciliaciones([]);
    }
  }, [pagoSeleccionado]);

  // ============================================================================
  // RECONCILIATION LOGIC
  // ============================================================================

  const toggleFactura = (factura: Factura) => {
    const existing = conciliaciones.find(c => c.factura_id === factura.factura_id);
    
    if (existing) {
      setConciliaciones(prev => prev.filter(c => c.factura_id !== factura.factura_id));
      setMontoRestante(prev => prev + existing.amount);
    } else {
      const maxAmount = Math.min(montoRestante, factura.outstanding_balance);
      if (maxAmount > 0) {
        setConciliaciones(prev => [...prev, { factura_id: factura.factura_id, amount: maxAmount }]);
        setMontoRestante(prev => prev - maxAmount);
      }
    }
  };

  const updateMontoFactura = (facturaId: string, newAmount: number) => {
    const factura = facturasPendientes.find(f => f.factura_id === facturaId);
    if (!factura) return;
    
    const existing = conciliaciones.find(c => c.factura_id === facturaId);
    if (!existing) return;
    
    const maxAllowed = Math.min(
      factura.outstanding_balance,
      montoRestante + existing.amount
    );
    const validAmount = Math.max(0, Math.min(newAmount, maxAllowed));
    
    setMontoRestante(prev => prev + existing.amount - validAmount);
    setConciliaciones(prev => 
      prev.map(c => c.factura_id === facturaId ? { ...c, amount: validAmount } : c)
    );
  };

  const aplicarFIFO = () => {
    if (!pagoSeleccionado) return;
    
    let restante = pagoSeleccionado.unallocated_balance;
    const nuevasConciliaciones: Conciliacion[] = [];
    
    for (const factura of facturasPendientes) {
      if (restante <= 0) break;
      
      const monto = Math.min(restante, factura.outstanding_balance);
      nuevasConciliaciones.push({ factura_id: factura.factura_id, amount: monto });
      restante -= monto;
    }
    
    setConciliaciones(nuevasConciliaciones);
    setMontoRestante(restante);
  };

  // ============================================================================
  // EXECUTE RECONCILIATION
  // ============================================================================

  const ejecutarConciliacion = async () => {
    if (!pagoSeleccionado || conciliaciones.length === 0) return;
    
    setProcesando(true);
    setMensaje(null);
    
    try {
      for (const conc of conciliaciones) {
        const { error } = await supabase
          .from('fin_conciliaciones')
          .insert({
            pago_id: pagoSeleccionado.pago_id,
            factura_id: conc.factura_id,
            amount_applied: conc.amount,
            notas: 'Manual reconciliation from dashboard'
          });
        
        if (error) throw error;
      }
      
      setMensaje({ tipo: 'success', texto: `✅ ${conciliaciones.length} invoices reconciled successfully` });
      
      if (clienteSeleccionado) {
        await loadDataCliente(clienteSeleccionado.cliente_id);
      }
      
      setConciliaciones([]);
      setPagoSeleccionado(null);
      
    } catch (error: any) {
      setMensaje({ tipo: 'error', texto: `❌ Error: ${error.message}` });
    } finally {
      setProcesando(false);
    }
  };

  // ============================================================================
  // FILTERS
  // ============================================================================

  const clientesFiltrados = clientes.filter(c => 
    c.razon_social.toLowerCase().includes(searchCliente.toLowerCase()) ||
    c.rut.includes(searchCliente)
  );

  const totalConciliacion = conciliaciones.reduce((s, c) => s + c.amount, 0);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 min-h-screen">
      {/* Message */}
      {mensaje && (
        <div className={`
          p-4 rounded-xl border-2 flex items-center gap-3 animate-slide-in
          ${mensaje.tipo === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
            : 'bg-red-50 border-red-200 text-red-700'}
        `}>
          {mensaje.tipo === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <span className="font-medium">{mensaje.texto}</span>
          <button onClick={() => setMensaje(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Panel - Customer Selection */}
        <div className="lg:col-span-3 space-y-4">
          <div className="card-glass p-4">
            <h3 className="font-bold text-gray-700 mb-3">1. Select Customer</h3>
            <div className="relative mb-3">
              <input
                type="text"
                placeholder="Search by tax ID or name..."
                value={searchCliente}
                onChange={(e) => setSearchCliente(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500"
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
            
            <div className="max-h-64 overflow-y-auto space-y-1">
              {clientesFiltrados.slice(0, 20).map(cliente => (
                <button
                  key={cliente.cliente_id}
                  onClick={() => setClienteSeleccionado(cliente)}
                  className={`
                    w-full p-3 rounded-xl text-left transition-all
                    ${clienteSeleccionado?.cliente_id === cliente.cliente_id
                      ? 'bg-indigo-100 border-2 border-indigo-300'
                      : 'bg-white hover:bg-gray-50 border border-gray-100'
                    }
                  `}
                >
                  <p className="font-medium text-gray-800 text-sm truncate">{cliente.razon_social}</p>
                  <p className="text-xs text-gray-500">{cliente.rut}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Available Payments */}
          {clienteSeleccionado && (
            <div className="card-glass p-4">
              <h3 className="font-bold text-gray-700 mb-3">2. Select Payment</h3>
              
              {pagosDisponibles.length === 0 ? (
                <div className="text-center py-6">
                  <CreditCard className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-500">No available payments</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pagosDisponibles.map(pago => (
                    <button
                      key={pago.pago_id}
                      onClick={() => setPagoSeleccionado(pago)}
                      className={`
                        w-full p-3 rounded-xl text-left transition-all
                        ${pagoSeleccionado?.pago_id === pago.pago_id
                          ? 'bg-emerald-100 border-2 border-emerald-300'
                          : 'bg-white hover:bg-gray-50 border border-gray-100'
                        }
                      `}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-emerald-600">{formatCompact(pago.unallocated_balance)}</p>
                          <p className="text-xs text-gray-500">{new Date(pago.payment_date).toLocaleDateString('en-US')}</p>
                        </div>
                        <span className="text-xs px-2 py-1 bg-gray-100 rounded-full">
                          {pago.payment_method}
                        </span>
                      </div>
                      {pago.reference_code && (
                        <p className="text-xs text-gray-400 mt-1 truncate">Ref: {pago.reference_code}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Center Panel - Invoices */}
        <div className="lg:col-span-6">
          <div className="card-3d p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-700">3. Outstanding Invoices</h3>
              {pagoSeleccionado && (
                <button
                  onClick={aplicarFIFO}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-semibold hover:bg-indigo-200 transition-colors"
                >
                  <Zap className="w-4 h-4" />
                  Auto FIFO
                </button>
              )}
            </div>

            {!clienteSeleccionado ? (
              <div className="text-center py-12">
                <Search className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">Select a customer to view their invoices</p>
              </div>
            ) : facturasPendientes.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-12 h-12 mx-auto text-emerald-300 mb-4" />
                <p className="text-gray-500">This customer has no outstanding invoices</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {facturasPendientes.map(factura => {
                  const conciliacion = conciliaciones.find(c => c.factura_id === factura.factura_id);
                  const isSelected = !!conciliacion;
                  
                  return (
                    <div
                      key={factura.factura_id}
                      className={`
                        p-4 rounded-xl border-2 transition-all cursor-pointer
                        ${isSelected 
                          ? 'bg-emerald-50 border-emerald-300' 
                          : 'bg-white border-gray-100 hover:border-gray-200'
                        }
                        ${!pagoSeleccionado ? 'opacity-50 pointer-events-none' : ''}
                      `}
                      onClick={() => pagoSeleccionado && toggleFactura(factura)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className={`
                            w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all
                            ${isSelected 
                              ? 'bg-emerald-500 border-emerald-500' 
                              : 'bg-white border-gray-300'
                            }
                          `}>
                            {isSelected && <Check className="w-4 h-4 text-white" />}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">
                              {factura.bsale_folio || factura.numero_documento || factura.factura_id.slice(0, 8)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(factura.issue_date).toLocaleDateString('en-US')} → 
                              <span className={factura.dias_mora > 0 ? ' text-red-600 font-semibold' : ''}>
                                {' '}{new Date(factura.due_date).toLocaleDateString('en-US')}
                                {factura.dias_mora > 0 && ` (${factura.dias_mora}d overdue)`}
                              </span>
                            </p>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <p className="font-bold text-gray-800">{formatCompact(factura.outstanding_balance)}</p>
                          <p className="text-xs text-gray-500">of {formatCompact(factura.total_amount)}</p>
                        </div>
                      </div>
                      
                      {isSelected && conciliacion && (
                        <div className="mt-3 pt-3 border-t border-emerald-200 flex items-center gap-3" onClick={e => e.stopPropagation()}>
                          <span className="text-sm text-gray-600">Apply:</span>
                          <input
                            type="number"
                            value={conciliacion.amount}
                            onChange={(e) => updateMontoFactura(factura.factura_id, parseFloat(e.target.value) || 0)}
                            className="w-32 px-3 py-1.5 border border-emerald-300 rounded-lg text-sm font-medium text-right focus:outline-none focus:border-emerald-500"
                            max={factura.outstanding_balance}
                            min={0}
                          />
                          <span className="text-xs text-gray-500">max: {formatCompact(factura.outstanding_balance)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Summary */}
        <div className="lg:col-span-3">
          <div className="card-glass p-4 sticky top-6">
            <h3 className="font-bold text-gray-700 mb-4">Summary</h3>
            <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-xl">
              <p className="text-sm text-purple-700">
                <span className="font-bold">📌 Insight:</span> {pagosDisponibles.length > 0
                  ? `${pagosDisponibles.length} unallocated payments available. Use Auto FIFO to quickly match payments to oldest invoices first.`
                  : clienteSeleccionado ? 'No unallocated payments for this customer. Register a new payment first.' : 'Select a customer to begin reconciling payments with invoices.'}
              </p>
            </div>
            
            {pagoSeleccionado ? (
              <>
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total payment:</span>
                    <span className="font-bold text-gray-800">{formatCompact(pagoSeleccionado.unallocated_balance)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">To reconcile:</span>
                    <span className="font-bold text-emerald-600">{formatCompact(totalConciliacion)}</span>
                  </div>
                  <div className="h-px bg-gray-200" />
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Remaining:</span>
                    <span className={`font-bold ${montoRestante > 0 ? 'text-amber-600' : 'text-gray-600'}`}>
                      {formatCompact(montoRestante)}
                    </span>
                  </div>
                </div>
                
                {/* Progress bar */}
                <div className="mb-6">
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-300"
                      style={{ width: `${(totalConciliacion / pagoSeleccionado.unallocated_balance) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1 text-center">
                    {((totalConciliacion / pagoSeleccionado.unallocated_balance) * 100).toFixed(1)}% allocated
                  </p>
                </div>
                
                {/* Selected invoices */}
                {conciliaciones.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-2">{conciliaciones.length} invoices selected</p>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {conciliaciones.map(c => {
                        const factura = facturasPendientes.find(f => f.factura_id === c.factura_id);
                        return (
                          <div key={c.factura_id} className="flex justify-between text-xs p-2 bg-emerald-50 rounded-lg">
                            <span className="text-gray-600 truncate">{factura?.bsale_folio || c.factura_id.slice(0, 8)}</span>
                            <span className="font-bold text-emerald-600">{formatCompact(c.amount)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                <button
                  onClick={ejecutarConciliacion}
                  disabled={conciliaciones.length === 0 || procesando}
                  className={`
                    w-full py-3 rounded-xl font-bold text-white transition-all
                    flex items-center justify-center gap-2
                    ${conciliaciones.length === 0 || procesando
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:shadow-lg hover:scale-[1.02]'
                    }
                  `}
                >
                  {procesando ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Execute Reconciliation
                    </>
                  )}
                </button>
              </>
            ) : (
              <div className="text-center py-8">
                <Info className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                <p className="text-sm text-gray-500">
                  Select a customer and a payment to begin
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="text-[10px] text-gray-400 text-right mt-2">Source: Bsale financial API • Synced daily</p>
    </div>
  );
}
