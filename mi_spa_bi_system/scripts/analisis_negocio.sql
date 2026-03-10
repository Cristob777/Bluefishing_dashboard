-- ============================================================================
-- ANÁLISIS PROFUNDO DE MI TIENDA SPA
-- Estructura: EPICBIKE + BLUEFISHING operando desde Casa Matriz
-- ============================================================================

-- ============================================================================
-- 1. RESUMEN DE BODEGAS/CANALES DE VENTA
-- ============================================================================
SELECT 
    '=== RESUMEN DE BODEGAS ===' as seccion;

SELECT 
    b.bodega_id,
    b.nombre as bodega,
    b.tienda as marca_principal,
    b.ciudad,
    COUNT(DISTINCT fs.producto_id) as productos_con_stock,
    COALESCE(SUM(fs.cantidad), 0) as stock_total,
    COALESCE(SUM(fs.cantidad * p.precio_venta), 0) as valor_stock_venta
FROM bi.dim_bodegas b
LEFT JOIN bi.fact_stock fs ON b.bodega_id = fs.bodega_id 
    AND fs.fecha = (SELECT MAX(fecha) FROM bi.fact_stock)
LEFT JOIN bi.dim_productos p ON fs.producto_id = p.producto_id
WHERE b.es_activa = true
GROUP BY b.bodega_id, b.nombre, b.tienda, b.ciudad
ORDER BY valor_stock_venta DESC;

-- ============================================================================
-- 2. VENTAS TOTALES POR BODEGA (ÚLTIMOS 12 MESES)
-- ============================================================================
SELECT 
    '=== VENTAS POR BODEGA (12 MESES) ===' as seccion;

SELECT 
    b.nombre as bodega,
    b.tienda as marca,
    COUNT(DISTINCT v.bsale_document_id) as num_facturas,
    SUM(v.cantidad) as unidades_vendidas,
    SUM(v.total) as venta_total,
    ROUND(AVG(v.total)::numeric, 0) as ticket_promedio,
    ROUND((SUM(v.total) * 100.0 / NULLIF(SUM(SUM(v.total)) OVER (), 0))::numeric, 2) as pct_del_total
FROM bi.fact_ventas v
JOIN bi.dim_bodegas b ON v.bodega_id = b.bodega_id
WHERE v.fecha >= CURRENT_DATE - 365
GROUP BY b.bodega_id, b.nombre, b.tienda
ORDER BY venta_total DESC;

-- ============================================================================
-- 3. PRODUCTOS POR MARCA Y BODEGA
-- ============================================================================
SELECT 
    '=== PRODUCTOS POR MARCA Y BODEGA ===' as seccion;

-- Cantidad de productos únicos por marca
SELECT 
    tienda as marca,
    COUNT(*) as total_productos,
    COUNT(*) FILTER (WHERE es_activo = true) as productos_activos,
    COUNT(DISTINCT categoria_id) as categorias
FROM bi.dim_productos
GROUP BY tienda;

-- ============================================================================
-- 4. VENTAS CRUZADAS: ¿QUÉ MARCAS SE VENDEN EN CADA BODEGA?
-- ============================================================================
SELECT 
    '=== MATRIZ BODEGA x MARCA ===' as seccion;

SELECT 
    b.nombre as bodega,
    p.tienda as marca_producto,
    COUNT(DISTINCT v.bsale_document_id) as transacciones,
    SUM(v.cantidad) as unidades,
    SUM(v.total) as venta_total
FROM bi.fact_ventas v
JOIN bi.dim_bodegas b ON v.bodega_id = b.bodega_id
JOIN bi.dim_productos p ON v.producto_id = p.producto_id
WHERE v.fecha >= CURRENT_DATE - 365
GROUP BY b.nombre, p.tienda
ORDER BY b.nombre, venta_total DESC;

-- ============================================================================
-- 5. DETALLE CASA MATRIZ (BODEGA PRINCIPAL)
-- ============================================================================
SELECT 
    '=== DETALLE CASA MATRIZ ===' as seccion;

SELECT 
    p.tienda as marca,
    c.nivel1_nombre as categoria,
    COUNT(DISTINCT p.producto_id) as productos,
    COUNT(DISTINCT v.bsale_document_id) as ventas,
    SUM(v.total) as total_vendido,
    COALESCE(SUM(fs.cantidad), 0) as stock_actual
FROM bi.dim_bodegas b
LEFT JOIN bi.fact_stock fs ON b.bodega_id = fs.bodega_id 
    AND fs.fecha = (SELECT MAX(fecha) FROM bi.fact_stock)
LEFT JOIN bi.dim_productos p ON fs.producto_id = p.producto_id
LEFT JOIN bi.dim_categorias c ON p.categoria_id = c.categoria_id
LEFT JOIN bi.fact_ventas v ON p.producto_id = v.producto_id 
    AND v.bodega_id = b.bodega_id 
    AND v.fecha >= CURRENT_DATE - 365
WHERE b.nombre ILIKE '%casa matriz%'
GROUP BY p.tienda, c.nivel1_nombre
ORDER BY p.tienda, total_vendido DESC NULLS LAST;

-- ============================================================================
-- 6. DETALLE CURANIPE (SOLO PESCA)
-- ============================================================================
SELECT 
    '=== DETALLE CURANIPE (SOLO BLUEFISHING) ===' as seccion;

SELECT 
    p.tienda as marca,
    c.nivel1_nombre as categoria,
    COUNT(DISTINCT p.producto_id) as productos,
    SUM(v.cantidad) as unidades_vendidas,
    SUM(v.total) as total_vendido
FROM bi.fact_ventas v
JOIN bi.dim_bodegas b ON v.bodega_id = b.bodega_id
JOIN bi.dim_productos p ON v.producto_id = p.producto_id
LEFT JOIN bi.dim_categorias c ON p.categoria_id = c.categoria_id
WHERE b.nombre ILIKE '%curanipe%'
    AND v.fecha >= CURRENT_DATE - 365
GROUP BY p.tienda, c.nivel1_nombre
ORDER BY total_vendido DESC;

-- ============================================================================
-- 7. COMPARATIVO MENSUAL POR BODEGA
-- ============================================================================
SELECT 
    '=== VENTAS MENSUALES POR BODEGA ===' as seccion;

SELECT 
    TO_CHAR(v.fecha, 'YYYY-MM') as mes,
    b.nombre as bodega,
    SUM(v.total) as venta_total,
    COUNT(DISTINCT v.bsale_document_id) as facturas
FROM bi.fact_ventas v
JOIN bi.dim_bodegas b ON v.bodega_id = b.bodega_id
WHERE v.fecha >= CURRENT_DATE - 180
GROUP BY TO_CHAR(v.fecha, 'YYYY-MM'), b.nombre
ORDER BY mes DESC, venta_total DESC;

-- ============================================================================
-- 8. TOP 10 PRODUCTOS POR BODEGA
-- ============================================================================
SELECT 
    '=== TOP 10 PRODUCTOS POR BODEGA ===' as seccion;

WITH ranked AS (
    SELECT 
        b.nombre as bodega,
        p.tienda as marca,
        p.nombre as producto,
        p.sku,
        SUM(v.cantidad) as unidades,
        SUM(v.total) as venta_total,
        ROW_NUMBER() OVER (PARTITION BY b.bodega_id ORDER BY SUM(v.total) DESC) as rn
    FROM bi.fact_ventas v
    JOIN bi.dim_bodegas b ON v.bodega_id = b.bodega_id
    JOIN bi.dim_productos p ON v.producto_id = p.producto_id
    WHERE v.fecha >= CURRENT_DATE - 90
    GROUP BY b.bodega_id, b.nombre, p.tienda, p.producto_id, p.nombre, p.sku
)
SELECT bodega, marca, producto, sku, unidades, venta_total
FROM ranked
WHERE rn <= 5
ORDER BY bodega, venta_total DESC;

-- ============================================================================
-- 9. PRODUCTOS SIN MOVIMIENTO POR BODEGA
-- ============================================================================
SELECT 
    '=== PRODUCTOS SIN VENTA (>60 DÍAS) ===' as seccion;

SELECT 
    b.nombre as bodega,
    p.tienda as marca,
    COUNT(*) as productos_sin_movimiento,
    SUM(fs.cantidad) as stock_parado,
    SUM(fs.cantidad * p.precio_venta) as valor_stock_parado
FROM bi.fact_stock fs
JOIN bi.dim_bodegas b ON fs.bodega_id = b.bodega_id
JOIN bi.dim_productos p ON fs.producto_id = p.producto_id
LEFT JOIN bi.fact_ventas v ON p.producto_id = v.producto_id 
    AND v.fecha >= CURRENT_DATE - 60
WHERE fs.fecha = (SELECT MAX(fecha) FROM bi.fact_stock)
    AND fs.cantidad > 0
    AND v.producto_id IS NULL
GROUP BY b.bodega_id, b.nombre, p.tienda
ORDER BY valor_stock_parado DESC NULLS LAST;

-- ============================================================================
-- 10. RESUMEN EJECUTIVO MI TIENDA SPA
-- ============================================================================
SELECT 
    '=== RESUMEN EJECUTIVO ===' as seccion;

SELECT 
    'BLUEFISHING' as marca,
    (SELECT COUNT(*) FROM bi.dim_productos WHERE tienda = 'BLUEFISHING') as productos,
    (SELECT SUM(total) FROM bi.fact_ventas WHERE tienda = 'BLUEFISHING' AND fecha >= CURRENT_DATE - 30) as ventas_30d,
    (SELECT SUM(total) FROM bi.fact_ventas WHERE tienda = 'BLUEFISHING' AND fecha >= CURRENT_DATE - 365) as ventas_anual
UNION ALL
SELECT 
    'EPICBIKE' as marca,
    (SELECT COUNT(*) FROM bi.dim_productos WHERE tienda = 'EPICBIKE') as productos,
    (SELECT SUM(total) FROM bi.fact_ventas WHERE tienda = 'EPICBIKE' AND fecha >= CURRENT_DATE - 30) as ventas_30d,
    (SELECT SUM(total) FROM bi.fact_ventas WHERE tienda = 'EPICBIKE' AND fecha >= CURRENT_DATE - 365) as ventas_anual
UNION ALL
SELECT 
    'TOTAL MI TIENDA SPA' as marca,
    (SELECT COUNT(*) FROM bi.dim_productos) as productos,
    (SELECT SUM(total) FROM bi.fact_ventas WHERE fecha >= CURRENT_DATE - 30) as ventas_30d,
    (SELECT SUM(total) FROM bi.fact_ventas WHERE fecha >= CURRENT_DATE - 365) as ventas_anual;
