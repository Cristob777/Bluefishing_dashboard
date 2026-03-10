// ============================================================================
// MI SPA BI SYSTEM - Refresh de Vistas Materializadas
// Puede ejecutarse manualmente o por cron
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { db: { schema: 'bi' } }
    );

    // Refrescar vistas materializadas
    const { error: refreshError } = await supabase.rpc('refresh_all_materialized_views');
    if (refreshError) throw refreshError;

    // Generar alertas del sistema
    const { data: alertasGeneradas, error: alertasError } = await supabase.rpc('generar_alertas_sistema');
    if (alertasError) throw alertasError;

    return new Response(JSON.stringify({
      success: true,
      message: 'Vistas refrescadas y alertas generadas',
      alertas_generadas: alertasGeneradas,
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

