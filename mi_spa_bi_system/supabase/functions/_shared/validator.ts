// ============================================================================
// MI SPA BI SYSTEM - Validadores
// FALLA #1: Type mismatches - Casting explícito
// FALLA #3: NaT fechas - Validación con rango
// ============================================================================

import { TiendaTipo } from './types.ts';

const MIN_DATE = new Date('2010-01-01');
const MAX_DATE = new Date('2030-12-31');

// FALLA #1: Normalización de tipos
export function toNumber(value: unknown, defaultValue = 0): number {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === 'number') return isNaN(value) || !isFinite(value) ? defaultValue : value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(/[^\d.-]/g, ''));
    return isNaN(parsed) || !isFinite(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
}

export function toInteger(value: unknown, defaultValue = 0): number {
  return Math.floor(toNumber(value, defaultValue));
}

export function toString(value: unknown, defaultValue = ''): string {
  if (value === null || value === undefined) return defaultValue;
  return String(value).trim();
}

export function toBoolean(value: unknown, defaultValue = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return ['true', '1', 'yes', 'si'].includes(value.toLowerCase());
  return defaultValue;
}

// FALLA #3: Validación de fechas
export function validarFecha(fecha: number | string | Date | null | undefined): Date | null {
  if (fecha === null || fecha === undefined) return null;
  
  let dateObj: Date;
  try {
    if (typeof fecha === 'number') {
      dateObj = new Date(fecha > 1e12 ? fecha : fecha * 1000);
    } else if (typeof fecha === 'string') {
      dateObj = new Date(fecha);
    } else if (fecha instanceof Date) {
      dateObj = fecha;
    } else {
      return null;
    }
    
    if (isNaN(dateObj.getTime())) return null;
    if (dateObj < MIN_DATE || dateObj > MAX_DATE) return null;
    return dateObj;
  } catch {
    return null;
  }
}

export function formatearFecha(fecha: Date | null): string | null {
  if (!fecha) return null;
  return fecha.toISOString().split('T')[0];
}

export function fechaHoy(): string {
  return new Date().toISOString().split('T')[0];
}

export function validarMonto(monto: unknown, maxValue = 999999999999): number {
  const valor = toNumber(monto, 0);
  if (valor < 0) return 0;
  if (valor > maxValue) return maxValue;
  return Math.round(valor * 100) / 100;
}

export function validarCantidad(cantidad: unknown, maxValue = 9999999): number {
  const valor = toInteger(cantidad, 0);
  if (Math.abs(valor) > maxValue) return valor > 0 ? maxValue : -maxValue;
  return valor;
}

export function sanitizeString(str: string | null | undefined, maxLength = 255): string {
  if (!str) return '';
  return str.trim().slice(0, maxLength).replace(/[\x00-\x1F\x7F]/g, '');
}

// IDs de categorías de Bsale que corresponden a EPICBIKE
const EPICBIKE_CATEGORY_IDS = new Set([
  32, // BICICLETAS
  33, // SERVICIO BIKE
  34, // REPUESTOS BIKE
  39, // Energy Gel
  40, // Electrolyte
  42, // CASCOS
  43, // INDUMENTARIA
]);

export function clasificarTienda(nombre: string, productTypeId?: number | null): TiendaTipo {
  // Primero clasificar por ID de categoría de Bsale (más preciso)
  if (productTypeId && EPICBIKE_CATEGORY_IDS.has(productTypeId)) {
    return 'EPICBIKE';
  }
  
  // Fallback: clasificar por keywords en el nombre
  const texto = (nombre || '').toUpperCase();
  const keywordsEpicbike = ['BH', 'BICICLETA', 'BIKE', 'CYCLING', 'CASCO', 'PEDAL', 'SHIMANO', 
    'SRAM', 'VITTORIA', 'CONTINENTAL', 'ISB', 'ENERGY GEL', 'MTB', 'RUEDA', 'FRENO'];
  
  for (const kw of keywordsEpicbike) {
    if (texto.includes(kw)) return 'EPICBIKE';
  }
  return 'BLUEFISHING';
}
