-- ============================================================================
-- MI SPA BI SYSTEM - Análisis por Bodega y Marca
-- Migración: 015_analisis_por_bodega_marca.sql
-- Autor: Senior Data Engineer & BI Architect
-- Fecha: 2026-01-30
-- ============================================================================
-- 
-- PROBLEMA DE NEGOCIO RESUELTO:
-- -----------------------------
-- Mi Tienda Spa opera con una lógica de inventario HÍBRIDA:
--
-- 1. STOCK COMPARTIDO (E-commerce): Las bodegas Casa Matriz, Tienda Web y MELI
--    comparten stock lógicamente entre Bluefishing.cl y Epicbike.cl.
--    Si hay 10 unidades en Casa Matriz, están disponibles para AMBAS marcas.
--
-- 2. STOCK SEGREGADO (Físico): Tienda Curanipe es EXCLUSIVA para Bluefishing
--    y su stock NO se suma a la disponibilidad web general.
--
-- DISEÑO DE SOLUCIÓN:
-- - Usamos PostgreSQL ARRAY para marcas (evita antipatrón Jaywalking)
-- - Flags booleanos para clasificar tipo de bodega
-- - Vista materializada con lógica condicional para disponibilidad
-- ============================================================================

-- ============================================================================
-- PARTE 1: REFACTORIZACIÓN DE DIMENSIONES (DDL)
-- ============================================================================

-- 1.1 Crear ENUM para tipo de canal de bodega
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'canal_bodega') THEN
        CREATE TYPE bi.canal_bodega AS ENUM ('FISICA', 'WEB', 'MARKETPLACE', 'HIBRIDA');
    END IF;
END $$;

-- 1.2 Crear ENUM para política de stock
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'politica_stock') THEN
        CREATE TYPE bi.politica_stock AS ENUM ('COMPARTIDO', 'DEDICADO', 'RESERVADO');
    END IF;
END $$;

-- 1.3 Agregar columnas de clasificación a dim_bodegas
-- ============================================================================
-- DISEÑO: Usamos ARRAY de tienda_tipo para las marcas servidas
-- Esto evita el antipatrón "Jaywalking" (listas separadas por comas)
-- y permite queries eficientes con operadores de array (@>, &&, etc.)
-- ============================================================================

ALTER TABLE bi.dim_bodegas 
    ADD COLUMN IF NOT EXISTS canal bi.canal_bodega DEFAULT 'HIBRIDA',
    ADD COLUMN IF NOT EXISTS politica_stock bi.politica_stock DEFAULT 'COMPARTIDO',
    ADD COLUMN IF NOT EXISTS marcas_servidas bi.tienda_tipo[] DEFAULT ARRAY['BLUEFISHING', 'EPICBIKE']::bi.tienda_tipo[],
    ADD COLUMN IF NOT EXISTS permite_venta_web BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS permite_venta_fisica BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS stock_visible_global BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS prioridad_picking INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS notas_operativas TEXT;

-- 1.4 Crear índice GIN para búsquedas eficientes en array de marcas
CREATE INDEX IF NOT EXISTS idx_bodegas_marcas_gin 
    ON bi.dim_bodegas USING GIN (marcas_servidas);

CREATE INDEX IF NOT EXISTS idx_bodegas_canal 
    ON bi.dim_bodegas (canal);

CREATE INDEX IF NOT EXISTS idx_bodegas_politica 
    ON bi.dim_bodegas (politica_stock);

-- 1.5 Actualizar bodegas existentes con la clasificación correcta
-- ============================================================================
-- REGLA DE NEGOCIO CLAVE:
-- - Curanipe: FÍSICA, DEDICADA, solo BLUEFISHING, NO visible globalmente
-- - Casa Matriz: HÍBRIDA, COMPARTIDA, ambas marcas
-- - Tienda Web: WEB, COMPARTIDA, ambas marcas
-- - MELI: MARKETPLACE, COMPARTIDA, ambas marcas
-- ============================================================================

UPDATE bi.dim_bodegas SET
    canal = 'HIBRIDA',
    politica_stock = 'COMPARTIDO',
    marcas_servidas = ARRAY['BLUEFISHING', 'EPICBIKE']::bi.tienda_tipo[],
    permite_venta_web = TRUE,
    permite_venta_fisica = TRUE,
    stock_visible_global = TRUE,
    prioridad_picking = 1,
    notas_operativas = 'Bodega principal mayorista - Stock compartido entre ambas marcas'
WHERE codigo = 'CASA_MATRIZ' OR nombre ILIKE '%casa matriz%';

UPDATE bi.dim_bodegas SET
    canal = 'WEB',
    politica_stock = 'COMPARTIDO',
    marcas_servidas = ARRAY['BLUEFISHING', 'EPICBIKE']::bi.tienda_tipo[],
    permite_venta_web = TRUE,
    permite_venta_fisica = TRUE,
    stock_visible_global = TRUE,
    prioridad_picking = 2,
    notas_operativas = 'Tienda retail y e-commerce - Stock compartido'
WHERE codigo = 'TIENDA_WEB' OR nombre ILIKE '%tienda%web%';

UPDATE bi.dim_bodegas SET
    canal = 'MARKETPLACE',
    politica_stock = 'COMPARTIDO',
    marcas_servidas = ARRAY['BLUEFISHING', 'EPICBIKE']::bi.tienda_tipo[],
    permite_venta_web = TRUE,
    permite_venta_fisica = FALSE,
    stock_visible_global = TRUE,
    prioridad_picking = 3,
    notas_operativas = 'Mercado Libre - Stock compartido, solo venta online'
WHERE codigo = 'MELI' OR nombre ILIKE '%mercado%libre%' OR nombre ILIKE '%meli%';

-- ============================================================================
-- CASO ESPECIAL: CURANIPE
-- Esta bodega es FÍSICA y DEDICADA exclusivamente a Bluefishing.
-- Su stock NO debe sumarse a la disponibilidad web global.
-- ============================================================================
UPDATE bi.dim_bodegas SET
    canal = 'FISICA',
    politica_stock = 'DEDICADO',
    marcas_servidas = ARRAY['BLUEFISHING']::bi.tienda_tipo[],
    permite_venta_web = FALSE,           -- NO vende por web
    permite_venta_fisica = TRUE,         -- Solo venta física
    stock_visible_global = FALSE,        -- NO suma al stock global web
    prioridad_picking = 99,              -- Última prioridad para picking central
    notas_operativas = 'Tienda física Curanipe - EXCLUSIVA Bluefishing - Stock segregado, no disponible para web'
WHERE codigo = 'CURANIPE' OR nombre ILIKE '%curanipe%';


-- ============================================================================
-- PARTE 2: VISTA MATERIALIZADA DE DISPONIBILIDAD POR MARCA
-- ============================================================================
-- 
-- LÓGICA CRÍTICA:
-- ---------------
-- 1. Para BLUEFISHING:
--    - Suma stock de bodegas COMPARTIDAS donde BLUEFISHING esté en marcas_servidas
--    - Suma stock de Curanipe SOLO para canal físico (no web)
--
-- 2. Para EPICBIKE:
--    - Suma stock de bodegas COMPARTIDAS donde EPICBIKE esté en marcas_servidas
--    - EXCLUYE completamente Curanipe
--
-- 3. Vista de disponibilidad WEB:
--    - Solo bodegas con stock_visible_global = TRUE
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS bi.mv_stock_disponible_marca CASCADE;

CREATE MATERIALIZED VIEW bi.mv_stock_disponible_marca AS
WITH 
-- Obtener la fecha más reciente de stock
fecha_stock AS (
    SELECT MAX(fecha) as max_fecha FROM bi.fact_stock
),

-- Stock actual por producto y bodega
stock_actual AS (
    SELECT 
        fs.producto_id,
        fs.bodega_id,
        fs.cantidad,
        fs.cantidad_disponible,
        fs.cantidad_reservada,
        p.tienda AS marca_producto,
        p.sku,
        p.nombre AS producto_nombre,
        p.precio_venta,
        p.precio_costo,
        b.codigo AS bodega_codigo,
        b.nombre AS bodega_nombre,
        b.canal,
        b.politica_stock,
        b.marcas_servidas,
        b.permite_venta_web,
        b.permite_venta_fisica,
        b.stock_visible_global
    FROM bi.fact_stock fs
    JOIN bi.dim_productos p ON fs.producto_id = p.producto_id
    JOIN bi.dim_bodegas b ON fs.bodega_id = b.bodega_id
    CROSS JOIN fecha_stock f
    WHERE fs.fecha = f.max_fecha
      AND fs.cantidad > 0
      AND p.es_activo = TRUE
      AND b.es_activa = TRUE
),

-- ============================================================================
-- CÁLCULO DE DISPONIBILIDAD POR MARCA
-- ============================================================================
-- Expandimos cada registro de stock para cada marca que puede servir la bodega
-- Esto permite que un mismo stock aparezca disponible para múltiples marcas
-- si la bodega es COMPARTIDA
-- ============================================================================

stock_expandido AS (
    SELECT 
        sa.*,
        unnest(sa.marcas_servidas) AS marca_disponible
    FROM stock_actual sa
),

-- Calcular disponibilidad web (solo bodegas visibles globalmente)
disponibilidad_web AS (
    SELECT 
        producto_id,
        marca_disponible,
        SUM(cantidad) AS stock_total_web,
        SUM(cantidad_disponible) AS stock_disponible_web,
        COUNT(DISTINCT bodega_id) AS num_bodegas_web,
        ARRAY_AGG(DISTINCT bodega_nombre) AS bodegas_origen_web
    FROM stock_expandido
    WHERE stock_visible_global = TRUE
      AND permite_venta_web = TRUE
    GROUP BY producto_id, marca_disponible
),

-- Calcular disponibilidad física (todas las bodegas que permiten venta física)
disponibilidad_fisica AS (
    SELECT 
        producto_id,
        marca_disponible,
        SUM(cantidad) AS stock_total_fisico,
        SUM(cantidad_disponible) AS stock_disponible_fisico,
        COUNT(DISTINCT bodega_id) AS num_bodegas_fisicas,
        ARRAY_AGG(DISTINCT bodega_nombre) AS bodegas_origen_fisicas
    FROM stock_expandido
    WHERE permite_venta_fisica = TRUE
    GROUP BY producto_id, marca_disponible
),

-- Stock segregado (bodegas DEDICADAS - ej: Curanipe)
stock_segregado AS (
    SELECT 
        producto_id,
        marca_disponible,
        bodega_id,
        bodega_nombre,
        cantidad AS stock_segregado,
        cantidad_disponible AS disponible_segregado
    FROM stock_expandido
    WHERE politica_stock = 'DEDICADO'
)

-- ============================================================================
-- RESULTADO FINAL: Disponibilidad consolidada por producto y marca
-- ============================================================================
SELECT 
    p.producto_id,
    p.sku,
    p.nombre AS producto,
    p.tienda AS marca_origen_producto,
    dw.marca_disponible AS marca_venta,
    
    -- Stock Web (excluye bodegas segregadas como Curanipe)
    COALESCE(dw.stock_total_web, 0) AS stock_web_total,
    COALESCE(dw.stock_disponible_web, 0) AS stock_web_disponible,
    COALESCE(dw.num_bodegas_web, 0) AS num_bodegas_web,
    dw.bodegas_origen_web,
    
    -- Stock Físico (incluye todas las bodegas físicas)
    COALESCE(df.stock_total_fisico, 0) AS stock_fisico_total,
    COALESCE(df.stock_disponible_fisico, 0) AS stock_fisico_disponible,
    COALESCE(df.num_bodegas_fisicas, 0) AS num_bodegas_fisicas,
    df.bodegas_origen_fisicas,
    
    -- Stock Total Empresa (suma todo)
    COALESCE(dw.stock_total_web, 0) + 
        COALESCE(
            (SELECT SUM(ss.stock_segregado) 
             FROM stock_segregado ss 
             WHERE ss.producto_id = p.producto_id 
               AND ss.marca_disponible = dw.marca_disponible),
            0
        ) AS stock_total_empresa,
    
    -- Valorización
    (COALESCE(dw.stock_disponible_web, 0) * p.precio_venta) AS valor_stock_web_venta,
    (COALESCE(df.stock_disponible_fisico, 0) * p.precio_costo) AS valor_stock_fisico_costo,
    
    -- Flags de disponibilidad
    COALESCE(dw.stock_disponible_web, 0) > 0 AS disponible_web,
    COALESCE(df.stock_disponible_fisico, 0) > 0 AS disponible_fisico,
    
    -- Metadata
    (SELECT MAX(fecha) FROM bi.fact_stock) AS fecha_stock,
    NOW() AS fecha_calculo

FROM bi.dim_productos p
LEFT JOIN disponibilidad_web dw ON p.producto_id = dw.producto_id
LEFT JOIN disponibilidad_fisica df ON p.producto_id = df.producto_id 
    AND df.marca_disponible = dw.marca_disponible
WHERE p.es_activo = TRUE
  AND dw.marca_disponible IS NOT NULL

WITH DATA;

-- Índices para la vista materializada
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_stock_marca_pk 
    ON bi.mv_stock_disponible_marca (producto_id, marca_venta);

CREATE INDEX IF NOT EXISTS idx_mv_stock_marca_sku 
    ON bi.mv_stock_disponible_marca (sku);

CREATE INDEX IF NOT EXISTS idx_mv_stock_marca_disponible 
    ON bi.mv_stock_disponible_marca (marca_venta, disponible_web);


-- ============================================================================
-- PARTE 2B: VISTA DE STOCK POR BODEGA DETALLADO
-- ============================================================================
-- Vista que muestra el detalle de stock por bodega incluyendo la clasificación
-- y si el stock es compartido o segregado
-- ============================================================================

DROP VIEW IF EXISTS bi.v_stock_bodega_detalle CASCADE;

CREATE VIEW bi.v_stock_bodega_detalle AS
WITH fecha_stock AS (
    SELECT MAX(fecha) as max_fecha FROM bi.fact_stock
)
SELECT 
    b.bodega_id,
    b.codigo AS bodega_codigo,
    b.nombre AS bodega_nombre,
    b.canal,
    b.politica_stock,
    b.marcas_servidas,
    b.permite_venta_web,
    b.permite_venta_fisica,
    b.stock_visible_global,
    
    -- Resumen de stock
    COUNT(DISTINCT fs.producto_id) AS productos_distintos,
    SUM(fs.cantidad) AS stock_total_unidades,
    SUM(fs.cantidad_disponible) AS stock_disponible_unidades,
    SUM(fs.cantidad_reservada) AS stock_reservado_unidades,
    
    -- Valorización
    SUM(fs.cantidad * COALESCE(p.precio_costo, 0)) AS valor_stock_costo,
    SUM(fs.cantidad * COALESCE(p.precio_venta, 0)) AS valor_stock_venta,
    
    -- Desglose por marca del producto
    COUNT(DISTINCT fs.producto_id) FILTER (WHERE p.tienda = 'BLUEFISHING') AS productos_bluefishing,
    COUNT(DISTINCT fs.producto_id) FILTER (WHERE p.tienda = 'EPICBIKE') AS productos_epicbike,
    SUM(fs.cantidad) FILTER (WHERE p.tienda = 'BLUEFISHING') AS stock_bluefishing,
    SUM(fs.cantidad) FILTER (WHERE p.tienda = 'EPICBIKE') AS stock_epicbike,
    
    -- Indicadores de salud
    CASE 
        WHEN b.politica_stock = 'DEDICADO' THEN 'SEGREGADO'
        WHEN b.stock_visible_global = FALSE THEN 'OCULTO_WEB'
        ELSE 'COMPARTIDO'
    END AS tipo_visibilidad,
    
    b.notas_operativas,
    f.max_fecha AS fecha_stock

FROM bi.dim_bodegas b
LEFT JOIN bi.fact_stock fs ON b.bodega_id = fs.bodega_id
LEFT JOIN bi.dim_productos p ON fs.producto_id = p.producto_id
CROSS JOIN fecha_stock f
WHERE (fs.fecha = f.max_fecha OR fs.fecha IS NULL)
  AND b.es_activa = TRUE
GROUP BY 
    b.bodega_id, b.codigo, b.nombre, b.canal, b.politica_stock,
    b.marcas_servidas, b.permite_venta_web, b.permite_venta_fisica,
    b.stock_visible_global, b.notas_operativas, f.max_fecha
ORDER BY b.prioridad_picking, b.nombre;


-- ============================================================================
-- PARTE 3: MATRIZ DE VENTAS CRUZADA (OLAP REPORTING)
-- ============================================================================
-- Genera una matriz de rendimiento:
-- - Filas: Bodegas
-- - Columnas: Marcas (Bluefishing vs Epicbike)
-- - Valores: Ventas, Unidades, Rotación de Inventario
-- ============================================================================

DROP VIEW IF EXISTS bi.v_matriz_ventas_bodega_marca CASCADE;

CREATE VIEW bi.v_matriz_ventas_bodega_marca AS
WITH 
-- Ventas por bodega y marca del producto (últimos 90 días)
ventas_periodo AS (
    SELECT 
        COALESCE(v.bodega_id, b.bodega_id) AS bodega_id,
        p.tienda AS marca_producto,
        COUNT(DISTINCT v.bsale_document_id) AS num_transacciones,
        SUM(v.cantidad) AS unidades_vendidas,
        SUM(v.total) AS venta_total,
        SUM(v.total - (v.cantidad * COALESCE(p.precio_costo, 0))) AS margen_bruto,
        AVG(v.total) AS ticket_promedio
    FROM bi.fact_ventas v
    JOIN bi.dim_productos p ON v.producto_id = p.producto_id
    LEFT JOIN bi.dim_bodegas b ON v.tienda = b.tienda
    WHERE v.fecha >= CURRENT_DATE - 90
    GROUP BY COALESCE(v.bodega_id, b.bodega_id), p.tienda
),

-- Stock actual por bodega y marca
stock_actual AS (
    SELECT 
        fs.bodega_id,
        p.tienda AS marca_producto,
        SUM(fs.cantidad) AS stock_actual,
        SUM(fs.cantidad * COALESCE(p.precio_costo, 0)) AS valor_stock_costo
    FROM bi.fact_stock fs
    JOIN bi.dim_productos p ON fs.producto_id = p.producto_id
    WHERE fs.fecha = (SELECT MAX(fecha) FROM bi.fact_stock)
    GROUP BY fs.bodega_id, p.tienda
),

-- Calcular rotación
metricas_combinadas AS (
    SELECT 
        b.bodega_id,
        b.codigo AS bodega_codigo,
        b.nombre AS bodega_nombre,
        b.canal,
        b.politica_stock,
        marca.marca,
        
        -- Ventas
        COALESCE(vp.num_transacciones, 0) AS transacciones,
        COALESCE(vp.unidades_vendidas, 0) AS unidades_vendidas,
        COALESCE(vp.venta_total, 0) AS venta_total,
        COALESCE(vp.margen_bruto, 0) AS margen_bruto,
        COALESCE(vp.ticket_promedio, 0) AS ticket_promedio,
        
        -- Stock
        COALESCE(sa.stock_actual, 0) AS stock_actual,
        COALESCE(sa.valor_stock_costo, 0) AS valor_stock,
        
        -- Rotación de inventario (Costo Ventas / Stock Promedio)
        -- Anualizado: (ventas 90 días * 4) / stock actual
        CASE 
            WHEN COALESCE(sa.valor_stock_costo, 0) > 0 THEN
                ROUND(((COALESCE(vp.venta_total, 0) - COALESCE(vp.margen_bruto, 0)) * 4 / sa.valor_stock_costo)::numeric, 2)
            ELSE 0
        END AS rotacion_anual,
        
        -- Días de cobertura
        CASE 
            WHEN COALESCE(vp.unidades_vendidas, 0) > 0 THEN
                ROUND((COALESCE(sa.stock_actual, 0)::numeric / (vp.unidades_vendidas / 90.0))::numeric, 0)
            ELSE 999
        END AS dias_cobertura,
        
        -- Flag: bodega sirve esta marca?
        marca.marca = ANY(b.marcas_servidas) AS bodega_sirve_marca
        
    FROM bi.dim_bodegas b
    CROSS JOIN (
        SELECT 'BLUEFISHING'::bi.tienda_tipo AS marca
        UNION ALL
        SELECT 'EPICBIKE'::bi.tienda_tipo
    ) marca
    LEFT JOIN ventas_periodo vp ON b.bodega_id = vp.bodega_id AND marca.marca = vp.marca_producto
    LEFT JOIN stock_actual sa ON b.bodega_id = sa.bodega_id AND marca.marca = sa.marca_producto
    WHERE b.es_activa = TRUE
)

-- ============================================================================
-- RESULTADO: Matriz pivoteada con formato OLAP
-- ============================================================================
SELECT 
    bodega_id,
    bodega_codigo,
    bodega_nombre,
    canal,
    politica_stock,
    
    -- BLUEFISHING
    MAX(CASE WHEN marca = 'BLUEFISHING' THEN transacciones END) AS bf_transacciones,
    MAX(CASE WHEN marca = 'BLUEFISHING' THEN unidades_vendidas END) AS bf_unidades,
    MAX(CASE WHEN marca = 'BLUEFISHING' THEN venta_total END) AS bf_venta_total,
    MAX(CASE WHEN marca = 'BLUEFISHING' THEN margen_bruto END) AS bf_margen,
    MAX(CASE WHEN marca = 'BLUEFISHING' THEN stock_actual END) AS bf_stock,
    MAX(CASE WHEN marca = 'BLUEFISHING' THEN rotacion_anual END) AS bf_rotacion,
    MAX(CASE WHEN marca = 'BLUEFISHING' THEN dias_cobertura END) AS bf_dias_cobertura,
    BOOL_OR(CASE WHEN marca = 'BLUEFISHING' THEN bodega_sirve_marca ELSE FALSE END) AS bf_habilitada,
    
    -- EPICBIKE
    MAX(CASE WHEN marca = 'EPICBIKE' THEN transacciones END) AS eb_transacciones,
    MAX(CASE WHEN marca = 'EPICBIKE' THEN unidades_vendidas END) AS eb_unidades,
    MAX(CASE WHEN marca = 'EPICBIKE' THEN venta_total END) AS eb_venta_total,
    MAX(CASE WHEN marca = 'EPICBIKE' THEN margen_bruto END) AS eb_margen,
    MAX(CASE WHEN marca = 'EPICBIKE' THEN stock_actual END) AS eb_stock,
    MAX(CASE WHEN marca = 'EPICBIKE' THEN rotacion_anual END) AS eb_rotacion,
    MAX(CASE WHEN marca = 'EPICBIKE' THEN dias_cobertura END) AS eb_dias_cobertura,
    BOOL_OR(CASE WHEN marca = 'EPICBIKE' THEN bodega_sirve_marca ELSE FALSE END) AS eb_habilitada,
    
    -- TOTALES
    SUM(venta_total) AS total_venta,
    SUM(margen_bruto) AS total_margen,
    SUM(stock_actual) AS total_stock,
    ROUND(AVG(rotacion_anual)::numeric, 2) AS rotacion_promedio

FROM metricas_combinadas
GROUP BY bodega_id, bodega_codigo, bodega_nombre, canal, politica_stock
ORDER BY total_venta DESC NULLS LAST;


-- ============================================================================
-- PARTE 3B: VISTA DE ANÁLISIS TEMPORAL (Tendencias por Bodega-Marca)
-- ============================================================================

DROP VIEW IF EXISTS bi.v_tendencia_bodega_marca CASCADE;

CREATE VIEW bi.v_tendencia_bodega_marca AS
SELECT 
    DATE_TRUNC('week', v.fecha)::DATE AS semana,
    b.bodega_id,
    b.nombre AS bodega,
    b.canal,
    p.tienda AS marca,
    COUNT(DISTINCT v.bsale_document_id) AS transacciones,
    SUM(v.cantidad) AS unidades,
    SUM(v.total) AS venta_total,
    SUM(v.total) / NULLIF(COUNT(DISTINCT v.bsale_document_id), 0) AS ticket_promedio,
    -- Variación vs semana anterior (Window Function)
    SUM(v.total) - LAG(SUM(v.total)) OVER (
        PARTITION BY b.bodega_id, p.tienda 
        ORDER BY DATE_TRUNC('week', v.fecha)
    ) AS variacion_venta,
    -- % Participación de la bodega en la marca
    ROUND(
        (SUM(v.total) * 100.0 / NULLIF(SUM(SUM(v.total)) OVER (PARTITION BY DATE_TRUNC('week', v.fecha), p.tienda), 0))::numeric,
        2
    ) AS pct_participacion_marca
FROM bi.fact_ventas v
JOIN bi.dim_productos p ON v.producto_id = p.producto_id
LEFT JOIN bi.dim_bodegas b ON v.bodega_id = b.bodega_id
WHERE v.fecha >= CURRENT_DATE - 180
GROUP BY DATE_TRUNC('week', v.fecha), b.bodega_id, b.nombre, b.canal, p.tienda
ORDER BY semana DESC, marca, venta_total DESC;


-- ============================================================================
-- PARTE 4: ÍNDICES Y CONSTRAINTS PARA PERFORMANCE
-- ============================================================================

-- 4.1 Índices compuestos en fact_stock para queries de disponibilidad
CREATE INDEX IF NOT EXISTS idx_fact_stock_fecha_bodega_producto 
    ON bi.fact_stock (fecha DESC, bodega_id, producto_id);

CREATE INDEX IF NOT EXISTS idx_fact_stock_producto_fecha 
    ON bi.fact_stock (producto_id, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_fact_stock_bodega_fecha 
    ON bi.fact_stock (bodega_id, fecha DESC);

-- 4.2 Índices en fact_ventas para matriz de ventas
CREATE INDEX IF NOT EXISTS idx_fact_ventas_bodega_fecha 
    ON bi.fact_ventas (bodega_id, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_fact_ventas_fecha_tienda 
    ON bi.fact_ventas (fecha DESC, tienda);

CREATE INDEX IF NOT EXISTS idx_fact_ventas_producto_bodega 
    ON bi.fact_ventas (producto_id, bodega_id);

-- 4.3 Índice para ventas por fecha (optimiza queries de período)
-- Nota: No usamos índice parcial con CURRENT_DATE porque no es IMMUTABLE
CREATE INDEX IF NOT EXISTS idx_fact_ventas_fecha_tienda_bodega 
    ON bi.fact_ventas (fecha DESC, tienda, bodega_id);


-- ============================================================================
-- PARTE 4B: FUNCIÓN Y TRIGGER PARA REFRESH AUTOMÁTICO
-- ============================================================================

-- Función para refrescar vistas materializadas de stock/marca
CREATE OR REPLACE FUNCTION bi.refresh_mv_stock_marca()
RETURNS TRIGGER AS $$
BEGIN
    -- Refrescar la vista de disponibilidad por marca
    -- Usamos CONCURRENTLY para no bloquear lecturas
    REFRESH MATERIALIZED VIEW CONCURRENTLY bi.mv_stock_disponible_marca;
    RETURN NULL;
EXCEPTION WHEN OTHERS THEN
    -- Si falla el refresh concurrente (ej: primera vez), hacer refresh normal
    REFRESH MATERIALIZED VIEW bi.mv_stock_disponible_marca;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger que se ejecuta después de cambios en fact_stock
-- Nota: Se activa cada 100 inserts para no sobrecargar el sistema
DROP TRIGGER IF EXISTS trg_refresh_stock_marca ON bi.fact_stock;

-- En lugar de trigger por fila, usamos una función programada
-- El trigger por statement es más eficiente para cargas masivas
CREATE OR REPLACE FUNCTION bi.refresh_mv_stock_marca_deferred()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo refrescar si es la primera fila del statement o cada 1000 filas
    -- Esto evita múltiples refreshes en cargas masivas
    PERFORM pg_advisory_xact_lock(hashtext('refresh_mv_stock_marca'));
    REFRESH MATERIALIZED VIEW CONCURRENTLY bi.mv_stock_disponible_marca;
    RETURN NULL;
EXCEPTION WHEN OTHERS THEN
    REFRESH MATERIALIZED VIEW bi.mv_stock_disponible_marca;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_refresh_stock_marca_after_load
    AFTER INSERT OR UPDATE ON bi.fact_stock
    FOR EACH STATEMENT
    EXECUTE FUNCTION bi.refresh_mv_stock_marca_deferred();

-- También refrescar después de ventas (para métricas actualizadas)
DROP TRIGGER IF EXISTS trg_refresh_after_ventas ON bi.fact_ventas;

CREATE TRIGGER trg_refresh_after_ventas
    AFTER INSERT ON bi.fact_ventas
    FOR EACH STATEMENT
    EXECUTE FUNCTION bi.refresh_mv_stock_marca_deferred();


-- ============================================================================
-- PARTE 5: FUNCIONES DE UTILIDAD
-- ============================================================================

-- 5.1 Función para obtener stock disponible web por marca
CREATE OR REPLACE FUNCTION bi.get_stock_web_marca(
    p_marca bi.tienda_tipo,
    p_producto_id INTEGER DEFAULT NULL
)
RETURNS TABLE(
    producto_id INTEGER,
    sku VARCHAR,
    producto VARCHAR,
    stock_web INTEGER,
    stock_fisico INTEGER,
    disponible_web BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.producto_id,
        m.sku,
        m.producto,
        m.stock_web_disponible::INTEGER,
        m.stock_fisico_disponible::INTEGER,
        m.disponible_web
    FROM bi.mv_stock_disponible_marca m
    WHERE m.marca_venta = p_marca
      AND (p_producto_id IS NULL OR m.producto_id = p_producto_id);
END;
$$ LANGUAGE plpgsql STABLE;

-- 5.2 Función para verificar si un producto está disponible en una bodega específica
CREATE OR REPLACE FUNCTION bi.check_disponibilidad_bodega(
    p_producto_id INTEGER,
    p_bodega_codigo VARCHAR,
    p_marca bi.tienda_tipo
)
RETURNS TABLE(
    disponible BOOLEAN,
    cantidad_disponible INTEGER,
    bodega_sirve_marca BOOLEAN,
    mensaje TEXT
) AS $$
DECLARE
    v_bodega_id INTEGER;
    v_marcas bi.tienda_tipo[];
    v_stock INTEGER;
BEGIN
    -- Obtener datos de la bodega
    SELECT bodega_id, marcas_servidas 
    INTO v_bodega_id, v_marcas
    FROM bi.dim_bodegas 
    WHERE codigo = p_bodega_codigo AND es_activa = TRUE;
    
    IF v_bodega_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 0, FALSE, 'Bodega no encontrada o inactiva'::TEXT;
        RETURN;
    END IF;
    
    -- Verificar si la bodega sirve la marca
    IF NOT (p_marca = ANY(v_marcas)) THEN
        RETURN QUERY SELECT FALSE, 0, FALSE, 
            FORMAT('Bodega %s no sirve la marca %s', p_bodega_codigo, p_marca)::TEXT;
        RETURN;
    END IF;
    
    -- Obtener stock
    SELECT COALESCE(fs.cantidad_disponible, 0) INTO v_stock
    FROM bi.fact_stock fs
    WHERE fs.bodega_id = v_bodega_id
      AND fs.producto_id = p_producto_id
      AND fs.fecha = (SELECT MAX(fecha) FROM bi.fact_stock);
    
    RETURN QUERY SELECT 
        COALESCE(v_stock, 0) > 0,
        COALESCE(v_stock, 0)::INTEGER,
        TRUE,
        CASE 
            WHEN COALESCE(v_stock, 0) > 0 THEN 'Producto disponible'
            ELSE 'Sin stock'
        END::TEXT;
END;
$$ LANGUAGE plpgsql STABLE;

-- 5.3 Función para resumen de capacidad de bodegas
CREATE OR REPLACE FUNCTION bi.resumen_bodegas_marca()
RETURNS TABLE(
    bodega VARCHAR,
    canal bi.canal_bodega,
    politica bi.politica_stock,
    marcas TEXT,
    productos_total BIGINT,
    stock_total BIGINT,
    valor_stock NUMERIC,
    venta_90d NUMERIC,
    rotacion NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.bodega_nombre,
        b.canal,
        b.politica_stock,
        ARRAY_TO_STRING(b.marcas_servidas, ', '),
        (COALESCE(m.bf_stock, 0) + COALESCE(m.eb_stock, 0))::BIGINT,
        (COALESCE(m.bf_stock, 0) + COALESCE(m.eb_stock, 0))::BIGINT,
        (COALESCE(m.bf_venta_total, 0) + COALESCE(m.eb_venta_total, 0))::NUMERIC,
        (COALESCE(m.bf_venta_total, 0) + COALESCE(m.eb_venta_total, 0))::NUMERIC,
        m.rotacion_promedio::NUMERIC
    FROM bi.v_matriz_ventas_bodega_marca m
    JOIN bi.dim_bodegas b ON m.bodega_id = b.bodega_id
    ORDER BY m.total_venta DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql STABLE;


-- ============================================================================
-- PARTE 6: ACTUALIZAR FUNCIÓN DE REFRESH GENERAL
-- ============================================================================

-- Agregar la nueva vista al refresh general
CREATE OR REPLACE FUNCTION bi.refresh_all_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW bi.mv_resumen_ejecutivo;
    REFRESH MATERIALIZED VIEW bi.mv_ventas_diarias;
    REFRESH MATERIALIZED VIEW bi.mv_aging_cartera;
    REFRESH MATERIALIZED VIEW bi.mv_top_productos;
    -- Nueva vista de stock por marca
    REFRESH MATERIALIZED VIEW CONCURRENTLY bi.mv_stock_disponible_marca;
EXCEPTION WHEN OTHERS THEN
    -- Si falla concurrently, intentar sin él
    REFRESH MATERIALIZED VIEW bi.mv_stock_disponible_marca;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- PARTE 7: GRANTS (Permisos)
-- ============================================================================

-- Vistas
GRANT SELECT ON bi.mv_stock_disponible_marca TO authenticated, anon;
GRANT SELECT ON bi.v_stock_bodega_detalle TO authenticated, anon;
GRANT SELECT ON bi.v_matriz_ventas_bodega_marca TO authenticated, anon;
GRANT SELECT ON bi.v_tendencia_bodega_marca TO authenticated, anon;

-- Funciones
GRANT EXECUTE ON FUNCTION bi.get_stock_web_marca(bi.tienda_tipo, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION bi.check_disponibilidad_bodega(INTEGER, VARCHAR, bi.tienda_tipo) TO authenticated;
GRANT EXECUTE ON FUNCTION bi.resumen_bodegas_marca() TO authenticated;
GRANT EXECUTE ON FUNCTION bi.refresh_mv_stock_marca() TO service_role;
GRANT EXECUTE ON FUNCTION bi.refresh_mv_stock_marca_deferred() TO service_role;


-- ============================================================================
-- PARTE 8: DATOS DE PRUEBA Y VERIFICACIÓN
-- ============================================================================

-- Verificar configuración de bodegas
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM bi.dim_bodegas WHERE politica_stock = 'DEDICADO';
    RAISE NOTICE '✓ Bodegas con stock DEDICADO (segregado): %', v_count;
    
    SELECT COUNT(*) INTO v_count FROM bi.dim_bodegas WHERE stock_visible_global = FALSE;
    RAISE NOTICE '✓ Bodegas con stock NO visible globalmente: %', v_count;
    
    SELECT COUNT(*) INTO v_count FROM bi.dim_bodegas WHERE 'BLUEFISHING' = ANY(marcas_servidas);
    RAISE NOTICE '✓ Bodegas que sirven BLUEFISHING: %', v_count;
    
    SELECT COUNT(*) INTO v_count FROM bi.dim_bodegas WHERE 'EPICBIKE' = ANY(marcas_servidas);
    RAISE NOTICE '✓ Bodegas que sirven EPICBIKE: %', v_count;
END $$;

-- Mostrar resumen de configuración
SELECT 
    nombre,
    canal,
    politica_stock,
    ARRAY_TO_STRING(marcas_servidas, ', ') AS marcas,
    permite_venta_web AS web,
    permite_venta_fisica AS fisica,
    stock_visible_global AS visible_global,
    notas_operativas
FROM bi.dim_bodegas
WHERE es_activa = TRUE
ORDER BY prioridad_picking;


-- ============================================================================
-- FIN DE MIGRACIÓN 015
-- ============================================================================
-- 
-- RESUMEN DE OBJETOS CREADOS:
-- ---------------------------
-- TIPOS:
--   - bi.canal_bodega (ENUM)
--   - bi.politica_stock (ENUM)
--
-- COLUMNAS AGREGADAS A dim_bodegas:
--   - canal, politica_stock, marcas_servidas (ARRAY)
--   - permite_venta_web, permite_venta_fisica, stock_visible_global
--   - prioridad_picking, notas_operativas
--
-- VISTAS MATERIALIZADAS:
--   - bi.mv_stock_disponible_marca (Disponibilidad por producto y marca)
--
-- VISTAS:
--   - bi.v_stock_bodega_detalle (Detalle de stock por bodega)
--   - bi.v_matriz_ventas_bodega_marca (Matriz OLAP de rendimiento)
--   - bi.v_tendencia_bodega_marca (Análisis temporal)
--
-- FUNCIONES:
--   - bi.get_stock_web_marca() - Consulta stock web por marca
--   - bi.check_disponibilidad_bodega() - Verificar disponibilidad
--   - bi.resumen_bodegas_marca() - Resumen de capacidad
--   - bi.refresh_mv_stock_marca() - Trigger de refresh
--
-- ÍNDICES:
--   - idx_bodegas_marcas_gin (GIN para array de marcas)
--   - idx_fact_stock_fecha_bodega_producto (Compuesto)
--   - idx_fact_ventas_90d (Parcial para hot data)
--
-- TRIGGERS:
--   - trg_refresh_stock_marca_after_load (Refresh automático)
--   - trg_refresh_after_ventas (Refresh después de ventas)
--
-- ============================================================================


-- ============================================================================
-- PARTE 9: ACTUALIZACIÓN DE BODEGAS ADICIONALES (Sincronizadas desde Bsale)
-- ============================================================================
-- Estas bodegas fueron creadas por el ETL de Bsale y necesitan configuración

-- Tienda EPICBIKE (tienda física de ciclismo)
UPDATE bi.dim_bodegas SET
    canal = 'HIBRIDA',
    politica_stock = 'COMPARTIDO',
    marcas_servidas = ARRAY['BLUEFISHING', 'EPICBIKE']::bi.tienda_tipo[],
    permite_venta_web = TRUE,
    permite_venta_fisica = TRUE,
    stock_visible_global = TRUE,
    prioridad_picking = 2,
    notas_operativas = 'Tienda física EPICBIKE - Stock compartido entre ambas marcas'
WHERE nombre ILIKE '%tienda%epicbike%' OR nombre = 'Tienda EPICBIKE'
  AND notas_operativas IS NULL;

-- EPICBIKE Web (canal e-commerce de ciclismo)
UPDATE bi.dim_bodegas SET
    canal = 'WEB',
    politica_stock = 'COMPARTIDO',
    marcas_servidas = ARRAY['BLUEFISHING', 'EPICBIKE']::bi.tienda_tipo[],
    permite_venta_web = TRUE,
    permite_venta_fisica = FALSE,
    stock_visible_global = TRUE,
    prioridad_picking = 3,
    notas_operativas = 'Canal e-commerce EPICBIKE - Stock compartido, solo venta online'
WHERE nombre ILIKE '%epicbike%web%' OR nombre = 'EPICBIKE Web'
  AND notas_operativas IS NULL;

-- Tienda y Web Bsale (duplicado de Tienda y Web)
UPDATE bi.dim_bodegas SET
    canal = 'WEB',
    politica_stock = 'COMPARTIDO',
    marcas_servidas = ARRAY['BLUEFISHING', 'EPICBIKE']::bi.tienda_tipo[],
    permite_venta_web = TRUE,
    permite_venta_fisica = TRUE,
    stock_visible_global = TRUE,
    prioridad_picking = 2,
    notas_operativas = 'Tienda retail y e-commerce (Bsale) - Stock compartido'
WHERE nombre ILIKE '%tienda%web%bsale%' OR nombre = 'Tienda y Web Bsale'
  AND notas_operativas IS NULL;

-- Actualizar cualquier bodega restante que no tenga notas
UPDATE bi.dim_bodegas SET
    notas_operativas = 'Bodega sincronizada desde Bsale - Configuración por defecto (compartida)'
WHERE notas_operativas IS NULL
  AND es_activa = TRUE;

-- Verificar resultado final
SELECT 
    nombre,
    canal,
    politica_stock,
    ARRAY_TO_STRING(marcas_servidas, ', ') AS marcas,
    permite_venta_web AS web,
    permite_venta_fisica AS fisica,
    stock_visible_global AS visible_global,
    prioridad_picking AS prioridad,
    notas_operativas
FROM bi.dim_bodegas
WHERE es_activa = TRUE
ORDER BY prioridad_picking, nombre;

-- ============================================================================
-- FIN DE MIGRACIÓN 015 (ACTUALIZADA)
-- ============================================================================
