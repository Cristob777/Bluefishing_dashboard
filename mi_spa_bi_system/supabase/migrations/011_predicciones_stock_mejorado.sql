-- ============================================================================
-- MI SPA BI SYSTEM - Mejoras de Stock y Predicciones
-- Sincronización de bodegas, stock en productos, predicciones automáticas
-- ============================================================================

-- Actualizar bodegas con IDs de Bsale (basado en offices de la API)
UPDATE bi.dim_bodegas SET bsale_office_id = 4 WHERE codigo = 'CASA_MATRIZ';
UPDATE bi.dim_bodegas SET bsale_office_id = 2 WHERE codigo = 'TIENDA_WEB';

-- Agregar bodegas de EPICBIKE si no existen
INSERT INTO bi.dim_bodegas (codigo, nombre, tienda, bsale_office_id)
VALUES 
    ('EPICBIKE_MAIN', 'Tienda EPICBIKE', 'EPICBIKE', 2),
    ('EPICBIKE_WEB', 'EPICBIKE Web', 'EPICBIKE', 4)
ON CONFLICT (codigo) DO UPDATE SET bsale_office_id = EXCLUDED.bsale_office_id;

-- Agregar columna stock_actual a dim_productos si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'bi' AND table_name = 'dim_productos' AND column_name = 'stock_actual') THEN
        ALTER TABLE bi.dim_productos ADD COLUMN stock_actual INTEGER DEFAULT 0;
    END IF;
END $$;

-- ============================================================================
-- TABLA: Predicciones simplificada para el dashboard
-- ============================================================================
DROP TABLE IF EXISTS bi.predicciones CASCADE;
CREATE TABLE bi.predicciones (
    prediccion_id SERIAL PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL, -- 'venta', 'stock', 'cliente'
    nivel VARCHAR(50) NOT NULL, -- 'tienda', 'categoria', 'producto'
    nombre VARCHAR(255),
    tienda bi.tienda_tipo,
    fecha_prediccion DATE DEFAULT CURRENT_DATE,
    periodo VARCHAR(50), -- '30d', '60d', '90d'
    valor_actual NUMERIC(14,2) DEFAULT 0,
    valor_predicho NUMERIC(14,2) DEFAULT 0,
    limite_inferior NUMERIC(14,2),
    limite_superior NUMERIC(14,2),
    tendencia VARCHAR(20) CHECK (tendencia IN ('CRECIMIENTO', 'ESTABLE', 'DECRECIMIENTO')),
    confianza NUMERIC(5,2) DEFAULT 75,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_predicciones_tipo ON bi.predicciones(tipo, tienda);

-- ============================================================================
-- FUNCIÓN: Actualizar stock_actual en dim_productos
-- ============================================================================
CREATE OR REPLACE FUNCTION bi.actualizar_stock_productos()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    -- Actualizar stock desde fact_stock (última fecha)
    UPDATE bi.dim_productos p
    SET stock_actual = COALESCE(
        (SELECT SUM(s.cantidad) 
         FROM bi.fact_stock s 
         WHERE s.producto_id = p.producto_id 
         AND s.fecha = (SELECT MAX(fecha) FROM bi.fact_stock)),
        0
    );
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCIÓN: Generar predicciones de ventas
-- ============================================================================
CREATE OR REPLACE FUNCTION bi.generar_predicciones()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
    r RECORD;
    v_actual NUMERIC;
    v_predicho NUMERIC;
    v_tendencia VARCHAR(20);
    v_confianza NUMERIC;
    v_mes INTEGER;
    v_factor NUMERIC;
BEGIN
    -- Limpiar predicciones antiguas
    DELETE FROM bi.predicciones WHERE fecha_prediccion < CURRENT_DATE - 7;
    
    -- Obtener mes actual para estacionalidad
    v_mes := EXTRACT(MONTH FROM CURRENT_DATE);
    
    -- Predicciones por TIENDA
    FOR r IN 
        SELECT tienda, 
               SUM(total) as ventas_actual,
               SUM(CASE WHEN fecha >= CURRENT_DATE - 30 THEN total ELSE 0 END) as ventas_30d,
               SUM(CASE WHEN fecha >= CURRENT_DATE - 60 AND fecha < CURRENT_DATE - 30 THEN total ELSE 0 END) as ventas_30d_ant,
               COUNT(DISTINCT fecha) as dias_venta
        FROM bi.fact_ventas
        WHERE fecha >= CURRENT_DATE - 90
        GROUP BY tienda
    LOOP
        -- Calcular valores
        v_actual := r.ventas_30d;
        
        -- Factor estacional
        SELECT COALESCE(factor, 1.0) INTO v_factor
        FROM bi.factores_estacionalidad
        WHERE tienda = r.tienda AND mes = v_mes AND categoria_id IS NULL
        LIMIT 1;
        
        IF v_factor IS NULL THEN v_factor := 1.0; END IF;
        
        -- Predicción: promedio ajustado por estacionalidad
        v_predicho := (r.ventas_actual / 3.0) * v_factor;
        
        -- Tendencia
        IF r.ventas_30d_ant > 0 THEN
            IF r.ventas_30d > r.ventas_30d_ant * 1.1 THEN
                v_tendencia := 'CRECIMIENTO';
                v_confianza := 80 + LEAST(15, (r.ventas_30d / r.ventas_30d_ant - 1) * 50);
            ELSIF r.ventas_30d < r.ventas_30d_ant * 0.9 THEN
                v_tendencia := 'DECRECIMIENTO';
                v_confianza := 70;
            ELSE
                v_tendencia := 'ESTABLE';
                v_confianza := 85;
            END IF;
        ELSE
            v_tendencia := 'ESTABLE';
            v_confianza := 70;
        END IF;
        
        -- Insertar predicción 30d
        INSERT INTO bi.predicciones (tipo, nivel, nombre, tienda, periodo, valor_actual, valor_predicho, tendencia, confianza, limite_inferior, limite_superior)
        VALUES ('venta', 'tienda', r.tienda::text, r.tienda, '30d', v_actual, v_predicho, v_tendencia, v_confianza,
                v_predicho * 0.85, v_predicho * 1.15);
        v_count := v_count + 1;
        
        -- Predicción 60d
        INSERT INTO bi.predicciones (tipo, nivel, nombre, tienda, periodo, valor_actual, valor_predicho, tendencia, confianza, limite_inferior, limite_superior)
        VALUES ('venta', 'tienda', r.tienda::text, r.tienda, '60d', v_actual * 2, v_predicho * 2.1, v_tendencia, v_confianza - 5,
                v_predicho * 2 * 0.80, v_predicho * 2 * 1.20);
        v_count := v_count + 1;
        
        -- Predicción 90d
        INSERT INTO bi.predicciones (tipo, nivel, nombre, tienda, periodo, valor_actual, valor_predicho, tendencia, confianza, limite_inferior, limite_superior)
        VALUES ('venta', 'tienda', r.tienda::text, r.tienda, '90d', v_actual * 3, v_predicho * 3.15, v_tendencia, v_confianza - 10,
                v_predicho * 3 * 0.75, v_predicho * 3 * 1.25);
        v_count := v_count + 1;
    END LOOP;
    
    -- Predicciones por CATEGORÍA (top 10 por tienda)
    FOR r IN 
        SELECT c.categoria_id, c.nivel2_nombre as categoria, c.tienda,
               SUM(v.total) as ventas_90d,
               SUM(CASE WHEN v.fecha >= CURRENT_DATE - 30 THEN v.total ELSE 0 END) as ventas_30d
        FROM bi.fact_ventas v
        JOIN bi.dim_productos p ON v.producto_id = p.producto_id
        JOIN bi.dim_categorias c ON p.categoria_id = c.categoria_id
        WHERE v.fecha >= CURRENT_DATE - 90
        GROUP BY c.categoria_id, c.nivel2_nombre, c.tienda
        ORDER BY ventas_90d DESC
        LIMIT 20
    LOOP
        v_predicho := (r.ventas_90d / 3.0);
        
        INSERT INTO bi.predicciones (tipo, nivel, nombre, tienda, periodo, valor_actual, valor_predicho, tendencia, confianza)
        VALUES ('venta', 'categoria', r.categoria, r.tienda, '30d', r.ventas_30d, v_predicho, 'ESTABLE', 75);
        v_count := v_count + 1;
    END LOOP;
    
    -- Predicciones por PRODUCTO (top 20 por tienda)
    FOR r IN 
        SELECT p.producto_id, p.nombre, p.tienda,
               SUM(v.total) as ventas_90d,
               SUM(CASE WHEN v.fecha >= CURRENT_DATE - 30 THEN v.total ELSE 0 END) as ventas_30d,
               SUM(CASE WHEN v.fecha >= CURRENT_DATE - 60 AND v.fecha < CURRENT_DATE - 30 THEN v.total ELSE 0 END) as ventas_30d_ant
        FROM bi.fact_ventas v
        JOIN bi.dim_productos p ON v.producto_id = p.producto_id
        WHERE v.fecha >= CURRENT_DATE - 90
        GROUP BY p.producto_id, p.nombre, p.tienda
        ORDER BY ventas_90d DESC
        LIMIT 40
    LOOP
        v_predicho := (r.ventas_90d / 3.0);
        
        IF r.ventas_30d_ant > 0 AND r.ventas_30d > r.ventas_30d_ant * 1.1 THEN
            v_tendencia := 'CRECIMIENTO';
        ELSIF r.ventas_30d_ant > 0 AND r.ventas_30d < r.ventas_30d_ant * 0.9 THEN
            v_tendencia := 'DECRECIMIENTO';
        ELSE
            v_tendencia := 'ESTABLE';
        END IF;
        
        INSERT INTO bi.predicciones (tipo, nivel, nombre, tienda, periodo, valor_actual, valor_predicho, tendencia, confianza)
        VALUES ('venta', 'producto', LEFT(r.nombre, 100), r.tienda, '30d', r.ventas_30d, v_predicho, v_tendencia, 70);
        v_count := v_count + 1;
    END LOOP;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VISTA: Resumen de cobranza mejorada
-- ============================================================================
CREATE OR REPLACE VIEW bi.v_cobranza_resumen AS
SELECT 
    tienda,
    estado::text as estado,
    COUNT(*) as num_documentos,
    SUM(monto_original) as monto_total,
    SUM(monto_pagado) as monto_pagado,
    SUM(monto_original - monto_pagado) as monto_pendiente
FROM bi.fact_cobranza
GROUP BY tienda, estado;

-- ============================================================================
-- VISTA: Stock por producto mejorado
-- ============================================================================
CREATE OR REPLACE VIEW bi.v_stock_productos AS
SELECT 
    p.producto_id,
    p.nombre,
    p.sku,
    p.tienda,
    p.categoria_id,
    p.precio_venta,
    p.precio_costo,
    COALESCE(p.stock_actual, 0) as stock_actual,
    COALESCE(s.stock_total, 0) as stock_fact,
    CASE 
        WHEN COALESCE(p.stock_actual, 0) = 0 THEN 'SIN_STOCK'
        WHEN COALESCE(p.stock_actual, 0) <= 5 THEN 'CRITICO'
        WHEN COALESCE(p.stock_actual, 0) <= 10 THEN 'BAJO'
        ELSE 'OK'
    END as estado_stock
FROM bi.dim_productos p
LEFT JOIN (
    SELECT producto_id, SUM(cantidad) as stock_total
    FROM bi.fact_stock
    WHERE fecha = (SELECT MAX(fecha) FROM bi.fact_stock)
    GROUP BY producto_id
) s ON p.producto_id = s.producto_id
WHERE p.es_activo = TRUE;

-- ============================================================================
-- VISTA: Rotación de inventario mejorada
-- ============================================================================
CREATE OR REPLACE VIEW bi.v_rotacion_inventario AS
SELECT 
    p.producto_id,
    p.nombre,
    p.tienda,
    p.stock_actual,
    COALESCE(v.unidades_vendidas, 0) as unidades_vendidas,
    COALESCE(v.venta_total, 0) as venta_total,
    CASE 
        WHEN COALESCE(v.unidades_vendidas, 0) = 0 THEN NULL
        ELSE ROUND(p.stock_actual::numeric / (COALESCE(v.unidades_vendidas, 1)::numeric / 30), 0)
    END as dias_stock,
    CASE 
        WHEN COALESCE(v.unidades_vendidas, 0) = 0 THEN 0
        ELSE ROUND(COALESCE(v.unidades_vendidas, 0)::numeric / NULLIF(p.stock_actual, 0), 2)
    END as rotacion,
    CASE 
        WHEN p.stock_actual = 0 THEN 'SIN_STOCK'
        WHEN COALESCE(v.unidades_vendidas, 0) = 0 THEN 'SIN_MOVIMIENTO'
        ELSE 'ACTIVO'
    END as clasificacion,
    CASE 
        WHEN p.stock_actual = 0 THEN 'ROJO'
        WHEN COALESCE(v.unidades_vendidas, 0) > p.stock_actual THEN 'ROJO'
        WHEN COALESCE(v.unidades_vendidas, 0) * 2 > p.stock_actual THEN 'AMARILLO'
        ELSE 'VERDE'
    END as semaforo
FROM bi.dim_productos p
LEFT JOIN (
    SELECT producto_id, SUM(cantidad) as unidades_vendidas, SUM(total) as venta_total
    FROM bi.fact_ventas
    WHERE fecha >= CURRENT_DATE - 30
    GROUP BY producto_id
) v ON p.producto_id = v.producto_id
WHERE p.es_activo = TRUE;

-- ============================================================================
-- VISTA: Análisis ABC mejorado
-- ============================================================================
CREATE OR REPLACE VIEW bi.v_analisis_abc AS
WITH ventas_producto AS (
    SELECT 
        p.producto_id,
        p.nombre,
        p.tienda,
        c.nivel2_nombre as categoria,
        p.precio_venta,
        COALESCE(SUM(v.cantidad), 0) as unidades_vendidas,
        COALESCE(SUM(v.total), 0) as venta_total
    FROM bi.dim_productos p
    LEFT JOIN bi.dim_categorias c ON p.categoria_id = c.categoria_id
    LEFT JOIN bi.fact_ventas v ON p.producto_id = v.producto_id AND v.fecha >= CURRENT_DATE - 90
    WHERE p.es_activo = TRUE
    GROUP BY p.producto_id, p.nombre, p.tienda, c.nivel2_nombre, p.precio_venta
),
ranking AS (
    SELECT *,
           SUM(venta_total) OVER (PARTITION BY tienda ORDER BY venta_total DESC) as acumulado,
           SUM(venta_total) OVER (PARTITION BY tienda) as total_tienda
    FROM ventas_producto
    WHERE venta_total > 0
)
SELECT 
    producto_id,
    nombre,
    tienda,
    categoria,
    precio_venta,
    unidades_vendidas,
    venta_total,
    CASE 
        WHEN acumulado <= total_tienda * 0.8 THEN 'A'
        WHEN acumulado <= total_tienda * 0.95 THEN 'B'
        ELSE 'C'
    END as clasificacion
FROM ranking
ORDER BY tienda, venta_total DESC;

-- Ejecutar generación inicial de predicciones
SELECT bi.generar_predicciones();
SELECT bi.actualizar_stock_productos();

-- GRANTS
GRANT SELECT ON bi.predicciones TO authenticated, anon;
GRANT SELECT ON bi.v_cobranza_resumen TO authenticated, anon;
GRANT SELECT ON bi.v_stock_productos TO authenticated, anon;
GRANT SELECT ON bi.v_rotacion_inventario TO authenticated, anon;
GRANT SELECT ON bi.v_analisis_abc TO authenticated, anon;
GRANT ALL ON bi.predicciones TO service_role;
GRANT EXECUTE ON FUNCTION bi.generar_predicciones() TO service_role;
GRANT EXECUTE ON FUNCTION bi.actualizar_stock_productos() TO service_role;
