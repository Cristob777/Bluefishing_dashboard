// =============================================================================
// DEMO DATA - Coherent mock data for Bluefishing.cl demo
// ALL DATA IS DETERMINISTIC - no Math.random() to avoid chart flickering
// =============================================================================

const today = new Date();
const fmt = (d: Date) => d.toISOString().split('T')[0];
const daysAgo = (n: number) => { const d = new Date(today); d.setDate(d.getDate() - n); return d; };

// Seeded PRNG for deterministic "random" values
function seeded(seed: number) {
  return () => { seed = (seed * 16807 + 0) % 2147483647; return (seed - 1) / 2147483646; };
}
const rng = seeded(42);
const rid = (i: number) => `demo-${String(i).padStart(6, '0')}`;

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------
const CATEGORIAS = [
  'Fishing Rods', 'Reels', 'Artificial Lures', 'Lines & Leaders',
  'Fishing Accessories', 'Outdoor Apparel', 'Camping & Trekking',
  'Fly Fishing', 'Kayak & Boating', 'Marine Electronics'
];

const PRODUCTOS_TOP = [
  { id: 1, nombre: 'Shimano Sedona 7ft MH Rod', cat: 'Fishing Rods', precio: 89990, stock: 23 },
  { id: 2, nombre: 'Daiwa BG 4000 Reel', cat: 'Reels', precio: 129990, stock: 15 },
  { id: 3, nombre: 'Rapala X-Rap 10cm Lure', cat: 'Artificial Lures', precio: 12990, stock: 87 },
  { id: 4, nombre: 'Power Pro 30lb 150yds Line', cat: 'Lines & Leaders', precio: 34990, stock: 42 },
  { id: 5, nombre: 'Penn Battle III 6.6ft Rod', cat: 'Fishing Rods', precio: 79990, stock: 18 },
  { id: 6, nombre: 'Shimano Stradic FL 3000 Reel', cat: 'Reels', precio: 189990, stock: 8 },
  { id: 7, nombre: 'Simms G3 Guide Wader', cat: 'Outdoor Apparel', precio: 459990, stock: 5 },
  { id: 8, nombre: 'Yo-Zuri Crystal Minnow Lure', cat: 'Artificial Lures', precio: 8990, stock: 120 },
  { id: 9, nombre: 'Seaguar Fluorocarbon Leader 20lb', cat: 'Lines & Leaders', precio: 18990, stock: 55 },
  { id: 10, nombre: 'Plano 3700 Waterproof Tackle Box', cat: 'Fishing Accessories', precio: 24990, stock: 35 },
  { id: 11, nombre: 'Coleman Sundome 4P Tent', cat: 'Camping & Trekking', precio: 119990, stock: 12 },
  { id: 12, nombre: 'Orvis Clearwater 9ft #5 Fly Rod', cat: 'Fly Fishing', precio: 249990, stock: 6 },
  { id: 13, nombre: 'Pelican Catch 100 Kayak', cat: 'Kayak & Boating', precio: 599990, stock: 3 },
  { id: 14, nombre: 'Garmin Striker 4 Fish Finder', cat: 'Marine Electronics', precio: 159990, stock: 9 },
  { id: 15, nombre: 'Savage Gear 3D Shrimp Lure', cat: 'Artificial Lures', precio: 6990, stock: 200 },
  { id: 16, nombre: 'Abu Garcia Revo SX Reel', cat: 'Reels', precio: 149990, stock: 11 },
  { id: 17, nombre: 'Frabill 22" Landing Net', cat: 'Fishing Accessories', precio: 39990, stock: 20 },
  { id: 18, nombre: 'Berkley X9 Braid 0.20mm', cat: 'Lines & Leaders', precio: 29990, stock: 65 },
  { id: 19, nombre: 'Hayabusa Slow Pitch Jig 150g', cat: 'Artificial Lures', precio: 15990, stock: 45 },
  { id: 20, nombre: 'Aqua-Lung Life Vest', cat: 'Kayak & Boating', precio: 69990, stock: 14 },
];

const CLIENTES_TOP = [
  { id: 1, nombre: 'Patagonia Distributors Ltd.', rut: '76.234.567-8', compras: 186, total: 48520000 },
  { id: 2, nombre: 'Robalos Fishing Club', rut: '65.432.109-K', compras: 94, total: 22340000 },
  { id: 3, nombre: 'Outdoor Adventure SpA', rut: '77.891.234-5', compras: 67, total: 18750000 },
  { id: 4, nombre: 'Rodrigo Muñoz S.', rut: '12.345.678-9', compras: 53, total: 12890000 },
  { id: 5, nombre: 'Camping Total Chile S.A.', rut: '96.543.210-1', compras: 45, total: 11200000 },
  { id: 6, nombre: 'Andrés Soto F.', rut: '15.678.901-2', compras: 41, total: 9870000 },
  { id: 7, nombre: 'Southern Sport Fishing Ltd.', rut: '76.789.012-3', compras: 38, total: 8950000 },
  { id: 8, nombre: 'Carolina Reyes B.', rut: '16.789.012-4', compras: 35, total: 7620000 },
  { id: 9, nombre: 'Coquimbo Marine Supply', rut: '77.012.345-6', compras: 29, total: 6340000 },
  { id: 10, nombre: 'Baker River Tourism Ltd.', rut: '76.345.678-7', compras: 24, total: 5890000 },
  { id: 11, nombre: 'José Hernández L.', rut: '14.567.890-1', compras: 22, total: 4560000 },
  { id: 12, nombre: 'Nautika Imports SpA', rut: '77.456.789-0', compras: 19, total: 3980000 },
  { id: 13, nombre: 'María José Contreras', rut: '17.890.123-4', compras: 15, total: 3210000 },
  { id: 14, nombre: 'Aysén Fly Fishing Guide', rut: '76.012.345-8', compras: 12, total: 2870000 },
  { id: 15, nombre: 'Aconcagua Sports Ltd.', rut: '76.678.901-2', compras: 10, total: 2340000 },
];

const REGIONES = [
  { region: 'Metropolitan', ventas: 32400000, clientes: 48, txn: 312 },
  { region: 'Valparaíso', ventas: 5800000, clientes: 15, txn: 67 },
  { region: 'Biobío', ventas: 4200000, clientes: 12, txn: 48 },
  { region: 'Los Lagos', ventas: 3600000, clientes: 9, txn: 38 },
  { region: 'Maule', ventas: 2900000, clientes: 8, txn: 31 },
  { region: 'Araucanía', ventas: 1800000, clientes: 6, txn: 22 },
  { region: 'Aysén', ventas: 1200000, clientes: 4, txn: 15 },
  { region: 'Coquimbo', ventas: 950000, clientes: 5, txn: 12 },
  { region: 'O\'Higgins', ventas: 780000, clientes: 3, txn: 9 },
  { region: 'Atacama', ventas: 420000, clientes: 2, txn: 5 },
];

const wave = (i: number, period: number, amp: number, phase = 0) =>
  Math.round(amp * Math.sin((i + phase) * 2 * Math.PI / period));

// ---------------------------------------------------------------------------
// 1. MAIN DASHBOARD
// ---------------------------------------------------------------------------
export function getDemoDashboard() {
  const resumen = [{
    tienda: 'BLUEFISHING' as const,
    productos_con_stock: 892,
    unidades_stock: 12450,
    valor_stock_costo: 245000000,
    valor_stock_venta: 412000000,
    ventas_mes: 54200000,
    num_ventas_mes: 487,
    por_cobrar: 8900000,
  }];

  const ventas: Array<{ fecha: string; tienda: string; num_documentos: number; venta_total: number }> = [];
  for (let i = 29; i >= 0; i--) {
    const d = daysAgo(i);
    const dow = d.getDay();
    const base = dow === 0 ? 820000 : dow === 6 ? 1450000 : 1750000;
    const trend = Math.round((29 - i) * 15000);
    const seasonal = wave(i, 7, 180000) + wave(i, 14, 90000, 3);
    ventas.push({
      fecha: fmt(d),
      tienda: 'BLUEFISHING',
      num_documentos: dow === 0 ? 6 : dow === 6 ? 12 : Math.min(22, 14 + Math.round((29 - i) * 0.2)),
      venta_total: Math.max(600000, base + trend + seasonal),
    });
  }

  const topVentas = [8450000, 7680000, 6920000, 6150000, 5480000, 4890000, 4210000, 3640000, 3120000, 2580000];
  const top = PRODUCTOS_TOP.slice(0, 10).map((p, i) => ({
    producto_id: p.id,
    nombre: p.nombre,
    tienda: 'BLUEFISHING',
    venta_total: topVentas[i],
  }));

  const alertas = [
    { alerta_id: 1, tipo: 'LOW_STOCK', prioridad: 'HIGH', titulo: 'Shimano Stradic FL low stock (8 units)', tienda: 'BLUEFISHING' },
    { alerta_id: 2, tipo: 'UNUSUAL_SALES', prioridad: 'MEDIUM', titulo: 'Lures sales +45% vs average', tienda: 'BLUEFISHING' },
    { alerta_id: 3, tipo: 'COLLECTIONS', prioridad: 'HIGH', titulo: '3 invoices overdue > 30 days', tienda: 'BLUEFISHING' },
    { alerta_id: 4, tipo: 'LOW_STOCK', prioridad: 'MEDIUM', titulo: 'Simms G3 Guide Wader only 5 units', tienda: 'BLUEFISHING' },
    { alerta_id: 5, tipo: 'STOCKOUT_IMMINENT', prioridad: 'CRITICAL', titulo: 'Pelican Catch Kayak runs out in ~7 days', tienda: 'BLUEFISHING' },
  ];

  const predicciones = [
    { nivel: 'tienda', nombre: 'BLUEFISHING', venta_proyectada: 58400000, tendencia: 'GROWTH', factor_estacional: 1.12 },
  ];

  return { resumen, ventas, top, alertas, predicciones };
}

// ---------------------------------------------------------------------------
// 2. SALES
// ---------------------------------------------------------------------------
export function getDemoVentas(dias: number) {
  const ventas: Array<{ fecha: string; tienda: string; num_documentos: number; venta_total: number }> = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = daysAgo(i);
    const dow = d.getDay();
    const base = dow === 0 ? 920000 : dow === 6 ? 1520000 : 1820000;
    const trend = Math.round((dias - 1 - i) * 12000);
    const seasonal = wave(i, 7, 160000) + wave(i, 11, 70000, 2);
    ventas.push({
      fecha: fmt(d),
      tienda: 'BLUEFISHING',
      num_documentos: dow === 0 ? 7 : dow === 6 ? 13 : 15 + Math.round((dias - 1 - i) * 0.15),
      venta_total: Math.max(650000, base + trend + seasonal),
    });
  }

  const topVals = [5920000, 5640000, 5370000, 5090000, 4820000, 4550000, 4290000, 4020000, 3760000, 3490000,
    3230000, 2960000, 2700000, 2430000, 2170000, 1900000, 1640000, 1380000, 1110000, 850000];
  const topProductos = PRODUCTOS_TOP.map((p, i) => ({
    producto_id: p.id,
    nombre: p.nombre,
    tienda: 'BLUEFISHING',
    venta_total: topVals[i],
    unidades: Math.round(topVals[i] / p.precio),
  }));

  return { ventas, topProductos };
}

// ---------------------------------------------------------------------------
// 3. INVENTORY
// ---------------------------------------------------------------------------
export function getDemoInventario() {
  const rotVals = [7.8, 6.5, 5.9, 5.2, 4.8, 4.3, 3.7, 3.2, 2.8, 2.4, 2.0, 1.7, 1.4, 1.1, 0.9, 0.7, 0.6, 0.5, 0.4, 0.3];
  const stockDays = [18, 22, 28, 32, 38, 42, 48, 55, 62, 70, 78, 85, 95, 110, 130, 150, null, null, null, null];
  const uniVend =  [245, 218, 192, 170, 155, 138, 120, 105, 92, 80, 68, 58, 48, 40, 34, 28, 22, 18, 14, 10];

  const rotacion = PRODUCTOS_TOP.map((p, i) => ({
    producto_id: p.id,
    nombre: p.nombre,
    tienda: 'BLUEFISHING',
    unidades_vendidas: uniVend[i],
    venta_total: uniVend[i] * p.precio,
    stock_actual: p.stock,
    dias_stock: stockDays[i],
    rotacion: rotVals[i],
    clasificacion: i < 5 ? 'HIGH' : i < 12 ? 'MEDIUM' : 'LOW',
    semaforo: i < 7 ? 'GREEN' : i < 15 ? 'YELLOW' : 'RED',
  }));

  const abcVentas = [22048000, 17998000, 14990000, 11990000, 9990000, 7990000, 5990000, 4490000, 3490000, 2490000,
    1990000, 1490000, 990000, 790000, 590000, 490000, 390000, 290000, 190000, 150000];
  const abc = PRODUCTOS_TOP.map((p, i) => ({
    producto_id: p.id,
    nombre: p.nombre,
    tienda: 'BLUEFISHING',
    categoria: p.cat,
    precio_venta: p.precio,
    unidades_vendidas: Math.round(abcVentas[i] / p.precio),
    venta_total: abcVentas[i],
    clasificacion: i < 4 ? 'A' : i < 12 ? 'B' : 'C',
  }));

  return { rotacion, abc };
}

// ---------------------------------------------------------------------------
// 4. CATEGORIES
// ---------------------------------------------------------------------------
export function getDemoCategorias() {
  const catProds =  [480, 390, 350, 280, 240, 180, 160, 120, 95, 72];
  const catActivos = [420, 340, 310, 250, 210, 155, 140, 105, 82, 60];
  const catVentas = [12400000, 10800000, 9500000, 7200000, 5800000, 4200000, 3100000, 2400000, 1800000, 1200000];
  const catUnids =  [520, 460, 410, 350, 290, 220, 170, 130, 95, 65];
  const catDocs =   [128, 112, 98, 84, 72, 56, 44, 32, 24, 16];
  const catPVend =  [42, 38, 35, 30, 26, 20, 16, 12, 9, 6];

  const categorias = CATEGORIAS.map((c, i) => ({
    categoria_id: i + 1,
    categoria: c,
    tienda: 'BLUEFISHING',
    bsale_category_id: 100 + i,
    total_productos: catProds[i],
    productos_activos: catActivos[i],
  }));

  const ventasCat = CATEGORIAS.map((c, i) => ({
    categoria_id: i + 1,
    categoria: c,
    tienda: 'BLUEFISHING',
    venta_total: catVentas[i],
    unidades_vendidas: catUnids[i],
    num_documentos: catDocs[i],
    productos_vendidos: catPVend[i],
  }));

  const productos = PRODUCTOS_TOP.map(p => ({
    producto_id: p.id,
    nombre: p.nombre,
    sku: `BF-${String(p.id).padStart(4, '0')}`,
    tienda: 'BLUEFISHING',
    precio_venta: p.precio,
    es_activo: true,
  }));

  return { categorias, ventasCat, productos };
}

// ---------------------------------------------------------------------------
// 5. CUSTOMERS
// ---------------------------------------------------------------------------
export function getDemoClientes() {
  const segmentosDef = [
    { segmento: 'Champions', clientes: 28, valor: 62800000, freq: 8.2, dias: 12 },
    { segmento: 'Loyal', clientes: 15, valor: 11700000, freq: 4.5, dias: 25 },
    { segmento: 'Promising', clientes: 19, valor: 9600000, freq: 2.8, dias: 35 },
    { segmento: 'Regular', clientes: 22, valor: 4800000, freq: 1.9, dias: 48 },
    { segmento: 'At Risk', clientes: 5, valor: 1260000, freq: 1.2, dias: 75 },
    { segmento: 'Cant Lose', clientes: 12, valor: 1300000, freq: 1.0, dias: 90 },
    { segmento: 'Lost', clientes: 41, valor: 2080000, freq: 1.0, dias: 180 },
  ];

  const segmentos = segmentosDef.map(s => ({
    tienda: 'BLUEFISHING',
    segmento: s.segmento,
    num_clientes: s.clientes,
    valor_total: s.valor,
    frecuencia_promedio: s.freq,
    dias_promedio_inactivo: s.dias,
  }));

  const diasUltimaCompra = [3, 5, 8, 12, 15, 18, 22, 26, 7, 14, 20, 28, 9, 16, 24];
  const diasPrimeraCompra = [380, 420, 350, 290, 480, 340, 510, 280, 390, 460, 320, 400, 270, 440, 360];

  const topClientes = CLIENTES_TOP.map((c, i) => ({
    cliente_id: c.id,
    razon_social: c.nombre,
    rut: c.rut,
    tienda: 'BLUEFISHING',
    compras: c.compras,
    total_compras: c.total,
    ticket_promedio: Math.floor(c.total / c.compras),
    ultima_compra: fmt(daysAgo(diasUltimaCompra[i])),
    primera_compra: fmt(daysAgo(diasPrimeraCompra[i])),
    ranking: i + 1,
  }));

  const rfmSegments = ['Champions', 'Champions', 'Champions', 'Loyal', 'Loyal', 'Promising', 'Promising', 'Regular', 'Regular', 'Regular', 'At Risk', 'At Risk', 'Cant Lose', 'Lost', 'Lost'];
  const diasRFM = [5, 8, 12, 22, 28, 35, 42, 50, 58, 65, 78, 85, 95, 150, 210];

  const clientesRFM = CLIENTES_TOP.map((c, i) => ({
    cliente_id: c.id,
    razon_social: c.nombre,
    tienda: 'BLUEFISHING',
    frecuencia: c.compras,
    monetario: c.total,
    dias_desde_ultima: diasRFM[i],
    segmento: rfmSegments[i],
    rfm_total: Math.max(3, 15 - i),
  }));

  return { segmentos, topClientes, clientesRFM };
}

// ---------------------------------------------------------------------------
// 6. COLLECTIONS
// ---------------------------------------------------------------------------
export function getDemoCobranza() {
  const resumen = [
    { tienda: 'BLUEFISHING', estado: 'PAID', num_documentos: 342, monto_total: 167800000, monto_pagado: 167800000, monto_pendiente: 0 },
    { tienda: 'BLUEFISHING', estado: 'PENDING', num_documentos: 18, monto_total: 12400000, monto_pagado: 0, monto_pendiente: 12400000 },
    { tienda: 'BLUEFISHING', estado: 'PARTIAL', num_documentos: 8, monto_total: 5600000, monto_pagado: 3200000, monto_pendiente: 2400000 },
    { tienda: 'BLUEFISHING', estado: 'OVERDUE', num_documentos: 5, monto_total: 3900000, monto_pagado: 0, monto_pendiente: 3900000 },
  ];

  const montos = [1850000, 920000, 1420000, 680000, 2100000, 750000, 1680000, 540000, 1950000, 1120000,
    890000, 1560000, 420000, 2300000, 780000, 1340000, 960000, 1700000, 610000, 1480000,
    830000, 1250000, 1080000, 570000, 1900000, 440000, 1620000, 720000, 1380000, 990000,
    860000, 1540000, 1100000, 650000, 2050000, 510000, 1760000, 700000, 1430000, 1200000];

  const documentos = montos.map((monto, i) => {
    const estado = i < 25 ? 'PAID' : i < 32 ? 'PENDING' : i < 37 ? 'PARTIAL' : 'OVERDUE';
    const pagado = estado === 'PAID' ? monto : estado === 'PARTIAL' ? Math.floor(monto * 0.6) : 0;
    return {
      documento_id: rid(1000 + i),
      cliente_id: CLIENTES_TOP[i % CLIENTES_TOP.length].id,
      tienda: 'BLUEFISHING',
      tipo_documento: i % 3 === 0 ? 'INVOICE' : 'RECEIPT',
      numero_documento: `${18000 + i}`,
      fecha_emision: fmt(daysAgo(Math.floor(i * 2.5))),
      fecha_vencimiento: fmt(daysAgo(Math.max(0, Math.floor(i * 2.5 - 30)))),
      monto_original: monto,
      monto_pagado: pagado,
      estado,
    };
  });

  return { resumen, documentos };
}

// ---------------------------------------------------------------------------
// 7. PREDICTIONS
// ---------------------------------------------------------------------------
export function getDemoPredicciones() {
  return [
    { prediccion_id: 1, tipo: 'sales', nivel: 'store', nombre: 'BLUEFISHING', tienda: 'BLUEFISHING', fecha_prediccion: fmt(today), periodo: '30d', valor_actual: 54200000, valor_predicho: 58400000, limite_inferior: 49640000, limite_superior: 67160000, tendencia: 'GROWTH', confianza: 78 },
    { prediccion_id: 2, tipo: 'sales', nivel: 'store', nombre: 'BLUEFISHING', tienda: 'BLUEFISHING', fecha_prediccion: fmt(today), periodo: '90d', valor_actual: 154000000, valor_predicho: 178500000, limite_inferior: 151725000, limite_superior: 205275000, tendencia: 'GROWTH', confianza: 72 },
    { prediccion_id: 3, tipo: 'sales', nivel: 'category', nombre: 'Fishing Rods', tienda: 'BLUEFISHING', fecha_prediccion: fmt(today), periodo: '30d', valor_actual: 9820000, valor_predicho: 11200000, limite_inferior: 9520000, limite_superior: 12880000, tendencia: 'GROWTH', confianza: 75 },
    { prediccion_id: 4, tipo: 'sales', nivel: 'category', nombre: 'Artificial Lures', tienda: 'BLUEFISHING', fecha_prediccion: fmt(today), periodo: '30d', valor_actual: 7350000, valor_predicho: 6900000, limite_inferior: 5865000, limite_superior: 7935000, tendencia: 'DECLINE', confianza: 68 },
    { prediccion_id: 5, tipo: 'sales', nivel: 'category', nombre: 'Reels', tienda: 'BLUEFISHING', fecha_prediccion: fmt(today), periodo: '30d', valor_actual: 8100000, valor_predicho: 8450000, limite_inferior: 7182500, limite_superior: 9717500, tendencia: 'STABLE', confianza: 80 },
    { prediccion_id: 6, tipo: 'sales', nivel: 'category', nombre: 'Lines & Leaders', tienda: 'BLUEFISHING', fecha_prediccion: fmt(today), periodo: '30d', valor_actual: 4600000, valor_predicho: 5200000, limite_inferior: 4420000, limite_superior: 5980000, tendencia: 'GROWTH', confianza: 82 },
    { prediccion_id: 7, tipo: 'sales', nivel: 'category', nombre: 'Fishing Accessories', tienda: 'BLUEFISHING', fecha_prediccion: fmt(today), periodo: '30d', valor_actual: 3900000, valor_predicho: 4100000, limite_inferior: 3485000, limite_superior: 4715000, tendencia: 'STABLE', confianza: 74 },
    { prediccion_id: 8, tipo: 'stock', nivel: 'product', nombre: 'Shimano Stradic FL 3000 Reel', tienda: 'BLUEFISHING', fecha_prediccion: fmt(today), periodo: '30d', valor_actual: 8, valor_predicho: 2, limite_inferior: 0, limite_superior: 4, tendencia: 'DECLINE', confianza: 85 },
    { prediccion_id: 9, tipo: 'stock', nivel: 'product', nombre: 'Pelican Catch 100 Kayak', tienda: 'BLUEFISHING', fecha_prediccion: fmt(today), periodo: '30d', valor_actual: 3, valor_predicho: 0, limite_inferior: 0, limite_superior: 1, tendencia: 'DECLINE', confianza: 88 },
    { prediccion_id: 10, tipo: 'stock', nivel: 'warehouse', nombre: 'Headquarters', tienda: 'BLUEFISHING', fecha_prediccion: fmt(today), periodo: '30d', valor_actual: 9800, valor_predicho: 8650, limite_inferior: 7352, limite_superior: 9947, tendencia: 'DECLINE', confianza: 71 },
    { prediccion_id: 11, tipo: 'stock', nivel: 'warehouse', nombre: 'Curanipe', tienda: 'BLUEFISHING', fecha_prediccion: fmt(today), periodo: '30d', valor_actual: 1850, valor_predicho: 2100, limite_inferior: 1785, limite_superior: 2415, tendencia: 'GROWTH', confianza: 69 },
    { prediccion_id: 12, tipo: 'demand', nivel: 'category', nombre: 'Saltwater Fishing', tienda: 'BLUEFISHING', fecha_prediccion: fmt(today), periodo: '30d', valor_actual: 3800000, valor_predicho: 5200000, limite_inferior: 4420000, limite_superior: 5980000, tendencia: 'GROWTH', confianza: 73 },
    { prediccion_id: 13, tipo: 'demand', nivel: 'category', nombre: 'River Fishing', tienda: 'BLUEFISHING', fecha_prediccion: fmt(today), periodo: '30d', valor_actual: 2400000, valor_predicho: 1950000, limite_inferior: 1657500, limite_superior: 2242500, tendencia: 'DECLINE', confianza: 71 },
    { prediccion_id: 14, tipo: 'demand', nivel: 'category', nombre: 'Camping', tienda: 'BLUEFISHING', fecha_prediccion: fmt(today), periodo: '30d', valor_actual: 1800000, valor_predicho: 2300000, limite_inferior: 1955000, limite_superior: 2645000, tendencia: 'GROWTH', confianza: 76 },
  ];
}

// ---------------------------------------------------------------------------
// 8. REGIONS
// ---------------------------------------------------------------------------
export function getDemoRegiones() {
  const resumen = REGIONES.map(r => ({
    region: r.region,
    ventas_bluefishing: r.ventas,
    venta_total: r.ventas,
    total_clientes: r.clientes,
    total_ventas: r.txn,
  }));

  const topRegiones = REGIONES.slice(0, 8).map((r, i) => ({
    region: r.region,
    clientes_activos: r.clientes,
    total_ventas: r.txn,
    venta_total: r.ventas,
    ticket_promedio: Math.floor(r.ventas / r.txn),
    ranking: i + 1,
  }));

  const prodUnits = [[72, 58, 45, 38, 28], [35, 28, 22, 18, 14], [28, 22, 18, 15, 11], [24, 19, 15, 12, 9], [20, 16, 12, 10, 7]];
  const prodSales = [[2800000, 2200000, 1750000, 1400000, 1100000], [1200000, 950000, 750000, 600000, 480000],
    [980000, 780000, 620000, 490000, 390000], [820000, 650000, 520000, 410000, 330000], [680000, 540000, 430000, 340000, 270000]];

  const productosPorRegion = REGIONES.slice(0, 5).flatMap((r, ri) =>
    PRODUCTOS_TOP.slice(0, 5).map((p, pi) => ({
      region: r.region,
      tienda: 'BLUEFISHING',
      categoria: p.cat,
      producto_id: p.id,
      producto: p.nombre,
      unidades: prodUnits[ri][pi],
      venta_total: prodSales[ri][pi],
      rank_en_region: pi + 1,
    }))
  );

  const cliCompras = [[32, 24, 18, 14, 10], [15, 12, 9, 7, 5], [12, 9, 7, 5, 4], [10, 8, 6, 4, 3], [8, 6, 5, 3, 2]];
  const cliTotals = [[7200000, 5400000, 4100000, 3200000, 2400000], [3100000, 2400000, 1800000, 1400000, 1050000],
    [2500000, 1900000, 1450000, 1100000, 850000], [2100000, 1600000, 1200000, 950000, 720000], [1700000, 1300000, 980000, 750000, 570000]];

  const clientesPorRegion = REGIONES.slice(0, 5).flatMap((r, ri) =>
    CLIENTES_TOP.slice(0, 5).map((c, ci) => ({
      region: r.region,
      cliente_id: c.id,
      razon_social: c.nombre,
      tienda: 'BLUEFISHING',
      num_compras: cliCompras[ri][ci],
      total_comprado: cliTotals[ri][ci],
      rank_en_region: ci + 1,
    }))
  );

  const catPcts = [[28.5, 22.1, 18.4, 14.2, 10.3, 6.5], [26.8, 21.4, 17.6, 15.1, 11.8, 7.3],
    [25.2, 20.8, 19.1, 14.8, 12.4, 7.7], [27.1, 19.5, 18.2, 16.3, 11.2, 7.7], [24.6, 22.8, 16.9, 15.4, 13.1, 7.2]];

  const categoriasPorRegion = REGIONES.slice(0, 5).flatMap((r, ri) =>
    CATEGORIAS.slice(0, 6).map((c, ci) => ({
      region: r.region,
      categoria: c,
      tienda: 'BLUEFISHING',
      productos_vendidos: Math.round(catPcts[ri][ci] * 1.2),
      unidades: Math.round(catPcts[ri][ci] * 4.5),
      venta_total: Math.round(r.ventas * catPcts[ri][ci] / 100),
      porcentaje_region: catPcts[ri][ci],
    }))
  );

  return { resumen, topRegiones, productosPorRegion, clientesPorRegion, categoriasPorRegion };
}

// ---------------------------------------------------------------------------
// 9. CASH FLOW
// ---------------------------------------------------------------------------
export function getDemoFlujoCaja() {
  const baseVentas = [1680000, 1820000, 1950000, 1750000, 2100000, 2250000, 1450000,
    1720000, 1890000, 2010000, 1800000, 2150000, 2320000, 1520000,
    1780000, 1940000, 2080000, 1860000, 2200000, 2380000, 1580000,
    1840000, 2000000, 2140000, 1920000];

  const flujo = baseVentas.map((v, i) => {
    const pagos = Math.round(v * (0.88 + (i % 3) * 0.03));
    const devol = Math.round(v * (0.025 + (i % 5) * 0.005));
    return {
      fecha: fmt(daysAgo(24 - i)),
      tienda: 'BLUEFISHING',
      ventas: v,
      pagos_recibidos: pagos,
      devoluciones: devol,
      venta_neta: v - devol,
      flujo_neto: pagos - devol,
    };
  });

  const pagos = [
    { mes: fmt(today).slice(0, 7), periodo: 'January 2026', tienda: 'BLUEFISHING', metodo_pago: 'WIRE TRANSFER', num_pagos: 185, total_pagado: 14800000 },
    { mes: fmt(today).slice(0, 7), periodo: 'January 2026', tienda: 'BLUEFISHING', metodo_pago: 'ONLINE PAYMENT', num_pagos: 142, total_pagado: 11200000 },
    { mes: fmt(today).slice(0, 7), periodo: 'January 2026', tienda: 'BLUEFISHING', metodo_pago: 'CREDIT CARD', num_pagos: 98, total_pagado: 8500000 },
    { mes: fmt(today).slice(0, 7), periodo: 'January 2026', tienda: 'BLUEFISHING', metodo_pago: 'CASH', num_pagos: 45, total_pagado: 3200000 },
    { mes: fmt(today).slice(0, 7), periodo: 'January 2026', tienda: 'BLUEFISHING', metodo_pago: 'CHECK', num_pagos: 17, total_pagado: 4500000 },
  ];

  const devoluciones = [
    { mes: fmt(today).slice(0, 7), periodo: 'January 2026', tienda: 'BLUEFISHING', tipo: 'CREDIT_NOTE', num_devoluciones: 12, unidades_devueltas: 18, total_devuelto: 890000 },
    { mes: fmt(today).slice(0, 7), periodo: 'January 2026', tienda: 'BLUEFISHING', tipo: 'RETURN', num_devoluciones: 5, unidades_devueltas: 7, total_devuelto: 345000 },
  ];

  return { flujo, pagos, devoluciones };
}

// ---------------------------------------------------------------------------
// 10. ALERTS
// ---------------------------------------------------------------------------
export function getDemoAlertas() {
  return [
    { alerta_id: 1, tipo: 'LOW_STOCK', prioridad: 'CRITICAL', titulo: 'Pelican Catch 100 Kayak - Only 3 units', mensaje: 'Critical stock. Sell rate: 1.2/week. Runs out in ~2.5 weeks.', estado: 'ACTIVE', tienda: 'BLUEFISHING', producto_id: 13, fecha_creacion: fmt(daysAgo(0)), fecha_resolucion: null, datos: { stock: 3, velocidad_venta: 1.2 }, accion_sugerida: 'Request urgent replenishment from supplier' },
    { alerta_id: 2, tipo: 'LOW_STOCK', prioridad: 'HIGH', titulo: 'Shimano Stradic FL 3000 Reel - 8 units', mensaje: 'Low stock. Top 6 product by sales. Supplier lead time: 15 days.', estado: 'ACTIVE', tienda: 'BLUEFISHING', producto_id: 6, fecha_creacion: fmt(daysAgo(1)), fecha_resolucion: null, datos: { stock: 8, lead_time: 15 }, accion_sugerida: 'Generate purchase order for 20 units' },
    { alerta_id: 3, tipo: 'LOW_STOCK', prioridad: 'HIGH', titulo: 'Simms G3 Guide Wader - 5 units', mensaje: 'Low stock for peak season. High-value item ($459,990), direct import.', estado: 'ACTIVE', tienda: 'BLUEFISHING', producto_id: 7, fecha_creacion: fmt(daysAgo(1)), fecha_resolucion: null, datos: { stock: 5 }, accion_sugerida: 'Evaluate direct import' },
    { alerta_id: 4, tipo: 'UNUSUAL_SALES', prioridad: 'MEDIUM', titulo: 'Lures sales +45% vs average', mensaje: 'Artificial Lures category up 45% in the last 7 days vs monthly average.', estado: 'ACTIVE', tienda: 'BLUEFISHING', producto_id: null, fecha_creacion: fmt(daysAgo(2)), fecha_resolucion: null, datos: { incremento_pct: 45 }, accion_sugerida: 'Review popular lure stock and reinforce' },
    { alerta_id: 5, tipo: 'OVERDUE_INVOICE', prioridad: 'HIGH', titulo: '3 invoices overdue > 30 days ($3.9M)', mensaje: 'Patagonia Distributors has 2 overdue invoices for $2.1M. Robalos Fishing Club has 1 invoice for $1.8M.', estado: 'ACTIVE', tienda: 'BLUEFISHING', producto_id: null, fecha_creacion: fmt(daysAgo(3)), fecha_resolucion: null, datos: { monto_total: 3900000 }, accion_sugerida: 'Contact customers to manage collection' },
    { alerta_id: 6, tipo: 'STOCKOUT_IMMINENT', prioridad: 'CRITICAL', titulo: 'Garmin Striker 4 Fish Finder - stockout in ~10 days', mensaje: 'Only 9 units, sell rate 0.9/day. Lead time: 30 days (import).', estado: 'ACTIVE', tienda: 'BLUEFISHING', producto_id: 14, fecha_creacion: fmt(daysAgo(0)), fecha_resolucion: null, datos: { stock: 9, dias_quiebre: 10 }, accion_sugerida: 'Initiate immediate import order' },
    { alerta_id: 7, tipo: 'BRANCH_RESTOCK', prioridad: 'MEDIUM', titulo: 'Curanipe: 12 products below minimum', mensaje: 'Curanipe branch has 12 SKUs below suggested minimum. Requires shipment from Headquarters.', estado: 'ACTIVE', tienda: 'BLUEFISHING', producto_id: null, fecha_creacion: fmt(daysAgo(2)), fecha_resolucion: null, datos: { skus_bajo_minimo: 12 }, accion_sugerida: 'Prepare shipment Santiago → Curanipe' },
    { alerta_id: 8, tipo: 'DEAD_STOCK', prioridad: 'LOW', titulo: '45 products with no sales in 90+ days', mensaje: 'Zombie inventory: 45 SKUs with no movement for over 90 days. Estimated retained capital: $8.2M.', estado: 'ACTIVE', tienda: 'BLUEFISHING', producto_id: null, fecha_creacion: fmt(daysAgo(5)), fecha_resolucion: null, datos: { skus: 45, capital_retenido: 8200000 }, accion_sugerida: 'Evaluate clearance or promotion' },
    { alerta_id: 9, tipo: 'SALES_TARGET', prioridad: 'MEDIUM', titulo: 'Sales at 78% of monthly target', mensaje: '8 days left to close the month. $12M more needed to reach the $66M target.', estado: 'ACTIVE', tienda: 'BLUEFISHING', producto_id: null, fecha_creacion: fmt(daysAgo(0)), fecha_resolucion: null, datos: { pct_meta: 78, faltante: 12000000 }, accion_sugerida: 'Activate month-end sales campaign' },
    { alerta_id: 10, tipo: 'LOW_STOCK', prioridad: 'MEDIUM', titulo: 'Orvis Clearwater Fly Rod - 6 units', mensaje: 'Fly fishing season approaching. Insufficient stock for expected demand.', estado: 'RESOLVED', tienda: 'BLUEFISHING', producto_id: 12, fecha_creacion: fmt(daysAgo(8)), fecha_resolucion: fmt(daysAgo(3)), datos: { stock: 6 }, accion_sugerida: 'Order placed with supplier' },
  ];
}

// ---------------------------------------------------------------------------
// 11. FINANCE - Financial Center
// ---------------------------------------------------------------------------
export function getDemoFinanzas() {
  const limits = [18000000, 12000000, 10000000, 8000000, 7000000, 6000000, 5000000, 5000000, 4000000, 4000000, 3000000, 3000000, 2000000, 2000000, 1500000];
  const debts =  [4200000, 3100000, 2800000, 420000, 180000, 0, 0, 350000, 0, 0, 0, 0, 0, 0, 0];
  const overdues = [1800000, 1200000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const statuses: Array<'OK' | 'DELINQUENT' | 'OVERDRAWN' | 'BLOCKED'> = ['DELINQUENT', 'DELINQUENT', 'OVERDRAWN', 'OK', 'OK', 'OK', 'OK', 'OK', 'OK', 'OK', 'OK', 'OK', 'OK', 'OK', 'OK'];
  const utilPcts = [23.3, 25.8, 28.0, 5.3, 2.6, 0, 0, 7.0, 0, 0, 0, 0, 0, 0, 0];

  const creditHealth = CLIENTES_TOP.map((c, i) => ({
    cliente_id: rid(2000 + i),
    rut: c.rut,
    razon_social: c.nombre,
    credit_limit: limits[i],
    total_debt: debts[i],
    overdue_debt: overdues[i],
    available_credit: limits[i] - debts[i],
    credit_status: statuses[i],
    facturas_pendientes: debts[i] > 0 ? (i < 3 ? 3 : 1) : 0,
    facturas_vencidas: overdues[i] > 0 ? (i === 0 ? 2 : 1) : 0,
    dias_mora_promedio: overdues[i] > 0 ? (i === 0 ? 42 : 28) : 0,
    credit_utilization_pct: utilPcts[i],
    payment_terms_days: 30,
    is_credit_blocked: false,
    nombre_fantasia: null, email: null, telefono: null,
  }));

  const aging = creditHealth.filter(c => c.total_debt > 0).map(c => ({
    rut: c.rut,
    razon_social: c.razon_social,
    por_vencer: Math.round(c.total_debt * 0.40),
    vencido_1_30: Math.round(c.total_debt * 0.25),
    vencido_31_60: Math.round(c.total_debt * 0.20),
    vencido_61_90: Math.round(c.total_debt * 0.10),
    vencido_90_plus: Math.round(c.total_debt * 0.05),
    total_pendiente: c.total_debt,
    num_documentos: c.facturas_pendientes,
  }));

  return { creditHealth, aging };
}

// ---------------------------------------------------------------------------
// 12. FINANCE - Invoices
// ---------------------------------------------------------------------------
export function getDemoFacturas() {
  const amounts = [1850000, 920000, 1420000, 680000, 2100000, 750000, 1680000, 540000, 1950000, 1120000,
    890000, 1560000, 420000, 2300000, 780000, 1340000, 960000, 1700000, 610000, 1480000,
    830000, 1250000, 1080000, 570000, 1900000, 440000, 1620000, 700000, 1380000, 1200000,
    1540000, 860000, 1100000, 650000, 2050000, 510000, 1760000, 990000, 1430000, 720000,
    1850000, 1020000, 1370000, 640000, 1910000, 480000, 1590000, 850000, 1310000, 1150000];

  return amounts.map((total, i) => {
    const estado = i < 30 ? 'PAID' : i < 38 ? 'PENDING' : i < 44 ? 'PARTIAL' : 'OVERDUE';
    const outstanding = estado === 'PAID' ? 0 : estado === 'PARTIAL' ? Math.round(total * 0.4) : total;
    return {
      factura_id: rid(3000 + i),
      bsale_folio: `${18000 + i}`,
      numero_documento: `${18000 + i}`,
      cliente_rut: CLIENTES_TOP[i % CLIENTES_TOP.length].rut,
      cliente_nombre: CLIENTES_TOP[i % CLIENTES_TOP.length].nombre,
      issue_date: fmt(daysAgo(Math.floor(i * 2))),
      due_date: fmt(daysAgo(Math.max(0, Math.floor(i * 2 - 30)))),
      total_amount: total,
      outstanding_balance: outstanding,
      financial_status: estado,
      tienda: 'BLUEFISHING',
      dias_desde_emision: Math.floor(i * 2),
      dias_mora: estado === 'OVERDUE' ? 15 + i * 3 : 0,
      total_pagado: total - outstanding,
      num_pagos_aplicados: estado === 'PAID' ? 1 : estado === 'PARTIAL' ? 1 : 0,
    };
  });
}

// ---------------------------------------------------------------------------
// 13. FINANCE - Payments
// ---------------------------------------------------------------------------
export function getDemoPagos() {
  const metodos = ['WIRE TRANSFER', 'ONLINE PAYMENT', 'CHECK', 'CASH', 'CREDIT CARD'];
  const bancos = ['Bank of Chile', 'Santander', 'BCI', 'Scotiabank', 'BBVA'];
  const amounts = [2850000, 1420000, 980000, 2100000, 560000, 1780000, 3200000, 890000, 1650000, 420000,
    2400000, 1100000, 750000, 1980000, 680000, 2600000, 1350000, 920000, 1800000, 510000,
    2200000, 1050000, 1480000, 640000, 1920000];

  return amounts.map((amt, i) => ({
    pago_id: rid(4000 + i),
    cliente_id: rid(2000 + (i % CLIENTES_TOP.length)),
    cliente_rut: CLIENTES_TOP[i % CLIENTES_TOP.length].rut,
    cliente_nombre: CLIENTES_TOP[i % CLIENTES_TOP.length].nombre,
    pagador_rut: null,
    pagador_nombre: null,
    payment_date: fmt(daysAgo(Math.floor(i * 1.5))),
    payment_method: metodos[i % metodos.length],
    reference_code: `TRF-${100000 + i * 7919}`,
    banco: bancos[i % bancos.length],
    amount_received: amt,
    unallocated_balance: i < 8 ? Math.round(amt * 0.3) : 0,
    monto_asignado: i < 8 ? Math.round(amt * 0.7) : amt,
    pct_asignado: i < 8 ? 70 : 100,
    num_facturas_pagadas: i < 8 ? 0 : 1 + (i % 3),
  }));
}

// ---------------------------------------------------------------------------
// 14. FINANCE - Reconciliation
// ---------------------------------------------------------------------------
export function getDemoConciliacion() {
  const clientes = CLIENTES_TOP.slice(0, 8).map((c, i) => ({
    cliente_id: rid(2000 + i),
    rut: c.rut,
    razon_social: c.nombre,
  }));

  const facAmounts = [
    [1200000, 850000, 1500000], [920000, 1340000], [780000, 1100000, 650000],
    [1450000, 890000], [1680000, 520000, 1150000], [740000, 1380000],
    [960000, 1720000], [1080000, 630000]
  ];

  const facturas = clientes.flatMap((c, ci) =>
    facAmounts[ci].map((amt, fi) => ({
      factura_id: rid(5000 + ci * 10 + fi),
      cliente_id: c.cliente_id,
      bsale_folio: `${18500 + ci * 10 + fi}`,
      numero_documento: `${18500 + ci * 10 + fi}`,
      issue_date: fmt(daysAgo(20 + fi * 10)),
      due_date: fmt(daysAgo(Math.max(0, fi * 10 - 10))),
      total_amount: amt,
      outstanding_balance: amt,
      financial_status: 'PENDING',
      dias_mora: fi * 8,
    }))
  );

  const pagoAmounts = [1800000, 1200000, 950000, 1600000, 700000, 1400000];
  const pagoMethods = ['WIRE TRANSFER', 'ONLINE PAYMENT', 'CHECK', 'WIRE TRANSFER', 'ONLINE PAYMENT', 'WIRE TRANSFER'];

  const pagos = clientes.slice(0, 6).map((c, i) => ({
    pago_id: rid(6000 + i),
    cliente_id: c.cliente_id,
    payment_date: fmt(daysAgo(i * 2)),
    payment_method: pagoMethods[i],
    reference_code: `TRF-${200000 + i * 13331}`,
    amount_received: pagoAmounts[i],
    unallocated_balance: pagoAmounts[i],
  }));

  return { clientes, facturas, pagos };
}

// ---------------------------------------------------------------------------
// 15. FINANCE - Customers (Credit Management)
// ---------------------------------------------------------------------------
export function getDemoClientesFinanzas() {
  return getDemoFinanzas().creditHealth;
}

// ---------------------------------------------------------------------------
// 16. ETL
// ---------------------------------------------------------------------------
export function getDemoETL() {
  const tipos = ['PRODUCTS', 'CUSTOMERS', 'SALES', 'STOCK', 'PAYMENTS', 'RETURNS'];
  const duraciones = [
    [null, 42.3, 38.7], [null, 28.1, 25.4], [null, 67.8, 61.2],
    [null, 35.6, 32.1], [null, 48.9, 44.3], [null, 22.4, 19.8]
  ];
  const procesos = [
    [1250, 2890, 2780], [320, 435, 430], [2800, 8161, 7950],
    [1800, 2682, 2650], [890, 1520, 1480], [120, 470, 460]
  ];

  const jobs = tipos.flatMap((tipo, ti) =>
    Array.from({ length: 3 }, (_, i) => ({
      job_id: rid(7000 + ti * 10 + i),
      tipo,
      estado: i === 0 && ti === 2 ? 'RUNNING' : 'SUCCESS',
      fecha_inicio: daysAgo(i).toISOString(),
      fecha_fin: i === 0 && ti === 2 ? null : new Date(daysAgo(i).getTime() + (duraciones[ti][i] || 40) * 1000).toISOString(),
      duracion_segundos: duraciones[ti][i],
      registros_procesados: procesos[ti][i],
      registros_insertados: Math.round(procesos[ti][i] * 0.65),
      registros_actualizados: Math.round(procesos[ti][i] * 0.30),
      registros_errores: ti === 5 && i === 2 ? 2 : 0,
      parametros: { tipo: tipo.toLowerCase() },
      mensaje: i === 0 && ti === 2 ? 'Syncing sales...' : `Completed in ${duraciones[ti][i]}s`,
      error_detalle: null,
    }))
  ).sort((a, b) => new Date(b.fecha_inicio).getTime() - new Date(a.fecha_inicio).getTime());

  const health = [
    { entidad: 'fact_ventas', fecha_min: fmt(daysAgo(700)), fecha_max: fmt(daysAgo(0)), registros: 8161, dias_antiguedad: 0, status: 'OK' },
    { entidad: 'dim_productos', fecha_min: fmt(daysAgo(700)), fecha_max: fmt(daysAgo(0)), registros: 2892, dias_antiguedad: 0, status: 'OK' },
    { entidad: 'dim_clientes', fecha_min: fmt(daysAgo(700)), fecha_max: fmt(daysAgo(0)), registros: 435, dias_antiguedad: 0, status: 'OK' },
    { entidad: 'fact_stock', fecha_min: fmt(daysAgo(1)), fecha_max: fmt(daysAgo(0)), registros: 2682, dias_antiguedad: 0, status: 'OK' },
    { entidad: 'fact_pagos', fecha_min: fmt(daysAgo(700)), fecha_max: fmt(daysAgo(0)), registros: 16571, dias_antiguedad: 0, status: 'OK' },
    { entidad: 'fact_devoluciones', fecha_min: fmt(daysAgo(400)), fecha_max: fmt(daysAgo(2)), registros: 470, dias_antiguedad: 2, status: 'WARNING' },
    { entidad: 'fact_cobranza', fecha_min: fmt(daysAgo(365)), fecha_max: fmt(daysAgo(0)), registros: 342, dias_antiguedad: 0, status: 'OK' },
  ];

  return { jobs, health };
}

// ---------------------------------------------------------------------------
// 17. BI AGENT
// ---------------------------------------------------------------------------
export function getDemoAgente(query: string) {
  const q = query.toLowerCase();
  if (q.includes('sale') || q.includes('sold') || q.includes('revenue')) {
    return { type: 'ventas' as const, data: { total: 54200000 }, summary: 'Bluefishing sales over the last 30 days are **$54.2M**. Average ticket is $111,300 across 487 transactions. Top category is Fishing Rods ($9.8M), followed by Reels ($8.1M). An upward trend of +8.5% vs previous month is observed.' };
  }
  if (q.includes('stock') || q.includes('inventory')) {
    return { type: 'stock' as const, data: { productos: 892, criticos: 23 }, summary: '**892 products** in stock from a catalog of 2,892. 23 products in critical state (<5 units). Most urgent: Pelican Kayak (3 units), Simms Wader (5 units), Orvis Clearwater Rod (6 units). Total inventory value: **$412M** at retail price.' };
  }
  if (q.includes('customer') || q.includes('client') || q.includes('who buys')) {
    return { type: 'general' as const, data: { clientes: 142 }, summary: '**142 active customers**. Top 3: Patagonia Distributors ($48.5M, 186 orders), Robalos Fishing Club ($22.3M, 94 orders), Outdoor Adventure SpA ($18.7M, 67 orders). 28 "Champions" customers represent **67% of revenue**.' };
  }
  if (q.includes('collect') || q.includes('debt') || q.includes('overdue') || q.includes('receivable')) {
    return { type: 'cobranza' as const, data: { pendiente: 18700000 }, summary: 'Total outstanding debt: **$18.7M**. Of that, $3.9M is overdue by more than 30 days (5 invoices). Main delinquents are Patagonia Distributors ($2.1M) and Robalos Fishing Club ($1.8M). Recovery rate: **79.1%**.' };
  }
  if (q.includes('predict') || q.includes('forecast')) {
    return { type: 'prediccion' as const, data: { proyectado: 58400000 }, summary: 'The model predicts sales of **$58.4M** for the next 30 days (range: $49.6M - $67.2M, confidence 78%). Growth trend driven by fishing season. Fishing Rods and Lines show highest growth projection (+14% and +13%).' };
  }
  if (q.includes('curanipe') || q.includes('branch')) {
    return { type: 'general' as const, data: {}, summary: '**Curanipe** branch (Maule coast): Dedicated fishing gear stock, not part of web pool. Currently 1,850 units in warehouse. 12 SKUs below suggested minimum. Prediction indicates restocking needed in ~10 days. Local sales represent 5.3% of total.' };
  }
  if (q.includes('seller') || q.includes('team') || q.includes('performance') || q.includes('rep')) {
    return { type: 'general' as const, data: {}, summary: 'The sales team has **3 reps**. Catalina Rivas leads with $26M (48%), followed by Felipe Contreras $18M (33%) and Joaquín Mardones $10.2M (19%). Team average target: **83.4%**. Catalina is seller of the month at 90% attainment.' };
  }
  return { type: 'general' as const, data: {}, summary: `**Bluefishing.cl** is a fishing gear e-commerce with a central warehouse in Santiago and a physical branch in Curanipe. Monthly revenue ~$54M, 2,892 products in catalog, 142 active customers. What area do you need information on? I can help with sales, stock, customers, collections, forecasts, or the Curanipe branch.` };
}

// ---------------------------------------------------------------------------
// 18. SALES REPS
// ---------------------------------------------------------------------------
export function getDemoVendedores() {
  const vendedores = [
    {
      id: 1,
      nombre: 'Catalina Rivas',
      iniciales: 'CR',
      color: 'from-indigo-500 to-purple-600',
      ubicacion: 'Headquarters, Santiago',
      ventas_total: 26000000,
      unidades: 1420,
      transacciones: 235,
      ticket_promedio: 110638,
      clientes_nuevos: 18,
      clientes_recurrentes: 42,
      meta_mensual: 29000000,
      meta_pct: 89.7,
      ranking: 1,
    },
    {
      id: 2,
      nombre: 'Felipe Contreras',
      iniciales: 'FC',
      color: 'from-sky-500 to-cyan-600',
      ubicacion: 'Online Store + Marketplace',
      ventas_total: 18000000,
      unidades: 980,
      transacciones: 152,
      ticket_promedio: 118421,
      clientes_nuevos: 35,
      clientes_recurrentes: 28,
      meta_mensual: 22000000,
      meta_pct: 81.8,
      ranking: 2,
    },
    {
      id: 3,
      nombre: 'Joaquín Mardones',
      iniciales: 'JM',
      color: 'from-emerald-500 to-teal-600',
      ubicacion: 'Curanipe Branch',
      ventas_total: 10200000,
      unidades: 620,
      transacciones: 100,
      ticket_promedio: 102000,
      clientes_nuevos: 8,
      clientes_recurrentes: 22,
      meta_mensual: 13500000,
      meta_pct: 75.6,
      ranking: 3,
    },
  ];

  const baseCatalina = [920000, 980000, 1050000, 880000, 1100000, 1150000, 720000,
    940000, 1000000, 1080000, 900000, 1120000, 1180000, 750000,
    960000, 1020000, 1100000, 920000, 1140000, 1200000, 770000,
    980000, 1040000, 1120000, 940000, 1160000, 1220000, 790000, 1000000, 1060000];
  const baseFelipe = [620000, 660000, 710000, 590000, 740000, 780000, 480000,
    640000, 680000, 730000, 610000, 760000, 800000, 500000,
    650000, 690000, 740000, 620000, 770000, 810000, 510000,
    660000, 700000, 750000, 630000, 780000, 820000, 520000, 670000, 710000];
  const baseJoaquin = [350000, 370000, 400000, 330000, 420000, 440000, 270000,
    360000, 380000, 410000, 340000, 430000, 450000, 280000,
    370000, 390000, 420000, 350000, 440000, 460000, 290000,
    380000, 400000, 430000, 360000, 450000, 470000, 300000, 390000, 410000];

  const tendencia = Array.from({ length: 30 }, (_, i) => ({
    fecha: fmt(daysAgo(29 - i)),
    catalina: baseCatalina[i],
    felipe: baseFelipe[i],
    joaquin: baseJoaquin[i],
    total: baseCatalina[i] + baseFelipe[i] + baseJoaquin[i],
  }));

  return { vendedores, tendencia };
}

// ---------------------------------------------------------------------------
// 19. WHOLESALE CRM (mirrors real Trello board structure)
// ---------------------------------------------------------------------------
export function getDemoWholesaleCRM() {
  type Zone = 'ZONA NORTE' | 'ZONA CENTRO' | 'ZONA SUR';
  type Discount = '10%' | '5%' | 'SPECIAL' | 'NONE';
  type Status = 'FREQUENT' | 'NEW' | 'NO_ANSWER' | 'CLOSED' | 'CREDIT';

  const clients = [
    { id: 1, nombre: 'Sarasqueta Outdoor', contacto: 'Lorena Fernández', telefono: '+56 9 4888 3124', email: 'armeriasarasqueta@gmail.com', ciudad: 'Concepción', rut: '78.879.030-9', zone: 'ZONA SUR' as Zone, discount: '10%' as Discount, tags: ['FREQUENT', 'CREDIT'] as Status[], transporte: 'Chevalier', condicion_pago: '30 days', credit_limit: 15000000, outstanding: 5800000, last_purchase_date: fmt(daysAgo(2)), last_purchase_amount: 3200000, last_call_date: fmt(daysAgo(1)), total_ytd: 52400000, orders_ytd: 24, avg_order: 2183000, notes: 'Largest account in Zona Sur. Carries full catalog. Pays at 30 days consistently.', priority: 'high' as const },
    { id: 2, nombre: 'NortFishing SpA', contacto: 'Angelo Vega', telefono: '+56 9 7563 8303', email: 'nortfishing@gmail.com', ciudad: 'Iquique', rut: '78.272.893-8', zone: 'ZONA NORTE' as Zone, discount: '10%' as Discount, tags: ['FREQUENT', 'NEW'] as Status[], transporte: 'Trina Travel', condicion_pago: 'On delivery', credit_limit: 8000000, outstanding: 2100000, last_purchase_date: fmt(daysAgo(5)), last_purchase_amount: 1850000, last_call_date: fmt(daysAgo(4)), total_ytd: 28900000, orders_ytd: 18, avg_order: 1606000, notes: 'New client, growing fast. Second store in Antofagasta. Interested in exclusive lures.', priority: 'high' as const },
    { id: 3, nombre: 'Terra Aventura', contacto: 'Diego Ramírez', telefono: '+56 9 5845 7430', email: 'diegoeduardoramirez1999@gmail.com', ciudad: 'Molina, Maule', rut: '78.223.139-1', zone: 'ZONA CENTRO' as Zone, discount: '10%' as Discount, tags: ['FREQUENT'] as Status[], transporte: 'Starken', condicion_pago: 'On delivery', credit_limit: 6000000, outstanding: 1200000, last_purchase_date: fmt(daysAgo(7)), last_purchase_amount: 980000, last_call_date: fmt(daysAgo(6)), total_ytd: 18200000, orders_ytd: 14, avg_order: 1300000, notes: 'Maule region. Ships via Starken Molina. Reorders every 2-3 weeks.', priority: 'medium' as const },
    { id: 4, nombre: 'Montaña Táctica SpA', contacto: 'Andrés Peña', telefono: '+56 9 7618 3250', email: 'montanatactica@gmail.com', ciudad: 'Temuco', rut: '77.296.353-K', zone: 'ZONA SUR' as Zone, discount: '10%' as Discount, tags: ['FREQUENT', 'CREDIT'] as Status[], transporte: 'Ecoex', condicion_pago: '15 days', credit_limit: 10000000, outstanding: 3400000, last_purchase_date: fmt(daysAgo(4)), last_purchase_amount: 2100000, last_call_date: fmt(daysAgo(3)), total_ytd: 35600000, orders_ytd: 20, avg_order: 1780000, notes: 'Two contacts: Andrés (976183250) and Pedro (944696221). Strong in Araucanía.', priority: 'high' as const },
    { id: 5, nombre: 'El Buen Lance SpA', contacto: 'Álvaro Coronado', telefono: '+56 9 7870 7218', email: 'elbuenlance@gmail.com', ciudad: 'Mulchén', rut: '78.288.816-1', zone: 'ZONA SUR' as Zone, discount: '5%' as Discount, tags: ['FREQUENT'] as Status[], transporte: 'Ecoex', condicion_pago: 'On delivery', credit_limit: 5000000, outstanding: 800000, last_purchase_date: fmt(daysAgo(10)), last_purchase_amount: 720000, last_call_date: fmt(daysAgo(8)), total_ytd: 12400000, orders_ytd: 11, avg_order: 1127000, notes: 'Ships to Temuco warehouse (V. Pérez Rosales 01620). Consistent monthly orders.', priority: 'medium' as const },
    { id: 6, nombre: 'Planeta Outdoor', contacto: 'Eduardo Anguita', telefono: '+56 9 8361 0365', email: 'planetaoutdoor@hotmail.com', ciudad: 'Temuco', rut: '15.260.181-6', zone: 'ZONA SUR' as Zone, discount: '10%' as Discount, tags: ['FREQUENT'] as Status[], transporte: 'Chevalier', condicion_pago: 'On delivery', credit_limit: 7000000, outstanding: 0, last_purchase_date: fmt(daysAgo(18)), last_purchase_amount: 650000, last_call_date: fmt(daysAgo(15)), total_ytd: 9800000, orders_ytd: 9, avg_order: 1089000, notes: 'No outstanding debt but going cold. Last 2 orders smaller than usual. Re-engage.', priority: 'medium' as const },
    { id: 7, nombre: 'Caza y Pesca Comalle SpA', contacto: 'José Luis Botello', telefono: '+56 9 6795 3740', email: 'cazaypescacomalle2304@gmail.com', ciudad: 'Teno, Curicó', rut: '78.038.195-7', zone: 'ZONA CENTRO' as Zone, discount: '5%' as Discount, tags: [] as Status[], transporte: 'Starken', condicion_pago: 'On delivery', credit_limit: 4000000, outstanding: 450000, last_purchase_date: fmt(daysAgo(14)), last_purchase_amount: 520000, last_call_date: fmt(daysAgo(12)), total_ytd: 7600000, orders_ytd: 8, avg_order: 950000, notes: 'Rural area. Ship to Starken Aguas Negras, Curicó. Second phone: +56945308720.', priority: 'low' as const },
    { id: 8, nombre: 'Aventura Sport', contacto: 'Juan Pablo Mellado', telefono: '+56 9 9676 0503', email: 'j.pablomellado82@gmail.com', ciudad: 'Cañete, Biobío', rut: '15.201.912-2', zone: 'ZONA SUR' as Zone, discount: '10%' as Discount, tags: ['FREQUENT'] as Status[], transporte: 'Chevalier', condicion_pago: 'On delivery', credit_limit: 5000000, outstanding: 1100000, last_purchase_date: fmt(daysAgo(9)), last_purchase_amount: 880000, last_call_date: fmt(daysAgo(7)), total_ytd: 14200000, orders_ytd: 13, avg_order: 1092000, notes: 'Ferretería, caza y pesca. Good steady account. Zona BioBío.', priority: 'medium' as const },
    { id: 9, nombre: 'Black Shark SpA', contacto: 'Jorge Carrasco', telefono: '+56 9 4285 0384', email: 'blackshark@gmail.com', ciudad: 'Constitución', rut: '77.768.115-K', zone: 'ZONA CENTRO' as Zone, discount: 'NONE' as Discount, tags: ['NEW'] as Status[], transporte: 'Starken', condicion_pago: 'On delivery', credit_limit: 3000000, outstanding: 0, last_purchase_date: fmt(daysAgo(25)), last_purchase_amount: 380000, last_call_date: fmt(daysAgo(20)), total_ytd: 4200000, orders_ytd: 6, avg_order: 700000, notes: 'New client. No discount yet. Potential to grow if we build trust. Constitución coast.', priority: 'low' as const },
    { id: 10, nombre: 'NortFishing Antofagasta', contacto: 'Alexis Aracena', telefono: '+56 9 6500 7789', email: 'alexis.aracena23@gmail.com', ciudad: 'Antofagasta', rut: '78.118.722-4', zone: 'ZONA NORTE' as Zone, discount: '10%' as Discount, tags: ['FREQUENT'] as Status[], transporte: 'Varmontt', condicion_pago: '0 days + 10%', credit_limit: 6000000, outstanding: 1600000, last_purchase_date: fmt(daysAgo(6)), last_purchase_amount: 1200000, last_call_date: fmt(daysAgo(5)), total_ytd: 22100000, orders_ytd: 15, avg_order: 1473000, notes: 'Sister store of NortFishing Iquique. Strong northern market. Ships via Varmontt.', priority: 'high' as const },
    { id: 11, nombre: 'Los Cuervos SpA', contacto: 'Rosana Roa', telefono: '+56 9 9530 9980', email: 'loscuervos@gmail.com', ciudad: 'Pitrufquén', rut: '77.868.141-2', zone: 'ZONA SUR' as Zone, discount: 'NONE' as Discount, tags: [] as Status[], transporte: 'Chevalier', condicion_pago: 'On delivery', credit_limit: 3000000, outstanding: 0, last_purchase_date: fmt(daysAgo(32)), last_purchase_amount: 290000, last_call_date: fmt(daysAgo(28)), total_ytd: 3100000, orders_ytd: 5, avg_order: 620000, notes: 'Tienda de pesca y caza. Going cold — hasn\'t ordered in a month. Needs re-engagement.', priority: 'low' as const },
    { id: 12, nombre: 'Carmen Tienda Huasco', contacto: 'Carmen Olga González', telefono: '+56 9 5764 2011', email: 'carmentienda@gmail.com', ciudad: 'Huasco', rut: '13.745.531-0K', zone: 'ZONA NORTE' as Zone, discount: 'NONE' as Discount, tags: [] as Status[], transporte: 'Varmontt', condicion_pago: 'On delivery', credit_limit: 2000000, outstanding: 0, last_purchase_date: fmt(daysAgo(40)), last_purchase_amount: 210000, last_call_date: fmt(daysAgo(35)), total_ytd: 1800000, orders_ytd: 4, avg_order: 450000, notes: 'Small coastal town. Receives via Pedro Pilcante. Payment always on time.', priority: 'low' as const },
  ];

  const pipeline = {
    new_order: [
      { id: 'p1', client_id: 4, client_name: 'Montaña Táctica SpA', date: fmt(daysAgo(0)), items: 'UL Rods x12, Jigs assorted x50, Multifilament 30lb x20', total: 2100000, vendedor: 'Yeison' },
      { id: 'p2', client_id: 2, client_name: 'NortFishing SpA', date: fmt(daysAgo(1)), items: 'Señuelos Rapala x80, Cañas Shimano 7ft x6', total: 1850000, vendedor: 'Yeison' },
    ],
    preparing: [
      { id: 'p3', client_id: 1, client_name: 'Sarasqueta Outdoor', date: fmt(daysAgo(2)), items: 'Full restock: lures, rods, lines, reels', total: 3200000, vendedor: 'Yeison' },
      { id: 'p4', client_id: 8, client_name: 'Aventura Sport', date: fmt(daysAgo(2)), items: 'Lines x30, Reels Daiwa BG x4', total: 880000, vendedor: 'Yeison' },
    ],
    ready_to_ship: [
      { id: 'p5', client_id: 10, client_name: 'NortFishing Antofagasta', date: fmt(daysAgo(3)), items: 'Señuelos variados x60, Accesorios kayak', total: 1200000, vendedor: 'Yeison' },
    ],
    in_transit: [
      { id: 'p6', client_id: 3, client_name: 'Terra Aventura', date: fmt(daysAgo(4)), items: 'Cañas UL x8, Jigs x40', total: 980000, vendedor: 'Yeison' },
      { id: 'p7', client_id: 5, client_name: 'El Buen Lance SpA', date: fmt(daysAgo(5)), items: 'Multifilament x15, Señuelos x30', total: 720000, vendedor: 'Yeison' },
    ],
    delivered: [
      { id: 'p8', client_id: 7, client_name: 'Caza y Pesca Comalle SpA', date: fmt(daysAgo(7)), items: 'Lines + accessories', total: 520000, vendedor: 'Yeison' },
      { id: 'p9', client_id: 6, client_name: 'Planeta Outdoor', date: fmt(daysAgo(10)), items: 'Reels + rods restock', total: 650000, vendedor: 'Yeison' },
      { id: 'p10', client_id: 1, client_name: 'Sarasqueta Outdoor', date: fmt(daysAgo(12)), items: 'Bulk order lures + lines', total: 2800000, vendedor: 'Yeison' },
    ],
    complaint: [
      { id: 'p11', client_id: 9, client_name: 'Black Shark SpA', date: fmt(daysAgo(15)), items: 'Reel Daiwa BG — defective drag system', total: 129990, vendedor: 'Yeison', issue: 'Defective drag. Replacement sent.' },
    ],
  };

  const callLog = [
    { id: 1, client_id: 1, client_name: 'Sarasqueta Outdoor', date: fmt(daysAgo(1)), time: '10:30', duration: '8 min', outcome: 'ORDER', notes: 'Full restock order. Ships via Chevalier tomorrow.', amount: 3200000 },
    { id: 2, client_id: 4, client_name: 'Montaña Táctica SpA', date: fmt(daysAgo(0)), time: '09:15', duration: '12 min', outcome: 'ORDER', notes: 'UL rods + jigs for Araucanía season. Andrés confirmed.', amount: 2100000 },
    { id: 3, client_id: 2, client_name: 'NortFishing SpA', date: fmt(daysAgo(1)), time: '11:45', duration: '10 min', outcome: 'ORDER', notes: 'Angelo needs Rapala lures urgently for weekend sales.', amount: 1850000 },
    { id: 4, client_id: 10, client_name: 'NortFishing Antofagasta', date: fmt(daysAgo(5)), time: '14:00', duration: '7 min', outcome: 'QUOTE', notes: 'Requested quote for kayak fishing accessories. Sending price list.', amount: null },
    { id: 5, client_id: 6, client_name: 'Planeta Outdoor', date: fmt(daysAgo(15)), time: '10:00', duration: '5 min', outcome: 'FOLLOW_UP', notes: 'Eduardo says business is slow. Offered new summer catalog.', amount: null },
    { id: 6, client_id: 5, client_name: 'El Buen Lance SpA', date: fmt(daysAgo(8)), time: '16:30', duration: '6 min', outcome: 'ORDER', notes: 'Monthly restock. Multifilament + señuelos.', amount: 720000 },
    { id: 7, client_id: 11, client_name: 'Los Cuervos SpA', date: fmt(daysAgo(28)), time: '11:00', duration: '3 min', outcome: 'NO_ANSWER', notes: 'No answer. Third attempt this month. Possible churn.', amount: null },
    { id: 8, client_id: 12, client_name: 'Carmen Tienda Huasco', date: fmt(daysAgo(35)), time: '09:30', duration: '4 min', outcome: 'NO_ANSWER', notes: 'No answer. Very remote. Try again next week.', amount: null },
    { id: 9, client_id: 3, client_name: 'Terra Aventura', date: fmt(daysAgo(6)), time: '15:20', duration: '9 min', outcome: 'ORDER', notes: 'Cañas UL restock + new jig colors. Ships to Starken Molina.', amount: 980000 },
    { id: 10, client_id: 7, client_name: 'Caza y Pesca Comalle SpA', date: fmt(daysAgo(12)), time: '10:45', duration: '6 min', outcome: 'ORDER', notes: 'Small order lines + accessories. Starken Curicó.', amount: 520000 },
    { id: 11, client_id: 8, client_name: 'Aventura Sport', date: fmt(daysAgo(7)), time: '14:30', duration: '8 min', outcome: 'ORDER', notes: 'Lines and reels for Cañete store. Good steady account.', amount: 880000 },
    { id: 12, client_id: 9, client_name: 'Black Shark SpA', date: fmt(daysAgo(20)), time: '11:15', duration: '5 min', outcome: 'FOLLOW_UP', notes: 'Jorge asked about upcoming promotions. Still building trust.', amount: null },
  ];

  const zoneSummary = [
    { zone: 'ZONA SUR', clients: clients.filter(c => c.zone === 'ZONA SUR').length, revenue: clients.filter(c => c.zone === 'ZONA SUR').reduce((s, c) => s + c.total_ytd, 0), outstanding: clients.filter(c => c.zone === 'ZONA SUR').reduce((s, c) => s + c.outstanding, 0) },
    { zone: 'ZONA CENTRO', clients: clients.filter(c => c.zone === 'ZONA CENTRO').length, revenue: clients.filter(c => c.zone === 'ZONA CENTRO').reduce((s, c) => s + c.total_ytd, 0), outstanding: clients.filter(c => c.zone === 'ZONA CENTRO').reduce((s, c) => s + c.outstanding, 0) },
    { zone: 'ZONA NORTE', clients: clients.filter(c => c.zone === 'ZONA NORTE').length, revenue: clients.filter(c => c.zone === 'ZONA NORTE').reduce((s, c) => s + c.total_ytd, 0), outstanding: clients.filter(c => c.zone === 'ZONA NORTE').reduce((s, c) => s + c.outstanding, 0) },
  ];

  const clientFiles: Record<number, { name: string; type: string; size: string; date: string }[]> = {
    1: [
      { name: 'Price List Sarasqueta Q1 2026.pdf', type: 'pdf', size: '245 KB', date: fmt(daysAgo(15)) },
      { name: 'Invoice #18720.pdf', type: 'pdf', size: '128 KB', date: fmt(daysAgo(2)) },
      { name: 'Signed Contract 2026.pdf', type: 'pdf', size: '1.2 MB', date: fmt(daysAgo(45)) },
    ],
    2: [
      { name: 'Price List NortFishing.pdf', type: 'pdf', size: '210 KB', date: fmt(daysAgo(20)) },
      { name: 'Store Photos Iquique.jpg', type: 'image', size: '3.4 MB', date: fmt(daysAgo(30)) },
    ],
    3: [
      { name: 'Price List Terra Aventura.pdf', type: 'pdf', size: '198 KB', date: fmt(daysAgo(18)) },
      { name: 'Invoice #18695.pdf', type: 'pdf', size: '115 KB', date: fmt(daysAgo(7)) },
    ],
    4: [
      { name: 'Credit Agreement Montaña Táctica.pdf', type: 'pdf', size: '890 KB', date: fmt(daysAgo(60)) },
      { name: 'Price List Q1 2026.pdf', type: 'pdf', size: '220 KB', date: fmt(daysAgo(12)) },
      { name: 'Invoice #18710.pdf', type: 'pdf', size: '132 KB', date: fmt(daysAgo(4)) },
      { name: 'Return Form #R-0042.pdf', type: 'pdf', size: '78 KB', date: fmt(daysAgo(25)) },
    ],
    5: [
      { name: 'Price List El Buen Lance.pdf', type: 'pdf', size: '195 KB', date: fmt(daysAgo(22)) },
    ],
    6: [
      { name: 'Price List Planeta Outdoor.pdf', type: 'pdf', size: '205 KB', date: fmt(daysAgo(30)) },
      { name: 'Promo Summer 2026.jpg', type: 'image', size: '2.1 MB', date: fmt(daysAgo(40)) },
    ],
    7: [
      { name: 'Price List Comalle.pdf', type: 'pdf', size: '180 KB', date: fmt(daysAgo(25)) },
    ],
    8: [
      { name: 'Price List Aventura Sport.pdf', type: 'pdf', size: '190 KB', date: fmt(daysAgo(20)) },
      { name: 'Invoice #18688.pdf', type: 'pdf', size: '120 KB', date: fmt(daysAgo(9)) },
    ],
    9: [{ name: 'Price List Black Shark.pdf', type: 'pdf', size: '175 KB', date: fmt(daysAgo(28)) }],
    10: [
      { name: 'Price List NortFishing Antof.pdf', type: 'pdf', size: '210 KB', date: fmt(daysAgo(15)) },
      { name: 'Invoice #18702.pdf', type: 'pdf', size: '125 KB', date: fmt(daysAgo(6)) },
    ],
    11: [{ name: 'Price List Los Cuervos.pdf', type: 'pdf', size: '160 KB', date: fmt(daysAgo(35)) }],
    12: [{ name: 'Price List Carmen Huasco.pdf', type: 'pdf', size: '155 KB', date: fmt(daysAgo(42)) }],
  };

  const calendar = [
    { id: 'cal1', client_id: 1, client_name: 'Sarasqueta Outdoor', date: fmt(daysAgo(-1)), time: '10:00', type: 'call' as const, note: 'Follow up on restock order. Confirm Chevalier dispatch.' },
    { id: 'cal2', client_id: 4, client_name: 'Montaña Táctica SpA', date: fmt(daysAgo(-1)), time: '11:30', type: 'call' as const, note: 'Check payment for invoice #18710. Credit at 72%.' },
    { id: 'cal3', client_id: 2, client_name: 'NortFishing SpA', date: fmt(daysAgo(-2)), time: '09:00', type: 'call' as const, note: 'Present new summer lure catalog. Upsell opportunity.' },
    { id: 'cal4', client_id: 6, client_name: 'Planeta Outdoor', date: fmt(daysAgo(-2)), time: '14:00', type: 'visit' as const, note: 'Re-engagement visit. Bring new product samples.' },
    { id: 'cal5', client_id: 10, client_name: 'NortFishing Antofagasta', date: fmt(daysAgo(-3)), time: '10:00', type: 'call' as const, note: 'Quote follow-up for kayak accessories.' },
    { id: 'cal6', client_id: 11, client_name: 'Los Cuervos SpA', date: fmt(daysAgo(-4)), time: '11:00', type: 'call' as const, note: 'Hasn\'t ordered in a month. Offer seasonal promo.' },
    { id: 'cal7', client_id: 5, client_name: 'El Buen Lance SpA', date: fmt(daysAgo(-5)), time: '15:00', type: 'call' as const, note: 'Monthly restock check. Confirm delivery address Temuco.' },
    { id: 'cal8', client_id: 3, client_name: 'Terra Aventura', date: fmt(daysAgo(-6)), time: '09:30', type: 'call' as const, note: 'New jig colors arrived. Send photos via WhatsApp.' },
    { id: 'cal9', client_id: 8, client_name: 'Aventura Sport', date: fmt(daysAgo(-7)), time: '14:30', type: 'visit' as const, note: 'Quarterly review. Discuss volume increase for next season.' },
    { id: 'cal10', client_id: 12, client_name: 'Carmen Tienda Huasco', date: fmt(daysAgo(-8)), time: '10:00', type: 'call' as const, note: 'Remote client. Check if needs summer restock.' },
    { id: 'cal11', client_id: 7, client_name: 'Caza y Pesca Comalle SpA', date: fmt(daysAgo(0)), time: '10:00', type: 'call' as const, note: 'TODAY: Confirm Starken delivery arrived. Collect feedback.' },
    { id: 'cal12', client_id: 9, client_name: 'Black Shark SpA', date: fmt(daysAgo(0)), time: '15:00', type: 'call' as const, note: 'TODAY: Complaint follow-up. Replacement reel shipped?' },
  ];

  return { clients, pipeline, callLog, zoneSummary, clientFiles, calendar };
}
