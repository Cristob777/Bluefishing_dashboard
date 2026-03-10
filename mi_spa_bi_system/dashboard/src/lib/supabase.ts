import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    db: {
      schema: 'bi'
    }
  }
);

export type TiendaTipo = 'BLUEFISHING';

export interface ResumenEjecutivo {
  tienda: TiendaTipo;
  productos_con_stock: number;
  unidades_stock: number;
  valor_stock_costo: number;
  valor_stock_venta: number;
  ventas_mes: number;
  por_cobrar: number;
}

export interface VentaDiaria {
  fecha: string;
  tienda: TiendaTipo;
  num_documentos: number;
  venta_total: number;
}

export interface TopProducto {
  producto_id: number;
  nombre: string;
  tienda: TiendaTipo;
  venta_total: number;
}

export async function getResumenEjecutivo(): Promise<ResumenEjecutivo[]> {
  const { data, error } = await supabase.from('mv_resumen_ejecutivo').select('*');
  if (error) throw error;
  return data || [];
}

export async function getVentasDiarias(dias = 30): Promise<VentaDiaria[]> {
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const { data, error } = await supabase.from('mv_ventas_diarias').select('*').gte('fecha', desde).order('fecha');
  if (error) throw error;
  return data || [];
}

export async function getTopProductos(limit = 10): Promise<TopProducto[]> {
  const { data, error } = await supabase.from('mv_top_productos').select('*').order('venta_total', { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}

export async function checkDataFreshness() {
  const { data, error } = await supabase.rpc('check_data_freshness');
  if (error) throw error;
  return data;
}

export async function checkOrphanRate() {
  const { data, error } = await supabase.rpc('check_orphan_rate');
  if (error) throw error;
  return data?.[0];
}

export async function triggerETL(tipo: string, fechaDesde?: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const functionUrl = `${supabaseUrl}/functions/v1/etl-bsale`;

  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ tipo, fecha_desde: fechaDesde }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}
