-- ============================================================================
-- MI SPA BI SYSTEM - Métricas Avanzadas de BI
-- Vistas para análisis profundo de negocio
-- ============================================================================

-- ============================================================================
-- 1. ANÁLISIS DE VENTAS AVANZADO
-- ============================================================================

-- Vista: Ventas por día de semana
CREATE OR REPLACE VIEW bi.v_ventas_por_dia_semana AS
SELECT 
    tienda,
    EXTRACT(DOW FROM fecha) as dia_semana,
    CASE EXTRACT(DOW FROM fecha)
        WHEN 0 THEN 'Domingo'
        WHEN 1 THEN 'Lunes'
        WHEN 2 THEN 'Martes'
        WHEN 3 THEN 'Miércoles'
        WHEN 4 THEN 'Jueves'
        WHEN 5 THEN 'Viernes'
        WHEN 6 THEN 'Sábado'
    END as nombre_dia,
    COUNT(DISTINCT bsale_document_id) as num_transacciones,
    SUM(cantidad) as unidades,
    SUM(total) as venta_total,
    AVG(total) as ticket_promedio
FROM bi.fact_ventas
WHERE fecha >= CURRENT_DATE - 90
GROUP BY tienda, EXTRACT(DOW FROM fecha)
ORDER BY tienda, dia_semana;

-- Vista: Tendencia de ventas (diaria, últimos 30 días)
CREATE OR REPLACE VIEW bi.v_tendencia_ventas AS
SELECT 
    fecha,
    tienda,
    COUNT(DISTINCT bsale_document_id) as transacciones,
    SUM(cantidad) as unidades,
    SUM(total) as venta_total,
    SUM(total) / NULLIF(COUNT(DISTINCT bsale_document_id), 0) as ticket_promedio,
    SUM(SUM(total)) OVER (PARTITION BY tienda ORDER BY fecha ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) / 7 as promedio_movil_7d
FROM bi.fact_ventas
WHERE fecha >= CURRENT_DATE - 30
GROUP BY fecha, tienda
ORDER BY fecha DESC, tienda;

-- Vista: Comparativo MoM (Mes vs Mes anterior)
CREATE OR REPLACE VIEW bi.v_comparativo_mom AS
WITH ventas_mes AS (
    SELECT 
        tienda,
        DATE_TRUNC('month', fecha) as mes,
        SUM(total) as venta_total,
        COUNT(DISTINCT bsale_document_id) as transacciones,
        SUM(cantidad) as unidades
    FROM bi.fact_ventas
    GROUP BY tienda, DATE_TRUNC('month', fecha)
)
SELECT 
    v.tienda,
    v.mes,
    v.venta_total,
    v.transacciones,
    LAG(v.venta_total) OVER (PARTITION BY v.tienda ORDER BY v.mes) as venta_mes_anterior,
    ROUND(((v.venta_total - LAG(v.venta_total) OVER (PARTITION BY v.tienda ORDER BY v.mes)) / 
           NULLIF(LAG(v.venta_total) OVER (PARTITION BY v.tienda ORDER BY v.mes), 0) * 100)::numeric, 2) as variacion_pct
FROM ventas_mes v
ORDER BY v.tienda, v.mes DESC;

-- Vista: Top productos por venta
CREATE OR REPLACE VIEW bi.v_top_productos_detalle AS
SELECT 
    p.producto_id,
    p.sku,
    p.nombre,
    p.tienda,
    c.nivel1_nombre as categoria,
    COUNT(DISTINCT v.bsale_document_id) as num_ventas,
    SUM(v.cantidad) as unidades_vendidas,
    SUM(v.total) as venta_total,
    AVG(v.precio_unitario) as precio_promedio,
    RANK() OVER (PARTITION BY p.tienda ORDER BY SUM(v.total) DESC) as ranking_tienda
FROM bi.dim_productos p
LEFT JOIN bi.fact_ventas v ON p.producto_id = v.producto_id AND v.fecha >= CURRENT_DATE - 30
LEFT JOIN bi.dim_categorias c ON p.categoria_id = c.categoria_id
GROUP BY p.producto_id, p.sku, p.nombre, p.tienda, c.nivel1_nombre
ORDER BY venta_total DESC NULLS LAST;

-- Vista: Productos sin movimiento
CREATE OR REPLACE VIEW bi.v_productos_sin_movimiento AS
SELECT 
    p.producto_id,
    p.sku,
    p.nombre,
    p.tienda,
    p.precio_venta,
    COALESCE(s.cantidad, 0) as stock_actual,
    MAX(v.fecha) as ultima_venta,
    CURRENT_DATE - MAX(v.fecha) as dias_sin_venta
FROM bi.dim_productos p
LEFT JOIN bi.fact_ventas v ON p.producto_id = v.producto_id
LEFT JOIN (
    SELECT producto_id, SUM(cantidad) as cantidad 
    FROM bi.fact_stock 
    WHERE fecha = (SELECT MAX(fecha) FROM bi.fact_stock)
    GROUP BY producto_id
) s ON p.producto_id = s.producto_id
WHERE p.es_activo = TRUE
GROUP BY p.producto_id, p.sku, p.nombre, p.tienda, p.precio_venta, s.cantidad
HAVING MAX(v.fecha) < CURRENT_DATE - 30 OR MAX(v.fecha) IS NULL
ORDER BY dias_sin_venta DESC NULLS FIRST;

-- ============================================================================
-- 2. ANÁLISIS DE CLIENTES (RFM)
-- ============================================================================

-- Vista: Análisis RFM de clientes
CREATE OR REPLACE VIEW bi.v_clientes_rfm AS
WITH cliente_metricas AS (
    SELECT 
        c.cliente_id,
        c.razon_social,
        c.rut,
        v.tienda,
        MAX(v.fecha) as ultima_compra,
        COUNT(DISTINCT v.bsale_document_id) as frecuencia,
        SUM(v.total) as monetario,
        CURRENT_DATE - MAX(v.fecha) as dias_desde_ultima
    FROM bi.dim_clientes c
    JOIN bi.fact_ventas v ON c.cliente_id = v.cliente_id
    WHERE v.fecha >= CURRENT_DATE - 365
    GROUP BY c.cliente_id, c.razon_social, c.rut, v.tienda
),
rfm_scores AS (
    SELECT *,
        NTILE(5) OVER (PARTITION BY tienda ORDER BY dias_desde_ultima DESC) as r_score,
        NTILE(5) OVER (PARTITION BY tienda ORDER BY frecuencia ASC) as f_score,
        NTILE(5) OVER (PARTITION BY tienda ORDER BY monetario ASC) as m_score
    FROM cliente_metricas
)
SELECT 
    *,
    r_score + f_score + m_score as rfm_total,
    CASE 
        WHEN r_score >= 4 AND f_score >= 4 AND m_score >= 4 THEN 'Champions'
        WHEN r_score >= 4 AND f_score >= 3 THEN 'Loyal'
        WHEN r_score >= 4 AND m_score >= 4 THEN 'Big Spenders'
        WHEN r_score >= 3 AND f_score <= 2 THEN 'Promising'
        WHEN r_score <= 2 AND f_score >= 4 THEN 'At Risk'
        WHEN r_score <= 2 AND f_score <= 2 AND m_score >= 3 THEN 'Cant Lose'
        WHEN r_score <= 2 THEN 'Lost'
        ELSE 'Regular'
    END as segmento
FROM rfm_scores;

-- Vista: Resumen de segmentos de clientes
CREATE OR REPLACE VIEW bi.v_segmentos_clientes AS
SELECT 
    tienda,
    segmento,
    COUNT(*) as num_clientes,
    SUM(monetario) as valor_total,
    AVG(frecuencia) as frecuencia_promedio,
    AVG(dias_desde_ultima) as dias_promedio_inactivo
FROM bi.v_clientes_rfm
GROUP BY tienda, segmento
ORDER BY tienda, valor_total DESC;

-- Vista: Top clientes por valor
CREATE OR REPLACE VIEW bi.v_top_clientes AS
SELECT 
    c.cliente_id,
    c.razon_social,
    c.rut,
    v.tienda,
    COUNT(DISTINCT v.bsale_document_id) as compras,
    SUM(v.total) as total_compras,
    AVG(v.total) as ticket_promedio,
    MAX(v.fecha) as ultima_compra,
    MIN(v.fecha) as primera_compra,
    RANK() OVER (PARTITION BY v.tienda ORDER BY SUM(v.total) DESC) as ranking
FROM bi.dim_clientes c
JOIN bi.fact_ventas v ON c.cliente_id = v.cliente_id
WHERE v.fecha >= CURRENT_DATE - 365
GROUP BY c.cliente_id, c.razon_social, c.rut, v.tienda
ORDER BY total_compras DESC;

-- ============================================================================
-- 3. ANÁLISIS DE INVENTARIO AVANZADO
-- ============================================================================

-- Vista: Rotación de inventario
CREATE OR REPLACE VIEW bi.v_rotacion_inventario AS
WITH ventas_90d AS (
    SELECT producto_id, SUM(cantidad) as vendido_90d
    FROM bi.fact_ventas
    WHERE fecha >= CURRENT_DATE - 90
    GROUP BY producto_id
),
stock_actual AS (
    SELECT producto_id, SUM(cantidad) as stock
    FROM bi.fact_stock
    WHERE fecha = (SELECT MAX(fecha) FROM bi.fact_stock)
    GROUP BY producto_id
)
SELECT 
    p.producto_id,
    p.sku,
    p.nombre,
    p.tienda,
    c.nivel1_nombre as categoria,
    COALESCE(s.stock, 0) as stock_actual,
    COALESCE(v.vendido_90d, 0) as vendido_90d,
    CASE 
        WHEN COALESCE(s.stock, 0) = 0 THEN NULL
        ELSE ROUND((COALESCE(v.vendido_90d, 0)::numeric / 90), 2)
    END as venta_diaria_promedio,
    CASE 
        WHEN COALESCE(v.vendido_90d, 0) = 0 THEN 999
        ELSE ROUND(COALESCE(s.stock, 0)::numeric / (COALESCE(v.vendido_90d, 0)::numeric / 90), 0)
    END as dias_cobertura,
    CASE 
        WHEN COALESCE(s.stock, 0) = 0 AND COALESCE(v.vendido_90d, 0) > 0 THEN 'QUIEBRE'
        WHEN COALESCE(v.vendido_90d, 0) = 0 THEN 'SIN MOVIMIENTO'
        WHEN COALESCE(s.stock, 0)::numeric / (COALESCE(v.vendido_90d, 0)::numeric / 90) < 7 THEN 'CRITICO'
        WHEN COALESCE(s.stock, 0)::numeric / (COALESCE(v.vendido_90d, 0)::numeric / 90) < 14 THEN 'BAJO'
        WHEN COALESCE(s.stock, 0)::numeric / (COALESCE(v.vendido_90d, 0)::numeric / 90) > 90 THEN 'EXCESO'
        ELSE 'OK'
    END as estado_stock
FROM bi.dim_productos p
LEFT JOIN stock_actual s ON p.producto_id = s.producto_id
LEFT JOIN ventas_90d v ON p.producto_id = v.producto_id
LEFT JOIN bi.dim_categorias c ON p.categoria_id = c.categoria_id
WHERE p.es_activo = TRUE
ORDER BY dias_cobertura ASC NULLS LAST;

-- Vista: Análisis ABC de productos
CREATE OR REPLACE VIEW bi.v_abc_productos AS
WITH ventas_producto AS (
    SELECT 
        p.producto_id,
        p.sku,
        p.nombre,
        p.tienda,
        SUM(v.total) as venta_total
    FROM bi.dim_productos p
    LEFT JOIN bi.fact_ventas v ON p.producto_id = v.producto_id AND v.fecha >= CURRENT_DATE - 90
    WHERE p.es_activo = TRUE
    GROUP BY p.producto_id, p.sku, p.nombre, p.tienda
),
ventas_acumuladas AS (
    SELECT *,
        SUM(venta_total) OVER (PARTITION BY tienda ORDER BY venta_total DESC) as venta_acumulada,
        SUM(venta_total) OVER (PARTITION BY tienda) as venta_total_tienda
    FROM ventas_producto
)
SELECT *,
    ROUND((venta_acumulada / NULLIF(venta_total_tienda, 0) * 100)::numeric, 2) as pct_acumulado,
    CASE 
        WHEN venta_acumulada / NULLIF(venta_total_tienda, 0) <= 0.8 THEN 'A'
        WHEN venta_acumulada / NULLIF(venta_total_tienda, 0) <= 0.95 THEN 'B'
        ELSE 'C'
    END as clase_abc
FROM ventas_acumuladas
ORDER BY tienda, venta_total DESC;

-- Vista: Resumen ABC por tienda
CREATE OR REPLACE VIEW bi.v_resumen_abc AS
SELECT 
    tienda,
    clase_abc,
    COUNT(*) as num_productos,
    SUM(venta_total) as venta_total,
    ROUND(AVG(venta_total)::numeric, 0) as venta_promedio
FROM bi.v_abc_productos
GROUP BY tienda, clase_abc
ORDER BY tienda, clase_abc;

-- Vista: Stock por bodega y tienda
CREATE OR REPLACE VIEW bi.v_stock_por_bodega AS
SELECT 
    b.nombre as bodega,
    p.tienda,
    COUNT(DISTINCT s.producto_id) as productos_distintos,
    SUM(s.cantidad) as unidades_totales,
    SUM(s.cantidad * p.precio_venta) as valor_inventario
FROM bi.fact_stock s
JOIN bi.dim_productos p ON s.producto_id = p.producto_id
JOIN bi.dim_bodegas b ON s.bodega_id = b.bodega_id
WHERE s.fecha = (SELECT MAX(fecha) FROM bi.fact_stock)
GROUP BY b.nombre, p.tienda
ORDER BY valor_inventario DESC;

-- ============================================================================
-- 4. RESUMEN EJECUTIVO MEJORADO
-- ============================================================================

-- Vista: KPIs principales por tienda
CREATE OR REPLACE VIEW bi.v_kpis_tienda AS
SELECT 
    tienda,
    -- Ventas 30 días
    SUM(CASE WHEN fecha >= CURRENT_DATE - 30 THEN total ELSE 0 END) as ventas_30d,
    SUM(CASE WHEN fecha >= CURRENT_DATE - 60 AND fecha < CURRENT_DATE - 30 THEN total ELSE 0 END) as ventas_30d_anterior,
    -- Variación
    ROUND(((SUM(CASE WHEN fecha >= CURRENT_DATE - 30 THEN total ELSE 0 END) - 
            SUM(CASE WHEN fecha >= CURRENT_DATE - 60 AND fecha < CURRENT_DATE - 30 THEN total ELSE 0 END)) /
           NULLIF(SUM(CASE WHEN fecha >= CURRENT_DATE - 60 AND fecha < CURRENT_DATE - 30 THEN total ELSE 0 END), 0) * 100)::numeric, 1) as variacion_pct,
    -- Transacciones
    COUNT(DISTINCT CASE WHEN fecha >= CURRENT_DATE - 30 THEN bsale_document_id END) as transacciones_30d,
    -- Ticket promedio
    ROUND((SUM(CASE WHEN fecha >= CURRENT_DATE - 30 THEN total ELSE 0 END) /
           NULLIF(COUNT(DISTINCT CASE WHEN fecha >= CURRENT_DATE - 30 THEN bsale_document_id END), 0))::numeric, 0) as ticket_promedio,
    -- Unidades
    SUM(CASE WHEN fecha >= CURRENT_DATE - 30 THEN cantidad ELSE 0 END) as unidades_30d,
    -- Clientes únicos
    COUNT(DISTINCT CASE WHEN fecha >= CURRENT_DATE - 30 THEN cliente_id END) as clientes_unicos
FROM bi.fact_ventas
GROUP BY tienda;

-- ============================================================================
-- 5. GRANTS
-- ============================================================================

GRANT SELECT ON bi.v_ventas_por_dia_semana TO authenticated, anon;
GRANT SELECT ON bi.v_tendencia_ventas TO authenticated, anon;
GRANT SELECT ON bi.v_comparativo_mom TO authenticated, anon;
GRANT SELECT ON bi.v_top_productos_detalle TO authenticated, anon;
GRANT SELECT ON bi.v_productos_sin_movimiento TO authenticated, anon;
GRANT SELECT ON bi.v_clientes_rfm TO authenticated, anon;
GRANT SELECT ON bi.v_segmentos_clientes TO authenticated, anon;
GRANT SELECT ON bi.v_top_clientes TO authenticated, anon;
GRANT SELECT ON bi.v_rotacion_inventario TO authenticated, anon;
GRANT SELECT ON bi.v_abc_productos TO authenticated, anon;
GRANT SELECT ON bi.v_resumen_abc TO authenticated, anon;
GRANT SELECT ON bi.v_stock_por_bodega TO authenticated, anon;
GRANT SELECT ON bi.v_kpis_tienda TO authenticated, anon;

