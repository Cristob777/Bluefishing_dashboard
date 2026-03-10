-- ============================================================================
-- MI SPA BI SYSTEM - Clasificación de Clientes y Análisis Regional
-- ============================================================================

-- 1. Agregar campos de clasificación a dim_clientes
ALTER TABLE bi.dim_clientes ADD COLUMN IF NOT EXISTS segmento VARCHAR(20) DEFAULT 'RETAIL';
ALTER TABLE bi.dim_clientes ADD COLUMN IF NOT EXISTS es_mayorista BOOLEAN DEFAULT FALSE;
ALTER TABLE bi.dim_clientes ADD COLUMN IF NOT EXISTS region_id INTEGER;
ALTER TABLE bi.dim_clientes ADD COLUMN IF NOT EXISTS total_compras NUMERIC(15,2) DEFAULT 0;
ALTER TABLE bi.dim_clientes ADD COLUMN IF NOT EXISTS num_compras INTEGER DEFAULT 0;

-- 2. Clasificar clientes como mayoristas según criterios
-- Criterios mayorista:
--   - Tipo cliente = EMPRESA
--   - Tiene crédito y cupo > $500,000
--   - O total de compras > $5,000,000
UPDATE bi.dim_clientes SET es_mayorista = TRUE
WHERE tipo_cliente = 'EMPRESA'
   OR (tiene_credito = TRUE AND cupo_credito > 500000);

-- 3. Actualizar segmento basado en comportamiento de compra
-- Usamos RFM simplificado
WITH cliente_metricas AS (
    SELECT 
        cliente_id,
        COUNT(DISTINCT bsale_document_id) as num_compras,
        SUM(total) as total_compras,
        MAX(fecha) as ultima_compra
    FROM bi.fact_ventas
    GROUP BY cliente_id
)
UPDATE bi.dim_clientes c SET 
    total_compras = cm.total_compras,
    num_compras = cm.num_compras,
    segmento = CASE
        WHEN cm.total_compras > 10000000 THEN 'VIP'
        WHEN cm.total_compras > 5000000 THEN 'PREMIUM'
        WHEN cm.total_compras > 1000000 THEN 'FRECUENTE'
        WHEN cm.num_compras > 5 THEN 'REGULAR'
        ELSE 'RETAIL'
    END
FROM cliente_metricas cm
WHERE c.cliente_id = cm.cliente_id;

-- 4. Asignar región a clientes basado en comuna/ciudad
UPDATE bi.dim_clientes c SET region_id = r.region_id
FROM bi.regiones_chile r
WHERE (
    LOWER(c.ciudad) LIKE '%' || LOWER(r.capital) || '%'
    OR LOWER(c.comuna) LIKE '%santiago%' AND r.codigo = 'RM'
    OR LOWER(c.ciudad) LIKE '%antofagasta%' AND r.codigo = 'II'
    OR LOWER(c.ciudad) LIKE '%valparaiso%' AND r.codigo = 'V'
    OR LOWER(c.ciudad) LIKE '%concepcion%' AND r.codigo = 'VIII'
);

-- Default a RM si no se pudo determinar
UPDATE bi.dim_clientes SET region_id = (
    SELECT region_id FROM bi.regiones_chile WHERE codigo = 'RM'
) WHERE region_id IS NULL;

-- 5. Vista: Ventas por región y tipo de cliente (mayorista/minorista)
CREATE OR REPLACE VIEW bi.v_ventas_region_tipo_cliente AS
SELECT 
    COALESCE(r.nombre, 'Sin Región') as region,
    COALESCE(r.zona, 'CENTRO') as zona,
    r.codigo as region_codigo,
    CASE WHEN c.es_mayorista THEN 'MAYORISTA' ELSE 'MINORISTA' END as tipo_cliente,
    c.segmento,
    COUNT(DISTINCT v.bsale_document_id) as num_ventas,
    COUNT(DISTINCT v.cliente_id) as num_clientes,
    SUM(v.cantidad) as unidades,
    SUM(v.total) as total_ventas,
    AVG(v.total)::numeric(15,2) as ticket_promedio,
    SUM(v.total) / NULLIF(COUNT(DISTINCT v.cliente_id), 0) as venta_por_cliente
FROM bi.fact_ventas v
JOIN bi.dim_clientes c ON v.cliente_id = c.cliente_id
LEFT JOIN bi.regiones_chile r ON c.region_id = r.region_id
WHERE v.fecha >= CURRENT_DATE - 90
GROUP BY r.nombre, r.zona, r.codigo, c.es_mayorista, c.segmento
ORDER BY total_ventas DESC;

-- 6. Vista: Resumen mayoristas vs minoristas por zona
CREATE OR REPLACE VIEW bi.v_resumen_mayorista_zona AS
SELECT 
    r.zona,
    CASE WHEN c.es_mayorista THEN 'MAYORISTA' ELSE 'MINORISTA' END as tipo,
    COUNT(DISTINCT c.cliente_id) as num_clientes,
    COUNT(DISTINCT v.bsale_document_id) as num_ventas,
    SUM(v.total) as total_ventas,
    AVG(v.total)::numeric(15,2) as ticket_promedio,
    ROUND(SUM(v.total) * 100.0 / NULLIF(SUM(SUM(v.total)) OVER (PARTITION BY r.zona), 0), 1) as pct_zona
FROM bi.fact_ventas v
JOIN bi.dim_clientes c ON v.cliente_id = c.cliente_id
LEFT JOIN bi.regiones_chile r ON c.region_id = r.region_id
WHERE v.fecha >= CURRENT_DATE - 90
GROUP BY r.zona, c.es_mayorista
ORDER BY r.zona, tipo;

-- 7. Vista: Top clientes mayoristas por región
CREATE OR REPLACE VIEW bi.v_top_mayoristas_region AS
SELECT 
    c.cliente_id,
    c.razon_social,
    c.rut,
    c.segmento,
    COALESCE(r.nombre, 'Sin Región') as region,
    COALESCE(r.zona, 'CENTRO') as zona,
    c.num_compras,
    c.total_compras,
    c.cupo_credito,
    v.ventas_90d,
    v.ultima_compra
FROM bi.dim_clientes c
LEFT JOIN bi.regiones_chile r ON c.region_id = r.region_id
LEFT JOIN (
    SELECT 
        cliente_id,
        SUM(total) as ventas_90d,
        MAX(fecha) as ultima_compra
    FROM bi.fact_ventas
    WHERE fecha >= CURRENT_DATE - 90
    GROUP BY cliente_id
) v ON c.cliente_id = v.cliente_id
WHERE c.es_mayorista = TRUE
ORDER BY v.ventas_90d DESC NULLS LAST;

-- 8. Vista: Distribución geográfica de ventas por segmento
CREATE OR REPLACE VIEW bi.v_mapa_ventas_segmento AS
SELECT 
    r.region_id,
    r.nombre as region,
    r.codigo,
    r.zona,
    r.latitud,
    r.longitud,
    -- Ventas mayoristas
    COALESCE(SUM(v.total) FILTER (WHERE c.es_mayorista), 0) as ventas_mayorista,
    COALESCE(COUNT(DISTINCT v.bsale_document_id) FILTER (WHERE c.es_mayorista), 0) as num_ventas_mayorista,
    COALESCE(COUNT(DISTINCT v.cliente_id) FILTER (WHERE c.es_mayorista), 0) as clientes_mayorista,
    -- Ventas minoristas
    COALESCE(SUM(v.total) FILTER (WHERE NOT c.es_mayorista), 0) as ventas_minorista,
    COALESCE(COUNT(DISTINCT v.bsale_document_id) FILTER (WHERE NOT c.es_mayorista), 0) as num_ventas_minorista,
    COALESCE(COUNT(DISTINCT v.cliente_id) FILTER (WHERE NOT c.es_mayorista), 0) as clientes_minorista,
    -- Totales
    COALESCE(SUM(v.total), 0) as ventas_total,
    -- Porcentaje mayorista
    ROUND(
        COALESCE(SUM(v.total) FILTER (WHERE c.es_mayorista), 0) * 100.0 / 
        NULLIF(SUM(v.total), 0), 1
    ) as pct_mayorista
FROM bi.regiones_chile r
LEFT JOIN bi.dim_clientes c ON c.region_id = r.region_id
LEFT JOIN bi.fact_ventas v ON v.cliente_id = c.cliente_id AND v.fecha >= CURRENT_DATE - 90
GROUP BY r.region_id, r.nombre, r.codigo, r.zona, r.latitud, r.longitud
ORDER BY ventas_total DESC;

-- 9. Vista: Ranking de bodegas por tipo de cliente
CREATE OR REPLACE VIEW bi.v_bodega_tipo_cliente AS
SELECT 
    b.nombre as bodega,
    b.tienda,
    COALESCE(r.nombre, 'Sin Región') as region,
    CASE WHEN c.es_mayorista THEN 'MAYORISTA' ELSE 'MINORISTA' END as tipo_cliente,
    COUNT(DISTINCT v.bsale_document_id) as num_ventas,
    SUM(v.total) as total_ventas,
    AVG(v.total)::numeric(15,2) as ticket_promedio
FROM bi.fact_ventas v
LEFT JOIN bi.dim_bodegas b ON v.bodega_id = b.bodega_id
LEFT JOIN bi.dim_clientes c ON v.cliente_id = c.cliente_id
LEFT JOIN bi.regiones_chile r ON b.region_id = r.region_id
WHERE v.fecha >= CURRENT_DATE - 90
GROUP BY b.nombre, b.tienda, r.nombre, c.es_mayorista
ORDER BY total_ventas DESC;

-- 10. Función para actualizar clasificación de clientes
CREATE OR REPLACE FUNCTION bi.actualizar_clasificacion_clientes()
RETURNS void AS $$
BEGIN
    -- Actualizar métricas de compra
    WITH cliente_metricas AS (
        SELECT 
            cliente_id,
            COUNT(DISTINCT bsale_document_id) as num_compras,
            SUM(total) as total_compras
        FROM bi.fact_ventas
        GROUP BY cliente_id
    )
    UPDATE bi.dim_clientes c SET 
        total_compras = COALESCE(cm.total_compras, 0),
        num_compras = COALESCE(cm.num_compras, 0),
        segmento = CASE
            WHEN COALESCE(cm.total_compras, 0) > 10000000 THEN 'VIP'
            WHEN COALESCE(cm.total_compras, 0) > 5000000 THEN 'PREMIUM'
            WHEN COALESCE(cm.total_compras, 0) > 1000000 THEN 'FRECUENTE'
            WHEN COALESCE(cm.num_compras, 0) > 5 THEN 'REGULAR'
            ELSE 'RETAIL'
        END,
        es_mayorista = CASE 
            WHEN c.tipo_cliente = 'EMPRESA' THEN TRUE
            WHEN c.tiene_credito AND c.cupo_credito > 500000 THEN TRUE
            WHEN COALESCE(cm.total_compras, 0) > 5000000 THEN TRUE
            ELSE FALSE
        END
    FROM cliente_metricas cm
    WHERE c.cliente_id = cm.cliente_id;
END;
$$ LANGUAGE plpgsql;

-- GRANTS
GRANT SELECT ON bi.v_ventas_region_tipo_cliente TO authenticated, anon;
GRANT SELECT ON bi.v_resumen_mayorista_zona TO authenticated, anon;
GRANT SELECT ON bi.v_top_mayoristas_region TO authenticated, anon;
GRANT SELECT ON bi.v_mapa_ventas_segmento TO authenticated, anon;
GRANT SELECT ON bi.v_bodega_tipo_cliente TO authenticated, anon;
GRANT EXECUTE ON FUNCTION bi.actualizar_clasificacion_clientes() TO authenticated, service_role;

-- Ejecutar clasificación inicial
SELECT bi.actualizar_clasificacion_clientes();
