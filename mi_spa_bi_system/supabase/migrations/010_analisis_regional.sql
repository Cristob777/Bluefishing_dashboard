-- ============================================================================
-- MI SPA BI SYSTEM - Análisis Regional
-- Ventas por región, productos por región, clientes por región
-- ============================================================================

-- Vista: Ventas por región/ciudad
CREATE OR REPLACE VIEW bi.v_ventas_por_region AS
SELECT 
    COALESCE(c.ciudad, c.comuna, 'Sin Ciudad') as region,
    COALESCE(c.comuna, 'Sin Comuna') as comuna,
    v.tienda,
    COUNT(DISTINCT v.bsale_document_id) as num_ventas,
    COUNT(DISTINCT v.cliente_id) as num_clientes,
    SUM(v.total) as venta_total,
    SUM(v.cantidad) as unidades_vendidas,
    AVG(v.total) as ticket_promedio
FROM bi.fact_ventas v
LEFT JOIN bi.dim_clientes c ON v.cliente_id = c.cliente_id
GROUP BY COALESCE(c.ciudad, c.comuna, 'Sin Ciudad'), COALESCE(c.comuna, 'Sin Comuna'), v.tienda
ORDER BY venta_total DESC;

-- Vista: Top regiones
CREATE OR REPLACE VIEW bi.v_top_regiones AS
SELECT 
    COALESCE(c.ciudad, c.comuna, 'Sin Ciudad') as region,
    COUNT(DISTINCT v.cliente_id) as clientes_activos,
    COUNT(DISTINCT v.bsale_document_id) as total_ventas,
    SUM(v.total) as venta_total,
    ROUND(AVG(v.total), 0) as ticket_promedio,
    RANK() OVER (ORDER BY SUM(v.total) DESC) as ranking
FROM bi.fact_ventas v
LEFT JOIN bi.dim_clientes c ON v.cliente_id = c.cliente_id
GROUP BY COALESCE(c.ciudad, c.comuna, 'Sin Ciudad')
ORDER BY venta_total DESC;

-- Vista: Productos más vendidos por región
CREATE OR REPLACE VIEW bi.v_productos_por_region AS
SELECT 
    COALESCE(c.ciudad, c.comuna, 'Sin Ciudad') as region,
    p.tienda,
    cat.nivel1_nombre as categoria,
    p.producto_id,
    p.nombre as producto,
    SUM(v.cantidad) as unidades,
    SUM(v.total) as venta_total,
    RANK() OVER (PARTITION BY COALESCE(c.ciudad, c.comuna, 'Sin Ciudad') ORDER BY SUM(v.total) DESC) as rank_en_region
FROM bi.fact_ventas v
JOIN bi.dim_productos p ON v.producto_id = p.producto_id
LEFT JOIN bi.dim_categorias cat ON p.categoria_id = cat.categoria_id
LEFT JOIN bi.dim_clientes c ON v.cliente_id = c.cliente_id
GROUP BY COALESCE(c.ciudad, c.comuna, 'Sin Ciudad'), p.tienda, cat.nivel1_nombre, p.producto_id, p.nombre;

-- Vista: Clientes top por región
CREATE OR REPLACE VIEW bi.v_clientes_por_region AS
SELECT 
    COALESCE(c.ciudad, c.comuna, 'Sin Ciudad') as region,
    c.cliente_id,
    c.razon_social,
    c.email,
    v.tienda,
    COUNT(DISTINCT v.bsale_document_id) as num_compras,
    SUM(v.total) as total_comprado,
    MAX(v.fecha) as ultima_compra,
    RANK() OVER (PARTITION BY COALESCE(c.ciudad, c.comuna, 'Sin Ciudad') ORDER BY SUM(v.total) DESC) as rank_en_region
FROM bi.dim_clientes c
JOIN bi.fact_ventas v ON c.cliente_id = v.cliente_id
GROUP BY COALESCE(c.ciudad, c.comuna, 'Sin Ciudad'), c.cliente_id, c.razon_social, c.email, v.tienda;

-- Vista: Categorías por región
CREATE OR REPLACE VIEW bi.v_categorias_por_region AS
SELECT 
    COALESCE(c.ciudad, c.comuna, 'Sin Ciudad') as region,
    cat.nivel1_nombre as categoria,
    p.tienda,
    COUNT(DISTINCT p.producto_id) as productos_vendidos,
    SUM(v.cantidad) as unidades,
    SUM(v.total) as venta_total,
    ROUND(100.0 * SUM(v.total) / NULLIF(SUM(SUM(v.total)) OVER (PARTITION BY COALESCE(c.ciudad, c.comuna, 'Sin Ciudad')), 0), 1) as porcentaje_region
FROM bi.fact_ventas v
JOIN bi.dim_productos p ON v.producto_id = p.producto_id
LEFT JOIN bi.dim_categorias cat ON p.categoria_id = cat.categoria_id
LEFT JOIN bi.dim_clientes c ON v.cliente_id = c.cliente_id
GROUP BY COALESCE(c.ciudad, c.comuna, 'Sin Ciudad'), cat.nivel1_nombre, p.tienda
ORDER BY region, venta_total DESC;

-- Vista: Resumen ejecutivo por región
CREATE OR REPLACE VIEW bi.v_resumen_regional AS
SELECT 
    region,
    SUM(CASE WHEN tienda = 'EPICBIKE' THEN venta_total ELSE 0 END) as ventas_epicbike,
    SUM(CASE WHEN tienda = 'BLUEFISHING' THEN venta_total ELSE 0 END) as ventas_bluefishing,
    SUM(venta_total) as venta_total,
    SUM(num_clientes) as total_clientes,
    SUM(num_ventas) as total_ventas
FROM bi.v_ventas_por_region
GROUP BY region
ORDER BY venta_total DESC;

-- Vista: Mapa de calor ventas por día y región
CREATE OR REPLACE VIEW bi.v_heatmap_regional AS
SELECT 
    COALESCE(c.ciudad, c.comuna, 'Sin Ciudad') as region,
    EXTRACT(DOW FROM v.fecha) as dia_semana,
    TO_CHAR(v.fecha, 'Dy') as dia_nombre,
    v.tienda,
    SUM(v.total) as venta_total,
    COUNT(*) as num_transacciones
FROM bi.fact_ventas v
LEFT JOIN bi.dim_clientes c ON v.cliente_id = c.cliente_id
GROUP BY COALESCE(c.ciudad, c.comuna, 'Sin Ciudad'), EXTRACT(DOW FROM v.fecha), TO_CHAR(v.fecha, 'Dy'), v.tienda;

-- Grants
GRANT SELECT ON bi.v_ventas_por_region TO authenticated, anon;
GRANT SELECT ON bi.v_top_regiones TO authenticated, anon;
GRANT SELECT ON bi.v_productos_por_region TO authenticated, anon;
GRANT SELECT ON bi.v_clientes_por_region TO authenticated, anon;
GRANT SELECT ON bi.v_categorias_por_region TO authenticated, anon;
GRANT SELECT ON bi.v_resumen_regional TO authenticated, anon;
GRANT SELECT ON bi.v_heatmap_regional TO authenticated, anon;

