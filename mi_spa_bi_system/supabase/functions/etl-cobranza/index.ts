// ============================================================================
// MI SPA BI SYSTEM - ETL Cobranza (Carga desde Excel/CSV)
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CobranzaRow {
  documento_id: string;
  tienda: 'EPICBIKE' | 'BLUEFISHING';
  tipo_documento: string;
  numero_documento: string;
  cliente_rut: string;
  cliente_nombre: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  monto_original: number;
  monto_pagado: number;
  estado?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { datos } = await req.json();
    
    if (!datos || !Array.isArray(datos)) {
      throw new Error('Se requiere un array de datos de cobranza');
    }

    let insertados = 0;
    let errores = 0;
    const errorDetails: string[] = [];

    for (const row of datos as CobranzaRow[]) {
      try {
        // Buscar o crear cliente
        let clienteId: number;
        const { data: clienteExistente } = await supabase
          .from('dim_clientes')
          .select('cliente_id')
          .eq('rut', row.cliente_rut)
          .single();

        if (clienteExistente) {
          clienteId = clienteExistente.cliente_id;
        } else {
          // Crear cliente nuevo
          const { data: nuevoCliente, error: errorCliente } = await supabase
            .from('dim_clientes')
            .insert({
              rut: row.cliente_rut,
              razon_social: row.cliente_nombre,
              tienda_principal: row.tienda,
              es_activo: true
            })
            .select('cliente_id')
            .single();

          if (errorCliente) throw errorCliente;
          clienteId = nuevoCliente.cliente_id;
        }

        // Calcular estado
        const hoy = new Date();
        const vencimiento = new Date(row.fecha_vencimiento);
        const pendiente = row.monto_original - row.monto_pagado;
        
        let estado = 'PENDIENTE';
        if (pendiente <= 0) {
          estado = 'PAGADO';
        } else if (row.monto_pagado > 0) {
          estado = 'PARCIAL';
        } else if (hoy > vencimiento) {
          estado = 'VENCIDO';
        }

        // Insertar/actualizar cobranza
        const { error } = await supabase
          .from('fact_cobranza')
          .upsert({
            documento_id: row.documento_id,
            cliente_id: clienteId,
            tienda: row.tienda,
            tipo_documento: row.tipo_documento,
            numero_documento: row.numero_documento,
            fecha_emision: row.fecha_emision,
            fecha_vencimiento: row.fecha_vencimiento,
            monto_original: row.monto_original,
            monto_pagado: row.monto_pagado,
            estado: estado,
            updated_at: new Date().toISOString()
          }, { onConflict: 'documento_id' });

        if (error) throw error;
        insertados++;
        
      } catch (e) {
        errores++;
        errorDetails.push(`Doc ${row.documento_id}: ${String(e)}`);
      }
    }

    // Refrescar vistas materializadas
    await supabase.rpc('refresh_all_materialized_views');

    // Generar alertas de mora
    await supabase.rpc('generar_alertas_sistema');

    return new Response(JSON.stringify({
      success: true,
      stats: {
        total: datos.length,
        insertados,
        errores,
        errorDetails: errorDetails.slice(0, 10) // Primeros 10 errores
      },
      duration_ms: Date.now() - startTime
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: String(error),
      duration_ms: Date.now() - startTime
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

