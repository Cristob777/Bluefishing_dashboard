-- ============================================================================
-- MI SPA BI SYSTEM - Fixes para las 8 Fallas Críticas
-- ============================================================================

-- FALLA #4: Función para cliente seguro (nunca NULL)
CREATE OR REPLACE FUNCTION bi.get_safe_cliente_id(p_bsale_client_id INTEGER)
RETURNS INTEGER AS $$
DECLARE v_cliente_id INTEGER;
BEGIN
    IF p_bsale_client_id IS NULL OR p_bsale_client_id = 0 THEN
        SELECT cliente_id INTO v_cliente_id FROM bi.dim_clientes WHERE bsale_client_id = 0;
        RETURN v_cliente_id;
    END IF;
    
    SELECT cliente_id INTO v_cliente_id FROM bi.dim_clientes WHERE bsale_client_id = p_bsale_client_id;
    
    IF v_cliente_id IS NULL THEN
        SELECT cliente_id INTO v_cliente_id FROM bi.dim_clientes WHERE bsale_client_id = 0;
    END IF;
    
    RETURN v_cliente_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- FALLA #5: Función deduplicación
CREATE OR REPLACE FUNCTION bi.dedup_fact_ventas()
RETURNS TABLE(duplicados_eliminados BIGINT, registros_restantes BIGINT) AS $$
DECLARE v_deleted BIGINT; v_remaining BIGINT;
BEGIN
    WITH duplicados AS (
        SELECT venta_id, ROW_NUMBER() OVER (PARTITION BY bsale_document_id, bsale_detail_id ORDER BY created_at DESC) AS rn
        FROM bi.fact_ventas
    )
    DELETE FROM bi.fact_ventas WHERE venta_id IN (SELECT venta_id FROM duplicados WHERE rn > 1);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    SELECT COUNT(*) INTO v_remaining FROM bi.fact_ventas;
    RETURN QUERY SELECT v_deleted, v_remaining;
END;
$$ LANGUAGE plpgsql;

-- FALLA #7: Vista de ventas válidas (sin huérfanos)
CREATE OR REPLACE VIEW bi.v_fact_ventas_validas AS
SELECT v.*, p.sku, p.nombre AS producto_nombre, p.marca, c.razon_social AS cliente_nombre
FROM bi.fact_ventas v
INNER JOIN bi.dim_productos p ON v.producto_id = p.producto_id
INNER JOIN bi.dim_clientes c ON v.cliente_id = c.cliente_id;

-- FALLA #7: Función verificar huérfanos
CREATE OR REPLACE FUNCTION bi.check_orphan_rate()
RETURNS TABLE(total_ventas BIGINT, ventas_con_producto BIGINT, ventas_huerfanas BIGINT, tasa_huerfanos NUMERIC, status TEXT) AS $$
DECLARE v_total BIGINT; v_con_producto BIGINT; v_huerfanos BIGINT; v_tasa NUMERIC;
BEGIN
    SELECT COUNT(*) INTO v_total FROM bi.fact_ventas;
    SELECT COUNT(*) INTO v_con_producto FROM bi.fact_ventas WHERE producto_id IS NOT NULL;
    v_huerfanos := v_total - v_con_producto;
    v_tasa := CASE WHEN v_total > 0 THEN ROUND((v_huerfanos::NUMERIC / v_total * 100), 2) ELSE 0 END;
    
    RETURN QUERY SELECT v_total, v_con_producto, v_huerfanos, v_tasa,
        CASE WHEN v_tasa < 5 THEN '✅ SALUDABLE' WHEN v_tasa < 20 THEN '⚠️ REVISAR' ELSE '❌ CRITICO' END;
END;
$$ LANGUAGE plpgsql;

-- FALLA #8: Función verificar frescura de datos
CREATE OR REPLACE FUNCTION bi.check_data_freshness()
RETURNS TABLE(entidad TEXT, fecha_min DATE, fecha_max DATE, registros BIGINT, dias_antiguedad INTEGER, status TEXT) AS $$
BEGIN
    RETURN QUERY SELECT 'fact_ventas'::TEXT, MIN(fecha), MAX(fecha), COUNT(*)::BIGINT,
        (CURRENT_DATE - MAX(fecha))::INTEGER,
        CASE WHEN MAX(fecha) >= CURRENT_DATE - 7 THEN '✅ OK' WHEN MAX(fecha) >= CURRENT_DATE - 30 THEN '⚠️ DESACTUALIZADO' ELSE '❌ MUY ANTIGUO' END
    FROM bi.fact_ventas;
    
    RETURN QUERY SELECT 'fact_stock'::TEXT, MIN(fecha), MAX(fecha), COUNT(*)::BIGINT,
        (CURRENT_DATE - MAX(fecha))::INTEGER,
        CASE WHEN MAX(fecha) >= CURRENT_DATE - 1 THEN '✅ OK' ELSE '⚠️ DESACTUALIZADO' END
    FROM bi.fact_stock;
    
    RETURN QUERY SELECT 'dim_productos'::TEXT, MIN(created_at)::DATE, MAX(updated_at)::DATE, COUNT(*)::BIGINT,
        (CURRENT_DATE - MAX(updated_at)::DATE)::INTEGER,
        CASE WHEN MAX(updated_at) >= CURRENT_DATE - 7 THEN '✅ OK' ELSE '⚠️ DESACTUALIZADO' END
    FROM bi.dim_productos;
END;
$$ LANGUAGE plpgsql;

-- Vista consolidada de salud
CREATE OR REPLACE VIEW bi.v_system_health AS
SELECT 
    (SELECT COUNT(*) FROM bi.dim_productos WHERE es_activo) AS productos_activos,
    (SELECT COUNT(*) FROM bi.dim_clientes WHERE es_activo) AS clientes_activos,
    (SELECT COUNT(*) FROM bi.fact_ventas WHERE fecha >= CURRENT_DATE - 30) AS ventas_30d,
    (SELECT COALESCE(SUM(monto_original - monto_pagado), 0) FROM bi.fact_cobranza WHERE estado IN ('PENDIENTE', 'PARCIAL', 'VENCIDO')) AS total_por_cobrar,
    NOW() AS checked_at;

-- Índices adicionales para FALLA #7
CREATE INDEX IF NOT EXISTS idx_ventas_huerfanas ON bi.fact_ventas(bsale_variant_id) WHERE producto_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_productos_variant_lookup ON bi.dim_productos(bsale_variant_id) WHERE bsale_variant_id IS NOT NULL;

GRANT SELECT ON bi.v_fact_ventas_validas TO authenticated;
GRANT SELECT ON bi.v_system_health TO authenticated;
GRANT EXECUTE ON FUNCTION bi.check_orphan_rate() TO authenticated;
GRANT EXECUTE ON FUNCTION bi.check_data_freshness() TO authenticated;
GRANT EXECUTE ON FUNCTION bi.get_safe_cliente_id(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION bi.dedup_fact_ventas() TO service_role;
