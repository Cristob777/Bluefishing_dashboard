// ============================================================================
// MI SPA BI SYSTEM - ETL Bsale Edge Function
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from '../_shared/logger.ts';
import { createBsaleClient } from '../_shared/bsale-client.ts';
import { transformVariant, transformClient, transformDocDetail, deduplicateVentas, extractClientId, extractNestedId } from '../_shared/transform.ts';
import { fechaHoy } from '../_shared/validator.ts';
import { BsaleVariant, BsaleClient, BsaleDocument, BsaleStock, ETLResponse } from '../_shared/types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function syncProductos(supabase: ReturnType<typeof createClient>, logger: ReturnType<typeof createLogger>) {
  const bsale = createBsaleClient(logger);
  await logger.info('EXTRACT', 'Extrayendo variantes');
  
  const variants = await bsale.getVariants({ state: '0' }) as BsaleVariant[];
  logger.incrementProcessed(variants.length);
  
  const productos = variants.map(v => {
    try { return transformVariant(v); } 
    catch { logger.incrementErrors(); return null; }
  }).filter(Boolean);
  
  for (let i = 0; i < productos.length; i += 100) {
    const batch = productos.slice(i, i + 100);
    const { error } = await supabase.from('dim_productos').upsert(
      batch.map(p => ({ ...p, updated_at: new Date().toISOString() })),
      { onConflict: 'bsale_variant_id' }
    );
    if (error) logger.incrementErrors(batch.length);
    else logger.incrementInserted(batch.length);
  }
  
  // Vincular categorías para productos recién sincronizados
  try {
    const { data: linked } = await supabase.rpc('vincular_categorias_productos');
    await logger.info('POST', `Categorías vinculadas: ${linked ?? 0} productos actualizados`);
  } catch (e) {
    await logger.warn('POST', `Error vinculando categorías: ${e}`);
  }
}

async function syncClientes(supabase: ReturnType<typeof createClient>, logger: ReturnType<typeof createLogger>) {
  const bsale = createBsaleClient(logger);
  await logger.info('EXTRACT', 'Extrayendo clientes');
  
  const clients = await bsale.getClients({ state: '0' }) as BsaleClient[];
  logger.incrementProcessed(clients.length);
  
  const clientes = clients.map(c => {
    try { return transformClient(c); }
    catch { logger.incrementErrors(); return null; }
  }).filter(Boolean);
  
  for (let i = 0; i < clientes.length; i += 100) {
    const batch = clientes.slice(i, i + 100);
    const { error } = await supabase.from('dim_clientes').upsert(
      batch.map(c => ({ ...c, updated_at: new Date().toISOString() })),
      { onConflict: 'bsale_client_id' }
    );
    if (error) logger.incrementErrors(batch.length);
    else logger.incrementInserted(batch.length);
  }
}

async function syncVentas(supabase: ReturnType<typeof createClient>, logger: ReturnType<typeof createLogger>, fechaDesde?: string, maxDocs = 50) {
  const bsale = createBsaleClient(logger);
  // Convertir fecha a Unix timestamp para Bsale
  const desdeDate = fechaDesde ? new Date(fechaDesde) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default 7 días
  const hastaDate = new Date();
  const desdeUnix = Math.floor(desdeDate.getTime() / 1000);
  const hastaUnix = Math.floor(hastaDate.getTime() / 1000);
  await logger.info('EXTRACT', `Extrayendo ventas desde ${desdeDate.toISOString().split('T')[0]} (max ${maxDocs} docs)`);
  
  // Paginar documentos (maxPages = maxDocs/25, max 4 pages para no exceder timeout)
  const maxPages = Math.min(Math.ceil(maxDocs / 25), 4);
  const allDocs = await bsale.getDocuments({ state: '0', emissiondaterange: `[${desdeUnix},${hastaUnix}]` }, maxPages) as BsaleDocument[];
  const documents = allDocs.slice(0, maxDocs);
  await logger.info('EXTRACT', `${documents.length} documentos a procesar`);
  
  // Mapeos
  const { data: prodMap } = await supabase.from('dim_productos').select('producto_id, bsale_variant_id, tienda').not('bsale_variant_id', 'is', null);
  const variantToProd = new Map((prodMap || []).map(p => [p.bsale_variant_id, p.producto_id]));
  const variantToTienda = new Map((prodMap || []).map(p => [p.bsale_variant_id, p.tienda]));
  
  const { data: cliMap } = await supabase.from('dim_clientes').select('cliente_id, bsale_client_id');
  const bsaleToCli = new Map((cliMap || []).map(c => [c.bsale_client_id, c.cliente_id]));
  const clienteGenerico = bsaleToCli.get(0) || 1;
  
  // Mapeo de bodegas para asignar bodega_id a cada venta
  const { data: bodMap } = await supabase.from('dim_bodegas').select('bodega_id, bsale_office_id');
  const officeToBod = new Map((bodMap || []).map(b => [b.bsale_office_id, b.bodega_id]));
  const defaultBodegaId = bodMap?.find(b => b.bsale_office_id)?.bodega_id || 1;
  
  const ventas: ReturnType<typeof transformDocDetail>[] = [];
  let docCount = 0;
  
  for (const doc of documents) {
    try {
      docCount++;
      if (docCount % 10 === 0) await logger.info('EXTRACT', `Procesando doc ${docCount}/${documents.length}`);
      logger.incrementProcessed();
      const { items } = await bsale.getDocumentDetails(doc.id);
      
      // Extraer office_id del documento para bodega_id
      const docOfficeId = extractNestedId(doc, 'office.id') ?? (doc as any).office?.id;
      const docBodegaId = docOfficeId ? (officeToBod.get(docOfficeId) || defaultBodegaId) : defaultBodegaId;
      
      for (const detail of (items || [])) {
        const variantId = extractNestedId(detail, 'variant.id') ?? extractNestedId(detail, 'variant_id');
        const tienda = variantId ? (variantToTienda.get(variantId) || 'BLUEFISHING') : 'BLUEFISHING';
        const venta = transformDocDetail(doc, detail as any, tienda as any);
        if (venta.bsale_variant_id) venta.producto_id = variantToProd.get(venta.bsale_variant_id) || null;
        const bsaleCliId = extractClientId(doc);
        venta.cliente_id = bsaleToCli.get(bsaleCliId || 0) || clienteGenerico;
        venta.bodega_id = docBodegaId;
        ventas.push(venta);
      }
    } catch (e) { 
      await logger.warn('EXTRACT', `Error doc ${doc.id}: ${e}`);
      logger.incrementErrors(); 
    }
    await new Promise(r => setTimeout(r, 50));
  }
  
  const unique = deduplicateVentas(ventas);
  await logger.info('TRANSFORM', `${ventas.length} -> ${unique.length} (dedup)`);
  
  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    const { error } = await supabase.from('fact_ventas').upsert(batch, { onConflict: 'bsale_document_id,bsale_detail_id' });
    if (error) {
      await logger.warn('LOAD', `Error batch ${i}: ${error.message}`);
      logger.incrementErrors(batch.length);
    }
    else logger.incrementInserted(batch.length);
  }
}

async function syncCobranza(supabase: ReturnType<typeof createClient>, logger: ReturnType<typeof createLogger>, maxDocs = 200) {
  try {
    const bsale = createBsaleClient(logger);
    await logger.info('EXTRACT', `Extrayendo documentos para cobranza`);
    
    // Obtener documentos para cobranza (max 4 páginas)
    const maxPages = Math.min(Math.ceil(maxDocs / 25), 4);
    const documents = await bsale.getDocuments({ 
      state: '0'
    }, maxPages) as any[];
    
    await logger.info('EXTRACT', `${documents.length} documentos obtenidos`);
    // Log primer documento para debug
    if (documents.length > 0) {
      const d = documents[0];
      await logger.info('DEBUG', `Doc muestra: total=${d.total}, totalAmount=${d.totalAmount}, balance=${d.balance}`);
    }
    logger.incrementProcessed(documents.length);
    
    const { data: cliMap } = await supabase.from('dim_clientes').select('cliente_id, bsale_client_id');
    const bsaleToCli = new Map((cliMap || []).map((c: any) => [c.bsale_client_id, c.cliente_id]));
    
    const cobranzas: any[] = [];
    
    for (const doc of documents) {
      // totalAmount puede venir como totalAmount o total
      const totalAmount = doc.totalAmount || doc.total || 0;
      if (totalAmount <= 0) continue;
      
      const balance = doc.balance ?? doc.urlBalance ?? totalAmount;
      const clientId = doc.client?.id;
      const clienteId = bsaleToCli.get(clientId) || 1;
      const officeId = doc.office?.id;
      const tienda = (officeId === 2 || officeId === 4) ? 'EPICBIKE' : 'BLUEFISHING';
      
      const fechaEmision = doc.emissionDate ? new Date(doc.emissionDate * 1000).toISOString().split('T')[0] : fechaHoy();
      const fechaVencimiento = doc.expirationDate ? new Date(doc.expirationDate * 1000).toISOString().split('T')[0] : fechaEmision;
      
      let estado = 'PENDIENTE';
      if (balance <= 0) estado = 'PAGADO';
      else if (balance < totalAmount) estado = 'PARCIAL';
      else if (new Date(fechaVencimiento) < new Date()) estado = 'VENCIDO';
      
      cobranzas.push({
        documento_id: `BSALE-${doc.id}`,
        cliente_id: clienteId,
        tienda,
        tipo_documento: doc.documentType?.name || 'FACTURA',
        numero_documento: String(doc.number || doc.id),
        fecha_emision: fechaEmision,
        fecha_vencimiento: fechaVencimiento,
        monto_original: totalAmount,
        monto_pagado: Math.max(0, totalAmount - balance),
        estado
      });
    }
    
    await logger.info('TRANSFORM', `${cobranzas.length} cobranzas`);
    
    // Insertar fechas primero
    const fechas = [...new Set(cobranzas.flatMap(c => [c.fecha_emision, c.fecha_vencimiento]))];
    for (const f of fechas) {
      if (f) await supabase.from('dim_tiempo').upsert({ fecha: f }, { onConflict: 'fecha' }).catch(() => {});
    }
    
    // Insertar cobranzas
    for (let i = 0; i < cobranzas.length; i += 25) {
      const batch = cobranzas.slice(i, i + 25);
      const { error } = await supabase.from('fact_cobranza').upsert(batch, { onConflict: 'documento_id' });
      if (error) {
        await logger.warn('LOAD', `Error: ${error.message}`);
        logger.incrementErrors(batch.length);
      } else {
        logger.incrementInserted(batch.length);
      }
    }
  } catch (e) {
    await logger.warn('COBRANZA', `Error general: ${e}`);
  }
}

async function syncPagos(supabase: ReturnType<typeof createClient>, logger: ReturnType<typeof createLogger>, maxDocs = 100) {
  const bsale = createBsaleClient(logger);
  await logger.info('EXTRACT', `Extrayendo pagos (max ${maxDocs})`);
  
  const PT_MAP: Record<string, string> = {
    '1':'EFECTIVO','2':'TARJETA CREDITO','3':'NOTA CREDITO','4':'CREDITO','5':'CHEQUE',
    '6':'TARJETA DEBITO','7':'ABONO CLIENTE','8':'TRANSFERENCIA','10':'WEBPAY',
    '13':'CREDITO','14':'MERCADO PAGO','16':'POS BCI','17':'POS GETNET','18':'POS TBK'
  };

  try {
    const maxPages = Math.min(Math.ceil(maxDocs / 25), 8);
    const payments = await bsale.getPayments({ state: '0' }) as any[];
    const limited = payments.slice(0, maxDocs);
    await logger.info('EXTRACT', `${limited.length} pagos obtenidos`);
    logger.incrementProcessed(limited.length);
    
    const pagos: any[] = [];
    
    for (const pago of limited) {
      const fecha = pago.recordDate ? new Date(pago.recordDate * 1000).toISOString().split('T')[0] : fechaHoy();
      const monto = pago.amount || 0;
      if (monto <= 0) continue;
      
      const ptId = String(pago.payment_type?.id || '');
      const metodo = PT_MAP[ptId] || 'OTRO';
      
      pagos.push({
        bsale_payment_id: pago.id,
        bsale_document_id: pago.documentId || pago.document?.id,
        fecha,
        tienda: 'BLUEFISHING',
        metodo_pago: metodo,
        monto,
        referencia: pago.operationNumber || null,
        estado: 'APLICADO'
      });
    }
    
    await logger.info('TRANSFORM', `${pagos.length} pagos válidos`);
    
    for (let i = 0; i < pagos.length; i += 50) {
      const batch = pagos.slice(i, i + 50);
      const { error } = await supabase.from('fact_pagos').upsert(batch, { onConflict: 'bsale_payment_id' });
      if (error) {
        await logger.warn('LOAD', `Error pagos: ${error.message}`);
        logger.incrementErrors(batch.length);
      } else {
        logger.incrementInserted(batch.length);
      }
    }
  } catch (e) {
    await logger.warn('PAGOS', `Error: ${e}`);
  }
}

async function syncDevoluciones(supabase: ReturnType<typeof createClient>, logger: ReturnType<typeof createLogger>, maxDocs = 100) {
  const bsale = createBsaleClient(logger);
  await logger.info('EXTRACT', `Extrayendo devoluciones desde /returns.json (max ${maxDocs})`);
  
  try {
    const returns = await bsale.getReturns({ limit: String(maxDocs) }) as any[];
    const limited = returns.slice(0, maxDocs);
    await logger.info('EXTRACT', `${limited.length} devoluciones obtenidas`);
    logger.incrementProcessed(limited.length);
    
    const devoluciones: any[] = [];
    
    for (const ret of limited) {
      const fecha = ret.returnDate ? new Date(ret.returnDate * 1000).toISOString().split('T')[0] : fechaHoy();
      const monto = ret.amount || 0;
      if (monto <= 0) continue;
      
      const docId = ret.reference_document?.id ? parseInt(String(ret.reference_document.id)) : null;
      const motivo = (ret.motive || 'Devolucion').substring(0, 200);
      
      devoluciones.push({
        bsale_return_id: ret.id,
        bsale_document_id: docId,
        fecha,
        tienda: 'BLUEFISHING',
        tipo: 'DEVOLUCION',
        cantidad: 1,
        monto,
        motivo,
        estado: 'PROCESADA'
      });
    }
    
    await logger.info('TRANSFORM', `${devoluciones.length} devoluciones válidas`);
    
    for (let i = 0; i < devoluciones.length; i += 20) {
      const batch = devoluciones.slice(i, i + 20);
      for (const dev of batch) {
        const { error } = await supabase.from('fact_devoluciones').upsert(dev, { onConflict: 'bsale_return_id,producto_id' });
        if (error) {
          logger.incrementErrors();
        } else {
          logger.incrementInserted();
        }
      }
    }
  } catch (e) {
    await logger.warn('DEVOLUCIONES', `Error: ${e}`);
  }
}

async function syncBodegas(supabase: ReturnType<typeof createClient>, logger: ReturnType<typeof createLogger>) {
  const bsale = createBsaleClient(logger);
  await logger.info('EXTRACT', 'Extrayendo oficinas/bodegas');
  
  try {
    const { items: offices } = await bsale.getOffices() as { items: any[] };
    await logger.info('EXTRACT', `${offices?.length || 0} oficinas obtenidas`);
    
    for (const office of (offices || [])) {
      const codigo = `OFFICE_${office.id}`;
      const nombre = office.name || `Oficina ${office.id}`;
      const tienda = (office.id === 2 || office.id === 4) ? 'EPICBIKE' : 'BLUEFISHING';
      
      const { error } = await supabase.from('dim_bodegas').upsert({
        codigo,
        nombre,
        bsale_office_id: office.id,
        tienda,
        es_activa: office.state === 0
      }, { onConflict: 'codigo' });
      
      if (error) {
        await logger.warn('LOAD', `Error bodega ${office.id}: ${error.message}`);
      } else {
        logger.incrementInserted();
      }
    }
  } catch (e) {
    await logger.warn('BODEGAS', `Error: ${e}`);
  }
}

async function syncStock(supabase: ReturnType<typeof createClient>, logger: ReturnType<typeof createLogger>, maxPages = 20) {
  const bsale = createBsaleClient(logger);
  await logger.info('EXTRACT', `Extrayendo stock (max ${maxPages} páginas)`);
  
  // Primero sincronizar bodegas
  await syncBodegas(supabase, logger);
  
  // Cargar stock en páginas
  const stocks: BsaleStock[] = [];
  const pageSize = 50;
  for (let page = 0; page < maxPages; page++) {
    const offset = page * pageSize;
    try {
      const pageStocks = await bsale.getStocks({ limit: String(pageSize), offset: String(offset) }) as BsaleStock[];
      if (!pageStocks.length) break;
      stocks.push(...pageStocks);
      if (page % 5 === 0) await logger.info('EXTRACT', `Página ${page + 1}: total ${stocks.length} stocks`);
    } catch (e) {
      await logger.warn('EXTRACT', `Error página ${page}: ${e}`);
      break;
    }
    await new Promise(r => setTimeout(r, 50));
  }
  logger.incrementProcessed(stocks.length);
  await logger.info('EXTRACT', `Total stocks obtenidos: ${stocks.length}`);
  
  const { data: prodMap } = await supabase.from('dim_productos').select('producto_id, bsale_variant_id');
  const variantToProd = new Map((prodMap || []).map(p => [p.bsale_variant_id, p.producto_id]));
  
  const { data: bodMap } = await supabase.from('dim_bodegas').select('bodega_id, bsale_office_id');
  const officeToBod = new Map((bodMap || []).map(b => [b.bsale_office_id, b.bodega_id]));
  await logger.info('LOAD', `Mapeando con ${prodMap?.length || 0} productos y ${bodMap?.length || 0} bodegas`);
  
  // Si no hay bodegas mapeadas, usar bodega por defecto
  const defaultBodegaId = bodMap?.find(b => b.bsale_office_id)?.bodega_id || 1;
  
  const hoy = fechaHoy();
  let sinProd = 0, sinBod = 0;
  
  // También actualizar stock_actual en dim_productos
  const stockPorProducto = new Map<number, number>();
  
  const records = stocks.map(s => {
    const variantId = extractNestedId(s, 'variant.id') ?? extractNestedId(s, 'variant_id') ?? s.variant?.id;
    const officeId = extractNestedId(s, 'office.id') ?? extractNestedId(s, 'office_id') ?? s.office?.id;
    const prodId = variantToProd.get(variantId);
    let bodId = officeToBod.get(officeId);
    
    if (!prodId) { sinProd++; return null; }
    if (!bodId) { 
      bodId = defaultBodegaId; // Usar bodega por defecto
      sinBod++; 
    }
    
    const cantidad = s.quantity || s.quantityAvailable || 0;
    
    // Acumular stock por producto
    const currentStock = stockPorProducto.get(prodId) || 0;
    stockPorProducto.set(prodId, currentStock + cantidad);
    
    return { 
      fecha: hoy, 
      producto_id: prodId, 
      bodega_id: bodId, 
      cantidad, 
      cantidad_disponible: s.quantityAvailable || cantidad, 
      cantidad_reservada: s.quantityReserved || 0 
    };
  }).filter(Boolean);
  
  await logger.info('TRANSFORM', `${records.length} registros válidos (${sinProd} sin producto, ${sinBod} sin bodega)`);
  
  // Insertar fact_stock
  for (let i = 0; i < records.length; i += 100) {
    const batch = records.slice(i, i + 100);
    const { error } = await supabase.from('fact_stock').upsert(batch, { onConflict: 'fecha,producto_id,bodega_id' });
    if (error) {
      await logger.warn('LOAD', `Error batch ${i}: ${error.message}`);
      logger.incrementErrors(batch.length);
    }
    else logger.incrementInserted(batch.length);
  }
  
  // Actualizar stock_actual en dim_productos
  await logger.info('LOAD', `Actualizando stock_actual en ${stockPorProducto.size} productos`);
  for (const [prodId, stock] of stockPorProducto) {
    await supabase.from('dim_productos').update({ stock_actual: stock }).eq('producto_id', prodId);
  }
  
  // Llamar función de actualización de stock
  try {
    await supabase.rpc('actualizar_stock_productos');
    await logger.info('POST', 'Stock de productos actualizado');
  } catch {}
}

async function syncPrecios(supabase: ReturnType<typeof createClient>, logger: ReturnType<typeof createLogger>) {
  const bsale = createBsaleClient(logger);
  await logger.info('EXTRACT', 'Extrayendo listas de precios (venta + costo)');
  
  try {
    const priceLists = await bsale.getPriceLists() as any[];
    await logger.info('EXTRACT', `${priceLists.length} listas de precios obtenidas`);

    const { data: prodMap } = await supabase.from('dim_productos').select('producto_id, bsale_variant_id');
    const variantToProd = new Map((prodMap || []).map((p: any) => [parseInt(String(p.bsale_variant_id)), p.producto_id]));
    await logger.info('EXTRACT', `${variantToProd.size} productos mapeados por variant_id`);

    // 1. Sync precio_venta from TIENDA list (base=1) or first list
    const saleList = priceLists.find((pl: any) => pl.base === 1 || pl.name?.toUpperCase() === 'TIENDA') || priceLists[0];
    if (saleList) {
      await logger.info('EXTRACT', `Extrayendo precios de venta de "${saleList.name}" (id=${saleList.id})`);
      const saleDetails = await bsale.getPriceListDetails(parseInt(String(saleList.id))) as any[];
      await logger.info('EXTRACT', `${saleDetails.length} precios de venta obtenidos`);
      
      let updatedSale = 0;
      const batchSize = 50;
      for (let i = 0; i < saleDetails.length; i += batchSize) {
        const batch = saleDetails.slice(i, i + batchSize);
        const updates = batch.map((d: any) => {
          const vid = parseInt(String(d.variant?.id || d.variantId || 0));
          const price = parseFloat(String(d.variantValueWithTaxes || d.variantValue || 0));
          const pid = variantToProd.get(vid);
          return pid && price > 1 ? { producto_id: pid, precio_venta: Math.round(price) } : null;
        }).filter(Boolean);

        if (updates.length > 0) {
          for (const u of updates) {
            const { error } = await supabase.from('dim_productos')
              .update({ precio_venta: u!.precio_venta })
              .eq('producto_id', u!.producto_id);
            if (!error) updatedSale++;
          }
        }
      }
      await logger.info('POST', `Precios de venta actualizados: ${updatedSale} productos`);
    }

    // 2. Sync precio_costo from Distribuidor/Costo list
    const costList = priceLists.find((pl: any) => 
      pl.name?.toLowerCase().includes('costo') || 
      pl.name?.toLowerCase().includes('distribuidor') ||
      pl.name?.toLowerCase().includes('proveedor')
    );
    if (costList) {
      await logger.info('EXTRACT', `Extrayendo precios de costo de "${costList.name}" (id=${costList.id})`);
      const costDetails = await bsale.getPriceListDetails(parseInt(String(costList.id))) as any[];
      await logger.info('EXTRACT', `${costDetails.length} precios de costo obtenidos`);
      
      let updatedCost = 0;
      for (const detail of costDetails) {
        const vid = parseInt(String(detail.variant?.id || detail.variantId || 0));
        const cost = parseFloat(String(detail.variantValue || detail.variantValueWithTaxes || 0));
        if (!vid || cost <= 0) continue;
        const pid = variantToProd.get(vid);
        if (!pid) continue;
        const { error } = await supabase.from('dim_productos')
          .update({ precio_costo: Math.round(cost) })
          .eq('producto_id', pid);
        if (!error) updatedCost++;
      }
      await logger.info('POST', `Precios de costo actualizados: ${updatedCost} productos`);
    }
  } catch (e) {
    await logger.warn('PRECIOS', `Error sincronizando precios: ${e}`);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  
  const startTime = Date.now();
  try {
    const { tipo = 'all', fecha_desde, max_docs = 100, max_pages = 30 } = await req.json().catch(() => ({}));
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { db: { schema: 'bi' } }
    );
    const logger = createLogger(supabase, tipo.toUpperCase());
    await logger.startJob({ tipo, fecha_desde, max_docs, max_pages });
    
    try {
      if (tipo === 'productos' || tipo === 'all') await syncProductos(supabase, logger);
      if (tipo === 'clientes' || tipo === 'all') await syncClientes(supabase, logger);
      if (tipo === 'ventas' || tipo === 'all') await syncVentas(supabase, logger, fecha_desde, max_docs);
      if (tipo === 'stock' || tipo === 'all') await syncStock(supabase, logger, max_pages);
      if (tipo === 'cobranza' || tipo === 'all') await syncCobranza(supabase, logger, max_docs);
      if (tipo === 'pagos' || tipo === 'all') await syncPagos(supabase, logger, max_docs);
      if (tipo === 'devoluciones' || tipo === 'all') await syncDevoluciones(supabase, logger, max_docs);
      if (tipo === 'precios' || tipo === 'all') await syncPrecios(supabase, logger);
      
      // === POST-PROCESSING ===
      
      // 1. Refrescar vistas materializadas
      try { await supabase.rpc('refresh_all_materialized_views'); } catch {}
      
      // 2. Generar predicciones
      try { 
        await supabase.rpc('generar_predicciones');
        await logger.info('POST', 'Predicciones generadas');
      } catch {}
      
      // 3. Actualizar stock de productos
      try { 
        await supabase.rpc('actualizar_stock_productos');
        await logger.info('POST', 'Stock actualizado');
      } catch {}
      
      // 4. Generar alertas del sistema (quiebres de stock + mora)
      try {
        const { data: alertCount } = await supabase.rpc('generar_alertas_sistema');
        await logger.info('POST', `Alertas generadas: ${alertCount ?? 0}`);
      } catch (e) {
        await logger.warn('POST', `Error generando alertas: ${e}`);
      }
      
      // 5. Sincronizar módulo financiero (dim_clientes → fin_clientes, fact_cobranza → fin_facturas, etc.)
      try {
        const { data: finResult } = await supabase.rpc('sync_modulo_financiero');
        await logger.info('POST', `Módulo financiero sincronizado: ${JSON.stringify(finResult)}`);
      } catch (e) {
        await logger.warn('POST', `Error sincronizando módulo financiero: ${e}`);
      }
      
      // 6. Sincronizar precios de venta y costo desde Bsale price lists
      if (tipo === 'productos' || tipo === 'all') {
        try {
          await syncPrecios(supabase, logger);
        } catch (e) {
          await logger.warn('POST', `Error sincronizando precios: ${e}`);
        }
      }
      
      await logger.endJob('SUCCESS');
      
      return new Response(JSON.stringify({ success: true, job_id: logger.getJobId(), stats: logger.getStats(), duration_ms: Date.now() - startTime } as ETLResponse), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (err) {
      await logger.endJob('FAILED', String(err));
      throw err;
    }
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: String(error), duration_ms: Date.now() - startTime } as ETLResponse), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
