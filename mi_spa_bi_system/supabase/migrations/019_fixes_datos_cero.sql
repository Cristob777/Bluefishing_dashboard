-- =============================================================================
-- MIGRACIÓN 019: FIXES PARA DATOS EN CERO
-- =============================================================================
-- Corrige: mv_resumen_ejecutivo, v_kpi_cobranza, refresh function,
--          category linking, sync financiero
-- =============================================================================

-- ============================================================================
-- FIX 1: mv_resumen_ejecutivo - columna saldo_pendiente NO EXISTE
-- La columna correcta es (monto_original - monto_pagado)
-- También: 'VENCIDA' no es un valor del ENUM, es 'VENCIDO'
-- ============================================================================

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
        WHERE v.tienda = p.tienda 
        AND v.fecha >= DATE_TRUNC('month', CURRENT_DATE)
    ), 0) AS ventas_mes,
    COALESCE((
        SELECT COUNT(DISTINCT v.bsale_document_id)
        FROM bi.fact_ventas v 
        WHERE v.tienda = p.tienda 
        AND v.fecha >= DATE_TRUNC('month', CURRENT_DATE)
    ), 0) AS num_ventas_mes,
    COALESCE((
        SELECT SUM(pg.monto) 
        FROM bi.fact_pagos pg 
        WHERE pg.tienda = p.tienda::text
        AND pg.fecha >= DATE_TRUNC('month', CURRENT_DATE)
    ), 0) AS pagos_mes,
    COALESCE((
        SELECT SUM(d.monto) 
        FROM bi.fact_devoluciones d 
        WHERE d.tienda = p.tienda::text
        AND d.fecha >= DATE_TRUNC('month', CURRENT_DATE)
    ), 0) AS devoluciones_mes,
    COALESCE((
        SELECT SUM(c.monto_original - c.monto_pagado) 
        FROM bi.fact_cobranza c 
        WHERE c.tienda = p.tienda 
        AND c.estado IN ('PENDIENTE', 'PARCIAL', 'VENCIDO')
    ), 0) AS por_cobrar
FROM bi.dim_productos p
GROUP BY p.tienda;

CREATE UNIQUE INDEX ON bi.mv_resumen_ejecutivo(tienda);
GRANT SELECT ON bi.mv_resumen_ejecutivo TO authenticated, anon;

-- ============================================================================
-- FIX 2: v_kpi_cobranza - misma columna saldo_pendiente y VENCIDA
-- ============================================================================

CREATE OR REPLACE VIEW bi.v_kpi_cobranza AS
SELECT 
    tienda,
    SUM(CASE WHEN estado = 'PENDIENTE' THEN monto_original - monto_pagado ELSE 0 END) AS pendiente,
    SUM(CASE WHEN estado = 'VENCIDO' THEN monto_original - monto_pagado ELSE 0 END) AS vencida,
    SUM(CASE WHEN estado = 'PAGADO' THEN monto_original ELSE 0 END) AS cobrada,
    COUNT(DISTINCT cliente_id) FILTER (WHERE estado = 'VENCIDO') AS clientes_morosos,
    AVG(CURRENT_DATE - fecha_vencimiento) 
        FILTER (WHERE estado = 'VENCIDO') AS dias_mora_promedio
FROM bi.fact_cobranza
GROUP BY tienda;

GRANT SELECT ON bi.v_kpi_cobranza TO authenticated, anon;

-- ============================================================================
-- FIX 3: refresh_all_materialized_views - agregar MVs faltantes
-- ============================================================================

CREATE OR REPLACE FUNCTION bi.refresh_all_materialized_views()
RETURNS void AS $$
BEGIN
    -- MVs originales (001)
    REFRESH MATERIALIZED VIEW bi.mv_resumen_ejecutivo;
    REFRESH MATERIALIZED VIEW bi.mv_ventas_diarias;
    REFRESH MATERIALIZED VIEW bi.mv_aging_cartera;
    REFRESH MATERIALIZED VIEW bi.mv_top_productos;
    
    -- MVs de migraciones 015-017 (solo si existen)
    BEGIN REFRESH MATERIALIZED VIEW bi.mv_stock_disponible_marca; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN REFRESH MATERIALIZED VIEW bi.mv_disponibilidad_web; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN REFRESH MATERIALIZED VIEW bi.mv_metricas_diarias; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN REFRESH MATERIALIZED VIEW bi.mv_comparativo_yoy; EXCEPTION WHEN undefined_table THEN NULL; END;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FIX 4: Función para vincular categorías después de cada ETL sync
-- ============================================================================

CREATE OR REPLACE FUNCTION bi.vincular_categorias_productos()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE bi.dim_productos p
    SET categoria_id = c.categoria_id
    FROM bi.dim_categorias c
    WHERE p.bsale_category_id = c.bsale_category_id
    AND p.categoria_id IS NULL;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION bi.vincular_categorias_productos() TO service_role;

-- ============================================================================
-- FIX 5: Función para sincronizar dim_clientes → fin_clientes
-- ============================================================================

CREATE OR REPLACE FUNCTION bi.sync_dim_to_fin_clientes()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    INSERT INTO bi.fin_clientes (
        dim_cliente_id, bsale_id, rut, razon_social, 
        email, telefono, comuna, ciudad,
        credit_limit, payment_terms_days
    )
    SELECT 
        dc.cliente_id,
        dc.bsale_client_id,
        COALESCE(dc.rut, 'SIN-RUT-' || dc.cliente_id),
        dc.razon_social,
        dc.email,
        dc.telefono,
        dc.comuna,
        dc.ciudad,
        COALESCE(dc.cupo_credito, 0),
        CASE WHEN dc.tiene_credito THEN 30 ELSE 0 END
    FROM bi.dim_clientes dc
    WHERE dc.bsale_client_id IS NOT NULL
    AND dc.bsale_client_id != 0
    AND dc.rut IS NOT NULL
    AND dc.rut != ''
    AND NOT EXISTS (
        SELECT 1 FROM bi.fin_clientes fc 
        WHERE fc.bsale_id = dc.bsale_client_id
    )
    ON CONFLICT (bsale_id) DO UPDATE SET
        razon_social = EXCLUDED.razon_social,
        email = EXCLUDED.email,
        telefono = EXCLUDED.telefono,
        comuna = EXCLUDED.comuna,
        ciudad = EXCLUDED.ciudad,
        updated_at = NOW();
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION bi.sync_dim_to_fin_clientes() TO service_role;

-- ============================================================================
-- FIX 6: Función para sincronizar fact_cobranza → fin_facturas
-- ============================================================================

CREATE OR REPLACE FUNCTION bi.sync_cobranza_to_fin_facturas()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    INSERT INTO bi.fin_facturas (
        cliente_id, bsale_id, bsale_folio, tipo_documento,
        numero_documento, issue_date, due_date,
        total_amount, outstanding_balance, financial_status,
        tienda, synced_from_bsale_at
    )
    SELECT 
        fc.cliente_id,
        CASE 
            WHEN cb.documento_id LIKE 'BSALE-%' 
            THEN CAST(REPLACE(cb.documento_id, 'BSALE-', '') AS INTEGER)
            ELSE NULL
        END,
        cb.numero_documento,
        cb.tipo_documento,
        cb.numero_documento,
        cb.fecha_emision,
        COALESCE(cb.fecha_vencimiento, cb.fecha_emision + 30),
        cb.monto_original,
        cb.monto_original - cb.monto_pagado,
        CASE cb.estado::text
            WHEN 'PAGADO' THEN 'PAGADA'::bi.estado_financiero
            WHEN 'PARCIAL' THEN 'PARCIAL'::bi.estado_financiero
            WHEN 'VENCIDO' THEN 'VENCIDA'::bi.estado_financiero
            WHEN 'ANULADO' THEN 'ANULADA'::bi.estado_financiero
            ELSE 'PENDIENTE'::bi.estado_financiero
        END,
        cb.tienda,
        NOW()
    FROM bi.fact_cobranza cb
    INNER JOIN bi.fin_clientes fc ON fc.dim_cliente_id = cb.cliente_id
    WHERE cb.monto_original > 0
    AND NOT EXISTS (
        SELECT 1 FROM bi.fin_facturas ff 
        WHERE ff.bsale_id = CASE 
            WHEN cb.documento_id LIKE 'BSALE-%' 
            THEN CAST(REPLACE(cb.documento_id, 'BSALE-', '') AS INTEGER)
            ELSE NULL
        END
        AND ff.bsale_id IS NOT NULL
    )
    ON CONFLICT (bsale_id) DO UPDATE SET
        outstanding_balance = EXCLUDED.outstanding_balance,
        financial_status = EXCLUDED.financial_status,
        updated_at = NOW();
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION bi.sync_cobranza_to_fin_facturas() TO service_role;

-- ============================================================================
-- FIX 7: Función para sincronizar fact_pagos → fin_pagos
-- ============================================================================

CREATE OR REPLACE FUNCTION bi.sync_pagos_to_fin_pagos()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    INSERT INTO bi.fin_pagos (
        cliente_id, amount_received, unallocated_balance,
        payment_date, payment_method, reference_code, notas
    )
    SELECT 
        fc.cliente_id,
        fp.monto,
        fp.monto,
        fp.fecha,
        CASE UPPER(COALESCE(fp.metodo_pago, 'OTRO'))
            WHEN 'TRANSFERENCIA' THEN 'TRANSFERENCIA'::bi.metodo_pago
            WHEN 'CHEQUE' THEN 'CHEQUE'::bi.metodo_pago
            WHEN 'EFECTIVO' THEN 'EFECTIVO'::bi.metodo_pago
            WHEN 'TARJETA' THEN 'TARJETA_CREDITO'::bi.metodo_pago
            WHEN 'TARJETA CRÉDITO' THEN 'TARJETA_CREDITO'::bi.metodo_pago
            WHEN 'TARJETA DÉBITO' THEN 'TARJETA_DEBITO'::bi.metodo_pago
            WHEN 'WEBPAY' THEN 'WEBPAY'::bi.metodo_pago
            WHEN 'DEPÓSITO' THEN 'DEPOSITO'::bi.metodo_pago
            WHEN 'DEPOSITO' THEN 'DEPOSITO'::bi.metodo_pago
            ELSE 'OTRO'::bi.metodo_pago
        END,
        fp.referencia,
        'Sync desde fact_pagos #' || fp.bsale_payment_id
    FROM bi.fact_pagos fp
    INNER JOIN bi.fin_clientes fc ON fc.dim_cliente_id = fp.cliente_id
    WHERE fp.monto > 0
    AND fp.bsale_payment_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM bi.fin_pagos fnp 
        WHERE fnp.notas LIKE '%#' || fp.bsale_payment_id
    );
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION bi.sync_pagos_to_fin_pagos() TO service_role;

-- ============================================================================
-- FIX 8: Función maestra para sincronizar todo el módulo financiero
-- ============================================================================

CREATE OR REPLACE FUNCTION bi.sync_modulo_financiero()
RETURNS JSONB AS $$
DECLARE
    v_clientes INTEGER;
    v_facturas INTEGER;
    v_pagos INTEGER;
BEGIN
    v_clientes := bi.sync_dim_to_fin_clientes();
    v_facturas := bi.sync_cobranza_to_fin_facturas();
    v_pagos := bi.sync_pagos_to_fin_pagos();
    
    PERFORM bi.fn_actualizar_facturas_vencidas();
    
    RETURN JSONB_BUILD_OBJECT(
        'clientes_sincronizados', v_clientes,
        'facturas_sincronizadas', v_facturas,
        'pagos_sincronizados', v_pagos
    );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION bi.sync_modulo_financiero() TO service_role;

-- ============================================================================
-- REFRESCAR VISTAS
-- ============================================================================
REFRESH MATERIALIZED VIEW bi.mv_resumen_ejecutivo;

-- ============================================================================
-- FIN MIGRACIÓN 019
-- ============================================================================
