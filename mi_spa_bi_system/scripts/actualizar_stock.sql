-- ============================================================================
-- MI SPA BI SYSTEM - Actualizar Stock desde Ventas
-- Ejecutar en Supabase SQL Editor
-- ============================================================================

-- 1. Insertar fecha de hoy si no existe
INSERT INTO bi.dim_tiempo (fecha, anio, trimestre, mes, semana, dia, dia_semana, nombre_dia, nombre_mes, es_fin_semana)
SELECT CURRENT_DATE, EXTRACT(YEAR FROM CURRENT_DATE)::SMALLINT, EXTRACT(QUARTER FROM CURRENT_DATE)::SMALLINT,
       EXTRACT(MONTH FROM CURRENT_DATE)::SMALLINT, EXTRACT(WEEK FROM CURRENT_DATE)::SMALLINT, 
       EXTRACT(DAY FROM CURRENT_DATE)::SMALLINT, EXTRACT(ISODOW FROM CURRENT_DATE)::SMALLINT,
       TO_CHAR(CURRENT_DATE, 'TMDay'), TO_CHAR(CURRENT_DATE, 'TMMonth'),
       EXTRACT(ISODOW FROM CURRENT_DATE) IN (6, 7)
ON CONFLICT (fecha) DO NOTHING;

-- 2. Calcular stock estimado desde ventas (productos vendidos = tienen stock)
WITH ventas_recientes AS (
    SELECT 
        v.producto_id,
        p.tienda,
        SUM(v.cantidad) as vendido_90d,
        COUNT(DISTINCT v.fecha) as dias_venta
    FROM bi.fact_ventas v
    JOIN bi.dim_productos p ON v.producto_id = p.producto_id
    WHERE v.fecha >= CURRENT_DATE - 90
    AND v.producto_id IS NOT NULL
    GROUP BY v.producto_id, p.tienda
),
stock_estimado AS (
    SELECT 
        producto_id,
        tienda,
        -- Estimar stock: si vende mucho, probablemente tiene stock
        GREATEST(5, LEAST(100, ROUND(vendido_90d * 0.3))) as stock_est
    FROM ventas_recientes
    WHERE vendido_90d > 0
)
-- Actualizar stock_actual en productos con ventas
UPDATE bi.dim_productos p
SET stock_actual = se.stock_est
FROM stock_estimado se
WHERE p.producto_id = se.producto_id;

-- 3. Insertar en fact_stock para hoy
INSERT INTO bi.fact_stock (fecha, producto_id, bodega_id, cantidad, cantidad_disponible)
SELECT 
    CURRENT_DATE,
    p.producto_id,
    CASE 
        WHEN p.tienda = 'EPICBIKE' THEN 5  -- EPICBIKE_MAIN
        ELSE 1  -- CASA_MATRIZ
    END as bodega_id,
    p.stock_actual,
    p.stock_actual
FROM bi.dim_productos p
WHERE p.stock_actual > 0
ON CONFLICT (fecha, producto_id, bodega_id) 
DO UPDATE SET cantidad = EXCLUDED.cantidad, cantidad_disponible = EXCLUDED.cantidad_disponible;

-- 4. Regenerar predicciones
SELECT bi.generar_predicciones();

-- 5. Refrescar vistas materializadas
SELECT bi.refresh_all_materialized_views();

-- 6. Verificar resultados
SELECT '=== STOCK POR TIENDA ===' as info;
SELECT 
    tienda,
    COUNT(*) as productos,
    SUM(stock_actual) as stock_total,
    COUNT(*) FILTER (WHERE stock_actual > 0) as con_stock,
    COUNT(*) FILTER (WHERE stock_actual = 0) as sin_stock
FROM bi.dim_productos
WHERE es_activo = TRUE
GROUP BY tienda;

SELECT '=== FACT_STOCK HOY ===' as info;
SELECT fecha, COUNT(*) as registros, SUM(cantidad) as stock_total
FROM bi.fact_stock
WHERE fecha = CURRENT_DATE
GROUP BY fecha;

SELECT '=== PREDICCIONES ===' as info;
SELECT tienda, periodo, 
       ROUND(valor_actual/1000000, 1) as actual_MM,
       ROUND(valor_predicho/1000000, 1) as predicho_MM,
       tendencia, confianza
FROM bi.predicciones 
ORDER BY tienda, periodo;
