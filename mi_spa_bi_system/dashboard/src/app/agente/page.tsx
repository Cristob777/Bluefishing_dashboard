'use client';
import { useState, useRef, useEffect } from 'react';
import { Card, Title, Text, Badge } from '@tremor/react';
import { Send, Bot, User, Sparkles, TrendingUp, Package, Users, DollarSign, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DEMO_MODE } from '@/lib/demo-mode';
import { getDemoAgente } from '@/lib/demo-data';
import { formatCompact } from '@/components/ui';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  data?: any;
  timestamp: Date;
}

interface QueryResult {
  type: 'ventas' | 'stock' | 'cobranza' | 'prediccion' | 'general';
  data: any;
  summary: string;
}

export default function AgentePage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: 'assistant',
      content: 'Hello! I\'m the Bluefishing BI Agent. I can help you query information about sales, inventory, collections and forecasts. What would you like to know?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const processQuery = async (query: string): Promise<QueryResult> => {
    const queryLower = query.toLowerCase();

    if (DEMO_MODE) {
      return getDemoAgente(query);
    }

    try {
      if (queryLower.includes('venta') || queryLower.includes('vendido') || queryLower.includes('vender') || queryLower.includes('sales') || queryLower.includes('sold') || queryLower.includes('revenue')) {
        const { data } = await supabase.from('fact_ventas').select('tienda, total').gte('fecha', new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0]);
        const total = data?.reduce((s, v) => s + (v.total || 0), 0) || 0;

        return {
          type: 'ventas',
          data: { total },
          summary: `Total Bluefishing sales in the last 30 days are ${formatCompact(total)}.`
        };
      }

      if (queryLower.includes('stock') || queryLower.includes('inventario') || queryLower.includes('producto') || queryLower.includes('inventory') || queryLower.includes('product')) {
        const { data } = await supabase
          .from('fact_stock')
          .select('cantidad, dim_productos!inner(nombre, tienda, precio_venta)')
          .eq('fecha', new Date().toISOString().split('T')[0])
          .gt('cantidad', 0);

        const totalUnidades = data?.reduce((s, r) => s + r.cantidad, 0) || 0;
        const valorTotal = data?.reduce((s, r) => s + (r.cantidad * ((r as any).dim_productos?.precio_venta || 0)), 0) || 0;
        
        const topStock = data?.sort((a, b) => b.cantidad - a.cantidad).slice(0, 5).map(r => ({
          nombre: (r as any).dim_productos?.nombre,
          cantidad: r.cantidad
        }));

        return {
          type: 'stock',
          data: { totalUnidades, valorTotal, topStock },
          summary: `You have ${totalUnidades.toLocaleString('en-US')} units in stock valued at ${formatCompact(valorTotal)}. Top stock products are: ${topStock?.map(p => p.nombre?.slice(0, 30)).join(', ')}.`
        };
      }

      if (queryLower.includes('cobr') || queryLower.includes('pend') || queryLower.includes('deuda') || queryLower.includes('mora') || queryLower.includes('pago') || queryLower.includes('collect') || queryLower.includes('debt') || queryLower.includes('payment') || queryLower.includes('overdue')) {
        const { data } = await supabase
          .from('fact_cobranza')
          .select('monto_original, monto_pagado, estado, dim_clientes(razon_social)')
          .in('estado', ['PENDIENTE', 'PARCIAL', 'VENCIDO']);

        const totalPendiente = data?.reduce((s, c) => s + (c.monto_original - c.monto_pagado), 0) || 0;
        const vencido = data?.filter(c => c.estado === 'VENCIDO').reduce((s, c) => s + (c.monto_original - c.monto_pagado), 0) || 0;
        const numClientes = new Set(data?.map(c => (c as any).dim_clientes?.razon_social)).size;

        return {
          type: 'cobranza',
          data: { totalPendiente, vencido, numClientes },
          summary: `Total receivables are ${formatCompact(totalPendiente)}, of which ${formatCompact(vencido)} are overdue. There are ${numClientes} customers with outstanding balances.`
        };
      }

      if (queryLower.includes('predic') || queryLower.includes('proyec') || queryLower.includes('próximo') || queryLower.includes('futuro') || queryLower.includes('vamos a vender') || queryLower.includes('forecast') || queryLower.includes('next month')) {
        const tienda = 'BLUEFISHING';
        const periodo = queryLower.includes('90') ? 90 : queryLower.includes('60') ? 60 : 30;
        
        const { data } = await supabase.rpc('generar_prediccion_ventas', { 
          p_tienda: tienda, 
          p_periodo_dias: periodo 
        });

        const pred = data?.[0];
        return {
          type: 'prediccion',
          data: pred,
          summary: pred 
            ? `The sales forecast for ${tienda} over the next ${periodo} days is ${formatCompact(pred.venta_proyectada)}. The trend is ${pred.tendencia.toLowerCase()} with a seasonal factor of ${pred.factor_estacional.toFixed(2)}x.`
            : 'Not enough data available to generate a forecast.'
        };
      }

      if (queryLower.includes('client') || queryLower.includes('customer')) {
        const { data } = await supabase
          .from('dim_clientes')
          .select('cliente_id, razon_social, tienda_principal')
          .eq('es_activo', true);

        const total = data?.length || 0;

        return {
          type: 'general',
          data: { total },
          summary: `You have ${total} active customers in the system.`
        };
      }

      if (queryLower.includes('alerta') || queryLower.includes('problema') || queryLower.includes('riesgo') || queryLower.includes('alert') || queryLower.includes('risk') || queryLower.includes('issue')) {
        const { data: quiebres } = await supabase.rpc('detectar_quiebres_stock');
        const criticos = quiebres?.filter((q: any) => q.urgencia === 'CRITICA').length || 0;
        
        return {
          type: 'general',
          data: { criticos, total: quiebres?.length || 0 },
          summary: `There are ${quiebres?.length || 0} products at risk of stockout, of which ${criticos} are critical and require immediate action.`
        };
      }

      return {
        type: 'general',
        data: null,
        summary: 'I can help you with queries about:\n• **Sales**: "How much have we sold this month?"\n• **Stock**: "How is the inventory?"\n• **Collections**: "How much is pending collection?"\n• **Forecasts**: "How much will we sell next month?"\n• **Alerts**: "Are there products at risk of stockout?"\n\nWhat would you like to query?'
      };

    } catch (error) {
      console.error('Error processing query:', error);
      return {
        type: 'general',
        data: null,
        summary: 'There was an error processing your query. Please try again or rephrase your question.'
      };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: messages.length,
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const result = await processQuery(input);
      
      const assistantMessage: Message = {
        id: messages.length + 1,
        role: 'assistant',
        content: result.summary,
        data: result.data,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: messages.length + 1,
        role: 'assistant',
        content: 'Sorry, there was an error processing your query. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const suggestedQuestions = [
    'How much have we sold this month?',
    'How is BLUEFISHING stock?',
    'How much is pending collection?',
    'How much will we sell in the next 30 days?',
    'Are there products at risk of stockout?'
  ];

  return (
    <div className="p-6 h-[calc(100vh-2rem)] flex flex-col">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
          <Bot className="w-8 h-8 text-white" />
        </div>
        <div>
          <Title>Intelligent BI Agent</Title>
          <Text>Query your data in natural language</Text>
        </div>
        <Badge color="emerald" className="ml-auto">
          <Sparkles className="w-3 h-3 mr-1" /> AI Active
        </Badge>
      </div>

      {/* Chat container */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map(message => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`p-2 rounded-full ${message.role === 'user' ? 'bg-blue-100' : 'bg-purple-100'}`}>
                {message.role === 'user' ? (
                  <User className="w-5 h-5 text-blue-600" />
                ) : (
                  <Bot className="w-5 h-5 text-purple-600" />
                )}
              </div>
              <div className={`max-w-[80%] ${message.role === 'user' ? 'text-right' : ''}`}>
                <div className={`p-3 rounded-2xl ${
                  message.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-sm' 
                    : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                }`}>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
                
                {message.role === 'assistant' && message.data && (
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg border">
                    {message.data.total && (
                      <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                          <span className="text-sm">Bluefishing: {formatCompact(message.data.total || 0)}</span>
                        </div>
                      </div>
                    )}
                    {message.data.topStock && (
                      <div className="mt-2">
                        <Text className="text-xs font-medium">Top products in stock:</Text>
                        {message.data.topStock.map((p: any, i: number) => (
                          <div key={i} className="text-xs text-gray-600">
                            • {p.nombre?.slice(0, 40)}: {p.cantidad} units
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                <span className="text-xs text-gray-400 mt-1 block">
                  {message.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="flex gap-3">
              <div className="p-2 rounded-full bg-purple-100">
                <Bot className="w-5 h-5 text-purple-600" />
              </div>
              <div className="p-3 bg-gray-100 rounded-2xl rounded-tl-sm">
                <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested questions */}
        {messages.length <= 1 && (
          <div className="px-4 py-2 border-t">
            <Text className="text-xs text-gray-500 mb-2">Suggestions:</Text>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => setInput(q)}
                  className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me about sales, stock, collections or forecasts..."
              className="flex-1 px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
