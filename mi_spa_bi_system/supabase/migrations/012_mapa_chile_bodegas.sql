-- ============================================================================
-- MI SPA BI SYSTEM - Mapa de Chile y Análisis Geográfico
-- Ejecutado: 2026-01-21
-- ============================================================================

-- 1. Agregar columnas geográficas a dim_bodegas
ALTER TABLE bi.dim_bodegas ADD COLUMN IF NOT EXISTS ciudad VARCHAR(100);
ALTER TABLE bi.dim_bodegas ADD COLUMN IF NOT EXISTS comuna VARCHAR(100);
ALTER TABLE bi.dim_bodegas ADD COLUMN IF NOT EXISTS direccion VARCHAR(255);
ALTER TABLE bi.dim_bodegas ADD COLUMN IF NOT EXISTS latitud NUMERIC(10,6);
ALTER TABLE bi.dim_bodegas ADD COLUMN IF NOT EXISTS longitud NUMERIC(10,6);
ALTER TABLE bi.dim_bodegas ADD COLUMN IF NOT EXISTS region_id INTEGER;

-- 2. Tabla de regiones de Chile con coordenadas
DROP TABLE IF EXISTS bi.regiones_chile CASCADE;
CREATE TABLE bi.regiones_chile (
    region_id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    codigo VARCHAR(10),
    capital VARCHAR(100),
    latitud NUMERIC(10,6),
    longitud NUMERIC(10,6),
    zona VARCHAR(20)
);

INSERT INTO bi.regiones_chile (nombre, codigo, capital, latitud, longitud, zona) VALUES
    ('Arica y Parinacota', 'XV', 'Arica', -18.4783, -70.3126, 'NORTE'),
    ('Tarapacá', 'I', 'Iquique', -20.2208, -70.1431, 'NORTE'),
    ('Antofagasta', 'II', 'Antofagasta', -23.6509, -70.3975, 'NORTE'),
    ('Atacama', 'III', 'Copiapó', -27.3668, -70.3323, 'NORTE'),
    ('Coquimbo', 'IV', 'La Serena', -29.9027, -71.2519, 'NORTE'),
    ('Valparaíso', 'V', 'Valparaíso', -33.0458, -71.6197, 'CENTRO'),
    ('Metropolitana', 'RM', 'Santiago', -33.4489, -70.6693, 'CENTRO'),
    ('OHiggins', 'VI', 'Rancagua', -34.1708, -70.7444, 'CENTRO'),
    ('Maule', 'VII', 'Talca', -35.4264, -71.6554, 'CENTRO'),
    ('Ñuble', 'XVI', 'Chillán', -36.6063, -72.1034, 'SUR'),
    ('Biobío', 'VIII', 'Concepción', -36.8201, -73.0444, 'SUR'),
    ('Araucanía', 'IX', 'Temuco', -38.7359, -72.5904, 'SUR'),
    ('Los Ríos', 'XIV', 'Valdivia', -39.8142, -73.2459, 'SUR'),
    ('Los Lagos', 'X', 'Puerto Montt', -41.4693, -72.9424, 'SUR'),
    ('Aysén', 'XI', 'Coyhaique', -45.5752, -72.0662, 'SUR'),
    ('Magallanes', 'XII', 'Punta Arenas', -53.1638, -70.9171, 'SUR');

-- 3. Actualizar bodegas con ubicación (todas en RM por defecto)
UPDATE bi.dim_bodegas SET 
    ciudad = 'Santiago', 
    comuna = 'Providencia',
    latitud = -33.4260,
    longitud = -70.6140,
    region_id = (SELECT region_id FROM bi.regiones_chile WHERE codigo = 'RM');

-- 4. Agregar bodega_id a fact_ventas si no existe
ALTER TABLE bi.fact_ventas ADD COLUMN IF NOT EXISTS bodega_id INTEGER;

-- 5. Asociar ventas existentes con bodegas por tienda
UPDATE bi.fact_ventas v SET bodega_id = b.bodega_id
FROM bi.dim_bodegas b
WHERE v.tienda = b.tienda AND v.bodega_id IS NULL;

UPDATE bi.fact_ventas v SET bodega_id = (
    SELECT bodega_id FROM bi.dim_bodegas WHERE tienda = v.tienda LIMIT 1
)
WHERE v.bodega_id IS NULL;

-- 6. Vista: Mapa de ventas por región
DROP VIEW IF EXISTS bi.v_mapa_ventas CASCADE;
CREATE VIEW bi.v_mapa_ventas AS
SELECT 
    r.region_id,
    r.nombre as region,
    r.codigo,
    r.capital,
    r.latitud,
    r.longitud,
    r.zona,
    COALESCE(v.num_ventas, 0) as num_ventas,
    COALESCE(v.total_ventas, 0) as total_ventas,
    COALESCE(v.clientes, 0) as clientes,
    COALESCE(st.stock_total, 0) as stock_total,
    COALESCE(st.valor_stock, 0) as valor_stock,
    CASE 
        WHEN COALESCE(v.total_ventas, 0) = 0 THEN 'SIN_VENTAS'
        WHEN COALESCE(v.total_ventas, 0) > 10000000 THEN 'ALTO'
        WHEN COALESCE(v.total_ventas, 0) > 1000000 THEN 'MEDIO'
        ELSE 'BAJO'
    END as nivel_ventas
FROM bi.regiones_chile r
LEFT JOIN (
    SELECT 
        COALESCE(b.region_id, 7) as region_id,
        COUNT(DISTINCT fv.bsale_document_id) as num_ventas,
        SUM(fv.total) as total_ventas,
        COUNT(DISTINCT fv.cliente_id) as clientes
    FROM bi.fact_ventas fv
    LEFT JOIN bi.dim_bodegas b ON fv.bodega_id = b.bodega_id
    WHERE fv.fecha >= CURRENT_DATE - 90
    GROUP BY COALESCE(b.region_id, 7)
) v ON r.region_id = v.region_id
LEFT JOIN (
    SELECT 
        COALESCE(b.region_id, 7) as region_id,
        SUM(p.stock_actual) as stock_total,
        SUM(p.stock_actual * COALESCE(p.precio_venta, 0)) as valor_stock
    FROM bi.dim_productos p
    LEFT JOIN bi.dim_bodegas b ON p.tienda = b.tienda
    WHERE p.stock_actual > 0
    GROUP BY COALESCE(b.region_id, 7)
) st ON r.region_id = st.region_id;

-- 7. Vista: Stock por bodega
DROP VIEW IF EXISTS bi.v_stock_por_bodega CASCADE;
CREATE VIEW bi.v_stock_por_bodega AS
SELECT 
    b.bodega_id,
    b.codigo,
    b.nombre as bodega,
    b.tienda,
    COALESCE(b.ciudad, 'Santiago') as ciudad,
    COALESCE(b.comuna, 'RM') as comuna,
    COALESCE(b.direccion, '') as direccion,
    COALESCE(b.latitud, -33.45) as latitud,
    COALESCE(b.longitud, -70.66) as longitud,
    COALESCE(r.nombre, 'Metropolitana') as region,
    COALESCE(r.zona, 'CENTRO') as zona,
    COALESCE(r.codigo, 'RM') as region_codigo,
    COALESCE(s.productos_con_stock, 0) as productos_con_stock,
    COALESCE(s.stock_total, 0) as stock_total,
    COALESCE(s.valor_stock, 0)::numeric as valor_stock,
    COALESCE(v.ventas_30d, 0) as ventas_30d,
    COALESCE(v.total_ventas, 0)::numeric as total_ventas_30d
FROM bi.dim_bodegas b
LEFT JOIN bi.regiones_chile r ON b.region_id = r.region_id
LEFT JOIN (
    SELECT 
        tienda,
        COUNT(*) FILTER (WHERE stock_actual > 0) as productos_con_stock,
        SUM(stock_actual) as stock_total,
        SUM(stock_actual * COALESCE(precio_venta, 0)) as valor_stock
    FROM bi.dim_productos
    GROUP BY tienda
) s ON b.tienda = s.tienda
LEFT JOIN (
    SELECT 
        tienda,
        COUNT(DISTINCT bsale_document_id) as ventas_30d,
        SUM(total) as total_ventas
    FROM bi.fact_ventas
    WHERE fecha >= CURRENT_DATE - 30
    GROUP BY tienda
) v ON b.tienda = v.tienda;

-- 8. Vista: Resumen por zona
DROP VIEW IF EXISTS bi.v_resumen_zona CASCADE;
CREATE VIEW bi.v_resumen_zona AS
SELECT 
    r.zona,
    COUNT(DISTINCT r.region_id) as num_regiones,
    COUNT(DISTINCT b.bodega_id) as num_bodegas,
    COALESCE(SUM(v.total_ventas), 0)::numeric as total_ventas,
    COALESCE(SUM(v.num_ventas), 0)::bigint as num_ventas,
    COALESCE(SUM(s.stock_total), 0)::bigint as stock_total
FROM bi.regiones_chile r
LEFT JOIN bi.dim_bodegas b ON r.region_id = b.region_id
LEFT JOIN (
    SELECT 
        COALESCE(b.region_id, 7) as region_id,
        SUM(fv.total) as total_ventas,
        COUNT(DISTINCT fv.bsale_document_id) as num_ventas
    FROM bi.fact_ventas fv
    LEFT JOIN bi.dim_bodegas b ON fv.bodega_id = b.bodega_id
    WHERE fv.fecha >= CURRENT_DATE - 30
    GROUP BY COALESCE(b.region_id, 7)
) v ON r.region_id = v.region_id
LEFT JOIN (
    SELECT 
        COALESCE(b.region_id, 7) as region_id,
        SUM(p.stock_actual) as stock_total
    FROM bi.dim_productos p
    LEFT JOIN bi.dim_bodegas b ON p.tienda = b.tienda
    GROUP BY COALESCE(b.region_id, 7)
) s ON r.region_id = s.region_id
GROUP BY r.zona;

-- GRANTS
GRANT SELECT ON bi.regiones_chile TO authenticated, anon;
GRANT SELECT ON bi.v_mapa_ventas TO authenticated, anon;
GRANT SELECT ON bi.v_stock_por_bodega TO authenticated, anon;
GRANT SELECT ON bi.v_resumen_zona TO authenticated, anon;
