// ============================================================================
// MI SPA BI SYSTEM - WhatsApp Webhook para Agente BI
// Integración con WhatsApp Business API (Meta)
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuración WhatsApp
const WHATSAPP_TOKEN = Deno.env.get('WHATSAPP_TOKEN') || '';
const WHATSAPP_PHONE_ID = Deno.env.get('WHATSAPP_PHONE_ID') || '';
const VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN') || 'mi_spa_bi_verify';

interface WhatsAppMessage {
  from: string;
  text: { body: string };
  timestamp: string;
}

// Función para enviar mensaje de WhatsApp
async function sendWhatsAppMessage(to: string, message: string): Promise<void> {
  const url = `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`;
  
  await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to,
      type: 'text',
      text: { body: message }
    })
  });
}

// Procesar consulta y generar respuesta
async function processQuery(query: string, supabase: any): Promise<string> {
  const queryLower = query.toLowerCase();

  try {
    // Consultas de ventas
    if (queryLower.includes('venta') || queryLower.includes('vendido')) {
      const tienda = queryLower.includes('epicbike') ? 'EPICBIKE' : 
                    queryLower.includes('bluefishing') || queryLower.includes('pesca') ? 'BLUEFISHING' : null;
      
      let q = supabase.from('fact_ventas').select('tienda, total')
        .gte('fecha', new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0]);
      if (tienda) q = q.eq('tienda', tienda);
      
      const { data } = await q;
      const total = data?.reduce((s: number, v: any) => s + (v.total || 0), 0) || 0;
      const formatMoney = (n: number) => `$${(n/1000000).toFixed(1)}M`;

      if (tienda) {
        return `📊 *Ventas ${tienda} (30 días)*\nTotal: ${formatMoney(total)}`;
      }
      
      const epic = data?.filter((v: any) => v.tienda === 'EPICBIKE').reduce((s: number, v: any) => s + v.total, 0) || 0;
      const blue = data?.filter((v: any) => v.tienda === 'BLUEFISHING').reduce((s: number, v: any) => s + v.total, 0) || 0;
      
      return `📊 *Ventas últimos 30 días*\n\n🚴 EPICBIKE: ${formatMoney(epic)}\n🎣 BLUEFISHING: ${formatMoney(blue)}\n\n*Total: ${formatMoney(total)}*`;
    }

    // Consultas de stock
    if (queryLower.includes('stock') || queryLower.includes('inventario')) {
      const { data } = await supabase
        .from('fact_stock')
        .select('cantidad, dim_productos!inner(nombre, tienda, precio_venta)')
        .eq('fecha', new Date().toISOString().split('T')[0])
        .gt('cantidad', 0);

      const totalUnidades = data?.reduce((s: number, r: any) => s + r.cantidad, 0) || 0;
      const valorTotal = data?.reduce((s: number, r: any) => s + (r.cantidad * (r.dim_productos?.precio_venta || 0)), 0) || 0;
      
      return `📦 *Estado del Inventario*\n\nUnidades: ${totalUnidades.toLocaleString('es-CL')}\nValor: $${(valorTotal/1000000).toFixed(1)}M`;
    }

    // Consultas de cobranza
    if (queryLower.includes('cobr') || queryLower.includes('pend') || queryLower.includes('deuda') || queryLower.includes('pago')) {
      const { data } = await supabase
        .from('fact_cobranza')
        .select('monto_original, monto_pagado, estado')
        .in('estado', ['PENDIENTE', 'PARCIAL', 'VENCIDO']);

      const totalPendiente = data?.reduce((s: number, c: any) => s + (c.monto_original - c.monto_pagado), 0) || 0;
      const vencido = data?.filter((c: any) => c.estado === 'VENCIDO')
        .reduce((s: number, c: any) => s + (c.monto_original - c.monto_pagado), 0) || 0;

      return `💰 *Cobranza Pendiente*\n\nTotal por cobrar: $${(totalPendiente/1000000).toFixed(1)}M\nVencido: $${(vencido/1000000).toFixed(1)}M\n\n${vencido > 0 ? '⚠️ Hay montos vencidos que requieren gestión' : '✅ Sin montos críticos'}`;
    }

    // Consultas de predicción
    if (queryLower.includes('predic') || queryLower.includes('proyec') || queryLower.includes('próximo') || queryLower.includes('vamos a vender')) {
      const tienda = queryLower.includes('epicbike') ? 'EPICBIKE' : 'BLUEFISHING';
      
      const { data } = await supabase.rpc('generar_prediccion_ventas', { 
        p_tienda: tienda, 
        p_periodo_dias: 30 
      });

      const pred = data?.[0];
      if (pred) {
        const emoji = pred.tendencia === 'CRECIENTE' ? '📈' : pred.tendencia === 'DECRECIENTE' ? '📉' : '➡️';
        return `🔮 *Proyección ${tienda} (30 días)*\n\nVenta estimada: $${(pred.venta_proyectada/1000000).toFixed(1)}M\nTendencia: ${emoji} ${pred.tendencia}\nFactor estacional: ${pred.factor_estacional.toFixed(2)}x`;
      }
      return '❌ No hay datos suficientes para proyectar';
    }

    // Alertas
    if (queryLower.includes('alerta') || queryLower.includes('problema') || queryLower.includes('riesgo')) {
      const { data } = await supabase.rpc('detectar_quiebres_stock');
      const criticos = data?.filter((q: any) => q.urgencia === 'CRITICA').length || 0;
      
      if (data?.length > 0) {
        const topAlertas = data.slice(0, 3).map((a: any) => `• ${a.nombre.slice(0, 30)}: ${a.stock_actual} uds`).join('\n');
        return `🔔 *Alertas de Stock*\n\n⚠️ ${data.length} productos en riesgo\n🚨 ${criticos} críticos\n\n${topAlertas}`;
      }
      return '✅ No hay alertas críticas de stock';
    }

    // Ayuda
    return `🤖 *Agente BI - MI SPA*\n\nPuedes preguntarme:\n\n📊 "¿Cuánto hemos vendido?"\n📦 "¿Cómo está el inventario?"\n💰 "¿Cuánto tenemos por cobrar?"\n🔮 "¿Cuánto vamos a vender?"\n🔔 "¿Hay alertas de stock?"\n\n¿En qué puedo ayudarte?`;

  } catch (error) {
    console.error('Error procesando consulta:', error);
    return '❌ Error procesando tu consulta. Intenta de nuevo.';
  }
}

serve(async (req) => {
  // Verificación de webhook (GET)
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✅ Webhook verificado');
      return new Response(challenge, { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  // Procesar mensajes (POST)
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      
      // Verificar que sea un mensaje de WhatsApp
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const messages = value?.messages;

      if (messages && messages.length > 0) {
        const message: WhatsAppMessage = messages[0];
        const from = message.from;
        const text = message.text?.body;

        if (text) {
          console.log(`📩 Mensaje de ${from}: ${text}`);

          // Crear cliente Supabase
          const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          );

          // Procesar consulta
          const response = await processQuery(text, supabase);

          // Enviar respuesta
          await sendWhatsAppMessage(from, response);
          console.log(`📤 Respuesta enviada a ${from}`);
        }
      }

      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Error procesando webhook:', error);
      return new Response(JSON.stringify({ error: String(error) }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response('Method not allowed', { status: 405 });
});

