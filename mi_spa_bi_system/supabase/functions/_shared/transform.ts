// ============================================================================
// MI SPA BI SYSTEM - Transformaciones
// FALLA #2: Nested ID extraction
// FALLA #4: client_id NULL handling
// FALLA #5: Deduplicación
// ============================================================================

import { BsaleVariant, BsaleClient, BsaleDocument, BsaleDocumentDetail, Producto, Cliente, Venta, TiendaTipo } from './types.ts';
import { toInteger, toString, toNumber, toBoolean, validarFecha, formatearFecha, validarMonto, validarCantidad, sanitizeString, clasificarTienda } from './validator.ts';

// FALLA #2: Extracción segura de IDs anidados
export function extractNestedId(obj: unknown, path: string): number | null {
  if (!obj || typeof obj !== 'object') return null;
  const parts = path.split('.');
  let current: unknown = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return null;
    current = (current as Record<string, unknown>)[part];
  }
  
  if (typeof current === 'number') return current;
  if (typeof current === 'string') {
    const parsed = parseInt(current, 10);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

export function extractVariantId(detail: BsaleDocumentDetail): number | null {
  return extractNestedId(detail, 'variant.id') ?? extractNestedId(detail, 'variant_id');
}

export function extractProductId(variant: BsaleVariant): number | null {
  return extractNestedId(variant, 'product.id') ?? extractNestedId(variant, 'product_id');
}

export function extractClientId(doc: BsaleDocument): number | null {
  return extractNestedId(doc, 'client.id') ?? extractNestedId(doc, 'client_id');
}

export function extractOfficeId(obj: { office?: { id: number } }): number | null {
  return extractNestedId(obj, 'office.id');
}

// Transformadores
export function transformVariant(variant: BsaleVariant): Producto {
  const nombre = sanitizeString(variant.description || 'SIN NOMBRE', 255);
  // Extraer ID de categoría de Bsale para clasificar tienda (puede venir como string o number)
  const rawTypeId = variant.product?.product_type?.id;
  const productTypeId = rawTypeId ? parseInt(String(rawTypeId), 10) : null;
  return {
    sku: sanitizeString(variant.code || variant.barCode, 50) || null,
    bsale_product_id: extractProductId(variant),
    bsale_variant_id: toInteger(variant.id),
    bsale_category_id: productTypeId,
    nombre,
    tienda: clasificarTienda(nombre, productTypeId),
    precio_costo: 0,
    precio_venta: validarMonto(variant.salePriceLogged || variant.finalPriceLogged || 0),
    es_activo: variant.state === 0
  };
}

export function transformClient(client: BsaleClient): Cliente {
  let razonSocial = sanitizeString(client.company, 255);
  if (!razonSocial) {
    razonSocial = [client.firstName, client.lastName].filter(Boolean).join(' ') || 'CLIENTE SIN NOMBRE';
  }
  
  return {
    bsale_client_id: toInteger(client.id),
    rut: sanitizeString(client.code, 12) || null,
    razon_social: sanitizeString(razonSocial, 255),
    email: sanitizeString(client.email, 255)?.toLowerCase() || null,
    telefono: sanitizeString(client.phone, 50) || null,
    ciudad: sanitizeString(client.city, 100) || null,
    comuna: sanitizeString(client.municipality, 100) || null,
    tiene_credito: toNumber(client.maxCredit) > 0,
    cupo_credito: validarMonto(client.maxCredit),
    tipo_cliente: client.companyOrPerson === 1 ? 'EMPRESA' : 'PERSONA',
    es_activo: client.state === 0
  };
}

export function transformDocDetail(doc: BsaleDocument, detail: BsaleDocumentDetail, tienda: TiendaTipo): Venta {
  const fechaEmision = validarFecha(doc.emissionDate);
  const fechaStr = formatearFecha(fechaEmision) || formatearFecha(new Date())!;
  
  return {
    fecha: fechaStr,
    producto_id: null,
    cliente_id: null,
    bodega_id: null,
    bsale_document_id: toInteger(doc.id),
    bsale_detail_id: toInteger(detail.id),
    bsale_variant_id: extractVariantId(detail),
    tienda,
    tipo_documento: doc.document_type?.id?.toString() || 'DESCONOCIDO',
    numero_documento: toString(doc.number),
    cantidad: validarCantidad(detail.quantity),
    precio_unitario: validarMonto(detail.totalUnitValue || detail.netUnitValue),
    descuento_monto: validarMonto(detail.totalDiscount),
    subtotal: validarMonto(detail.netAmount),
    impuesto: validarMonto(detail.taxAmount),
    total: validarMonto(detail.totalAmount),
    bsale_created_at: fechaEmision || new Date()
  };
}

// FALLA #5: Deduplicación
export function deduplicateVentas(ventas: Venta[]): Venta[] {
  const seen = new Map<string, Venta>();
  for (const v of ventas) {
    const key = `${v.bsale_document_id}-${v.bsale_detail_id}`;
    if (!seen.has(key)) seen.set(key, v);
  }
  return Array.from(seen.values());
}
