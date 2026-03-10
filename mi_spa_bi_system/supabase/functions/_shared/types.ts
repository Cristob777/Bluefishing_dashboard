// ============================================================================
// MI SPA BI SYSTEM - Tipos TypeScript
// ============================================================================

export type TiendaTipo = 'EPICBIKE' | 'BLUEFISHING';
export type BodegaTipo = 'CASA_MATRIZ' | 'TIENDA_WEB' | 'CURANIPE' | 'MELI';
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
export type ETLComponente = 'EXTRACT' | 'TRANSFORM' | 'LOAD' | 'VALIDATE';

// Interfaces Bsale API
export interface BsaleVariant {
  id: number;
  description?: string;
  code?: string;
  barCode?: string;
  state: number;
  salePriceLogged?: number;
  finalPriceLogged?: number;
  product: { 
    id: number; 
    href: string;
    product_type?: { id: number; name?: string };
  };
}

export interface BsaleClient {
  id: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  code?: string;
  activity?: string;
  city?: string;
  municipality?: string;
  maxCredit?: number;
  state: number;
  companyOrPerson?: number;
}

export interface BsaleDocument {
  id: number;
  emissionDate: number;
  number: number;
  totalAmount: number;
  state: number;
  client?: { id: number; href: string };
  document_type?: { id: number };
  office?: { id: number };
}

export interface BsaleDocumentDetail {
  id: number;
  lineNumber: number;
  quantity: number;
  netUnitValue: number;
  totalUnitValue: number;
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
  variant?: { id: number; product?: { id: number } };
}

export interface BsaleStock {
  id: number;
  quantity: number;
  quantityAvailable?: number;
  quantityReserved?: number;
  variant: { id: number };
  office: { id: number };
}

// Interfaces internas
export interface Producto {
  producto_id?: number;
  sku?: string | null;
  bsale_product_id?: number | null;
  bsale_variant_id: number;
  bsale_category_id?: number | null;
  nombre: string;
  tienda: TiendaTipo;
  precio_costo: number;
  precio_venta: number;
  es_activo: boolean;
}

export interface Cliente {
  cliente_id?: number;
  bsale_client_id: number;
  rut?: string | null;
  razon_social: string;
  email?: string | null;
  telefono?: string | null;
  ciudad?: string | null;
  comuna?: string | null;
  tiene_credito: boolean;
  cupo_credito: number;
  tipo_cliente?: string;
  es_activo: boolean;
}

export interface Venta {
  fecha: string;
  producto_id?: number | null;
  cliente_id?: number | null;
  bodega_id?: number | null;
  bsale_document_id: number;
  bsale_detail_id?: number | null;
  bsale_variant_id?: number | null;
  tienda: TiendaTipo;
  tipo_documento?: string;
  numero_documento?: string;
  cantidad: number;
  precio_unitario: number;
  descuento_monto: number;
  subtotal: number;
  impuesto: number;
  total: number;
  bsale_created_at?: Date;
}

export interface ETLStats {
  procesados: number;
  insertados: number;
  actualizados: number;
  errores: number;
}

export interface ETLResponse {
  success: boolean;
  job_id?: string;
  stats?: ETLStats;
  message?: string;
  error?: string;
  duration_ms?: number;
}

export interface BsaleApiResponse<T> {
  count: number;
  limit: number;
  offset: number;
  items: T[];
}

// IMPORTANTE: Actualizar con IDs reales de bsale_explorer.html
export const BODEGAS_MAP: Record<number, BodegaTipo> = {
  1: 'CASA_MATRIZ',
  2: 'TIENDA_WEB',
  3: 'CURANIPE',
  4: 'MELI'
};
