import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const results: string[] = [];
  const log = (msg: string) => { results.push(msg); console.log(msg); };

  try {
    const body = await req.json().catch(() => ({ action: 'fix' }));
    const action = body.action || 'fix';
    
    const dbUrl = Deno.env.get('SUPABASE_DB_URL');
    if (!dbUrl) throw new Error('SUPABASE_DB_URL not available');

    const { default: postgres } = await import('https://deno.land/x/postgresjs@v3.4.5/mod.js');
    const sql = postgres(dbUrl, { max: 1 });

    try {
      if (action === 'run-sql') {
        log('=== RAW SQL MODE ===');
        const rawSql = body.sql;
        if (!rawSql) throw new Error('Missing sql parameter');
        const sqlResult = await sql.unsafe(rawSql);
        log(`Executed. Rows affected: ${sqlResult.count ?? sqlResult.length ?? 0}`);
        if (Array.isArray(sqlResult) && sqlResult.length > 0 && sqlResult.length <= 100) {
          for (const row of sqlResult) {
            log(JSON.stringify(row));
          }
        }
      } else if (action === 'fix-trigger') {
        // FIX TRIGGER MODE: Drop the problematic trigger and fix permissions
        log('=== FIX TRIGGER MODE ===');
        
        // 1. Drop the trigger that refreshes MVs on every insert
        log('1. Dropping problematic triggers on fact_ventas...');
        await sql.unsafe(`
          DROP TRIGGER IF EXISTS trg_after_insert_ventas ON bi.fact_ventas;
          DROP TRIGGER IF EXISTS trg_refresh_mv_ventas ON bi.fact_ventas;
          DROP TRIGGER IF EXISTS refresh_mv_on_ventas ON bi.fact_ventas;
        `);
        log('   Triggers dropped');
        
        // 2. List remaining triggers
        const triggers = await sql`
          SELECT tgname, tgtype, pg_get_triggerdef(t.oid) as def
          FROM pg_trigger t
          JOIN pg_class c ON c.oid = t.tgrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'bi' AND c.relname = 'fact_ventas'
          AND NOT t.tgisinternal
        `;
        log(`   Remaining triggers: ${triggers.length}`);
        for (const t of triggers) {
          log(`   - ${t.tgname}: ${t.def}`);
        }
        
        // 3. Grant ALL on bi schema to service_role
        log('2. Granting comprehensive permissions...');
        await sql.unsafe(`
          GRANT ALL ON SCHEMA bi TO service_role;
          GRANT ALL ON ALL TABLES IN SCHEMA bi TO service_role;
          GRANT ALL ON ALL SEQUENCES IN SCHEMA bi TO service_role;
          GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA bi TO service_role;
          GRANT SELECT ON ALL TABLES IN SCHEMA bi TO anon, authenticated;
          ALTER DEFAULT PRIVILEGES IN SCHEMA bi GRANT ALL ON TABLES TO service_role;
          ALTER DEFAULT PRIVILEGES IN SCHEMA bi GRANT SELECT ON TABLES TO anon, authenticated;
        `);
        log('   All permissions granted');
        
        // 4. Test upsert again
        log('3. Testing upsert after fix...');
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
          { db: { schema: 'bi' } }
        );
        
        const testRow = {
          fecha: '2026-01-01',
          tienda: 'BLUEFISHING',
          bsale_document_id: 99998,
          bsale_detail_id: 99998,
          bsale_variant_id: 1,
          cantidad: 1,
          precio_unitario: 100,
          descuento_monto: 0,
          subtotal: 100,
          impuesto: 19,
          total: 119,
          tipo_documento: 'TEST',
          numero_documento: 'TEST-001'
        };
        
        const { error: upsertError } = await supabase
          .from('fact_ventas')
          .upsert([testRow], { onConflict: 'bsale_document_id,bsale_detail_id' });
        
        if (upsertError) {
          log(`   STILL FAILING: ${upsertError.message} (code: ${upsertError.code})`);
          
          // Check if there's another trigger causing issues
          log('   Checking ALL triggers in bi schema...');
          const allTriggers = await sql`
            SELECT c.relname as table_name, t.tgname, pg_get_triggerdef(t.oid) as def
            FROM pg_trigger t
            JOIN pg_class c ON c.oid = t.tgrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'bi' AND NOT t.tgisinternal
          `;
          for (const t of allTriggers) {
            log(`   - ${t.table_name}.${t.tgname}`);
          }
        } else {
          log(`   Upsert SUCCESS! Trigger fix worked.`);
          // Clean up
          await sql`DELETE FROM bi.fact_ventas WHERE bsale_document_id = 99998`;
          log(`   Test row cleaned up`);
        }
        
      } else if (action === 'diagnose') {
        // DIAGNOSTIC MODE: Check why upserts fail
        log('=== DIAGNOSTIC MODE ===');
        
        // 1. Check fact_ventas table structure
        log('1. Checking fact_ventas columns...');
        const cols = await sql`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_schema = 'bi' AND table_name = 'fact_ventas'
          ORDER BY ordinal_position
        `;
        for (const c of cols) {
          log(`   ${c.column_name}: ${c.data_type} ${c.is_nullable === 'NO' ? 'NOT NULL' : 'nullable'} ${c.column_default ? 'default=' + c.column_default : ''}`);
        }
        
        // 2. Check unique constraints
        log('2. Checking constraints on fact_ventas...');
        const constraints = await sql`
          SELECT conname, contype, 
            pg_get_constraintdef(c.oid) as def
          FROM pg_constraint c
          JOIN pg_namespace n ON n.oid = c.connamespace
          WHERE n.nspname = 'bi' 
          AND c.conrelid = 'bi.fact_ventas'::regclass
        `;
        for (const c of constraints) {
          log(`   ${c.conname} (${c.contype}): ${c.def}`);
        }
        
        // 3. Check indexes
        log('3. Checking indexes...');
        const indexes = await sql`
          SELECT indexname, indexdef
          FROM pg_indexes 
          WHERE schemaname = 'bi' AND tablename = 'fact_ventas'
        `;
        for (const i of indexes) {
          log(`   ${i.indexname}: ${i.indexdef}`);
        }
        
        // 4. Sample data from fact_ventas
        log('4. Sample data...');
        const sample = await sql`
          SELECT venta_id, fecha, tienda, bsale_document_id, bsale_detail_id, 
                 bsale_variant_id, producto_id, total
          FROM bi.fact_ventas LIMIT 3
        `;
        for (const s of sample) {
          log(`   id=${s.venta_id} doc=${s.bsale_document_id} det=${s.bsale_detail_id} var=${s.bsale_variant_id} prod=${s.producto_id} total=${s.total}`);
        }
        
        // 5. Test direct upsert via SQL
        log('5. Testing direct SQL upsert...');
        try {
          const testResult = await sql`
            INSERT INTO bi.fact_ventas (
              fecha, tienda, bsale_document_id, bsale_detail_id, 
              bsale_variant_id, cantidad, total
            ) VALUES (
              '2026-01-01', 'BLUEFISHING', 99999, 99999,
              1, 1, 100
            )
            ON CONFLICT (bsale_document_id, bsale_detail_id) 
            DO UPDATE SET total = EXCLUDED.total
            RETURNING venta_id
          `;
          log(`   Direct upsert OK: venta_id=${testResult[0]?.venta_id}`);
          
          // Clean up test row
          await sql`DELETE FROM bi.fact_ventas WHERE bsale_document_id = 99999`;
          log(`   Test row cleaned up`);
        } catch (e: any) {
          log(`   Direct upsert FAILED: ${e.message}`);
        }
        
        // 6. Test via Supabase client (same as ETL uses)
        log('6. Testing via Supabase client...');
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
          { db: { schema: 'bi' } }
        );
        
        const testRow = {
          fecha: '2026-01-01',
          tienda: 'BLUEFISHING',
          bsale_document_id: 99998,
          bsale_detail_id: 99998,
          bsale_variant_id: 1,
          cantidad: 1,
          precio_unitario: 100,
          descuento_monto: 0,
          subtotal: 100,
          impuesto: 19,
          total: 119,
          tipo_documento: 'TEST',
          numero_documento: 'TEST-001',
          producto_id: null,
          cliente_id: null,
          bodega_id: null,
          bsale_created_at: new Date().toISOString()
        };
        
        const { data: upsertData, error: upsertError } = await supabase
          .from('fact_ventas')
          .upsert([testRow], { onConflict: 'bsale_document_id,bsale_detail_id' });
        
        if (upsertError) {
          log(`   Supabase upsert FAILED: ${upsertError.message}`);
          log(`   Error code: ${upsertError.code}`);
          log(`   Error details: ${upsertError.details}`);
          log(`   Error hint: ${upsertError.hint}`);
        } else {
          log(`   Supabase upsert OK`);
          // Clean up
          await sql`DELETE FROM bi.fact_ventas WHERE bsale_document_id = 99998`;
          log(`   Test row cleaned up`);
        }
        
      } else {
        // FIX MODE (original logic)
        log('=== FIX MODE ===');
        
        // 1. Fix permissions
        log('1. Fixing permissions...');
        await sql`GRANT USAGE ON SCHEMA bi TO anon, authenticated, service_role`;
        await sql`GRANT SELECT ON ALL TABLES IN SCHEMA bi TO anon, authenticated, service_role`;
        await sql`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA bi TO anon, authenticated, service_role`;
        log('   Permissions granted');

        // 2. Update producto_id
        log('2. Updating producto_id...');
        const updateResult = await sql`
          UPDATE bi.fact_ventas fv
          SET producto_id = dp.producto_id
          FROM bi.dim_productos dp
          WHERE fv.bsale_variant_id = dp.bsale_variant_id
          AND fv.producto_id IS NULL
        `;
        log(`   Updated ${updateResult.count} rows`);

        // 3. Recreate mv_resumen_ejecutivo with wider window
        log('3. Recreating mv_resumen_ejecutivo...');
        await sql.unsafe(`
          DROP MATERIALIZED VIEW IF EXISTS bi.mv_resumen_ejecutivo CASCADE;
          CREATE MATERIALIZED VIEW bi.mv_resumen_ejecutivo AS
          SELECT
              p.tienda,
              COUNT(DISTINCT p.producto_id) FILTER (WHERE p.stock_actual > 0) AS productos_con_stock,
              COALESCE(SUM(p.stock_actual) FILTER (WHERE p.stock_actual > 0), 0) AS unidades_stock,
              COALESCE(SUM(p.stock_actual * COALESCE(p.precio_costo, 0)) FILTER (WHERE p.stock_actual > 0), 0) AS valor_stock_costo,
              COALESCE(SUM(p.stock_actual * COALESCE(p.precio_venta, 0)) FILTER (WHERE p.stock_actual > 0), 0) AS valor_stock_venta,
              COALESCE((
                  SELECT SUM(v.total)
                  FROM bi.fact_ventas v
                  JOIN bi.dim_productos dp ON dp.producto_id = v.producto_id
                  WHERE dp.tienda = p.tienda
                  AND v.fecha >= CURRENT_DATE - INTERVAL '30 days'
              ), 0) AS ventas_mes,
              COALESCE((
                  SELECT COUNT(DISTINCT v.bsale_document_id)
                  FROM bi.fact_ventas v
                  JOIN bi.dim_productos dp ON dp.producto_id = v.producto_id
                  WHERE dp.tienda = p.tienda
                  AND v.fecha >= CURRENT_DATE - INTERVAL '30 days'
              ), 0) AS num_ventas_mes,
              COALESCE((
                  SELECT SUM(c.monto_original - c.monto_pagado)
                  FROM bi.fact_cobranza c
                  WHERE c.tienda = p.tienda
                  AND c.estado IN ('PENDIENTE', 'PARCIAL', 'VENCIDO')
              ), 0) AS por_cobrar
          FROM bi.dim_productos p
          GROUP BY p.tienda;
          GRANT SELECT ON bi.mv_resumen_ejecutivo TO anon, authenticated, service_role;
        `);
        log('   mv_resumen_ejecutivo recreated');

        // 4. Refresh MVs
        log('4. Refreshing materialized views...');
        const mvs = [
          'mv_resumen_ejecutivo', 'mv_ventas_diarias', 'mv_top_productos',
          'mv_stock_disponible_marca', 'mv_metricas_diarias', 'mv_comparativo_yoy'
        ];
        for (const mv of mvs) {
          try {
            await sql.unsafe(`REFRESH MATERIALIZED VIEW bi.${mv}`);
            log(`   Refreshed ${mv}`);
          } catch (e: any) {
            log(`   Error ${mv}: ${e.message}`);
          }
        }

        // 5. Verify
        log('5. Checking results...');
        const stats = await sql`
          SELECT COUNT(*)::int as total, COUNT(producto_id)::int as con_prod,
            MIN(fecha)::text as fecha_min, MAX(fecha)::text as fecha_max
          FROM bi.fact_ventas
        `;
        log(`   fact_ventas: ${stats[0].total} rows, ${stats[0].con_prod} linked, ${stats[0].fecha_min} to ${stats[0].fecha_max}`);

        const resumen = await sql`SELECT tienda, ventas_mes, valor_stock_venta, productos_con_stock FROM bi.mv_resumen_ejecutivo`;
        for (const r of resumen) {
          log(`   ${r.tienda}: Ventas=$${r.ventas_mes}, Stock=$${r.valor_stock_venta}, Prods=${r.productos_con_stock}`);
        }
      }

      await sql.end();
    } catch (e) {
      try { await sql.end(); } catch {}
      throw e;
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    log(`FATAL: ${error}`);
    return new Response(JSON.stringify({ success: false, error: String(error), results }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
