-- ============================================================================
-- MI SPA BI SYSTEM - Sistema de Predicciones y Alertas
-- Forecasting de ventas, alertas de stock, riesgo de mora
-- ============================================================================

-- TABLA: Predicciones de Ventas
CREATE TABLE bi.predicciones_ventas (
    prediccion_id SERIAL PRIMARY KEY,
    fecha_generacion TIMESTAMPTZ DEFAULT NOW(),
    tienda bi.tienda_tipo NOT NULL,
    producto_id INTEGER REFERENCES bi.dim_productos(producto_id),
    categoria_id INTEGER REFERENCES bi.dim_categorias(categoria_id),
    nivel VARCHAR(20) NOT NULL CHECK (nivel IN ('TIENDA', 'CATEGORIA', 'PRODUCTO')),
    periodo_dias INTEGER NOT NULL CHECK (periodo_dias IN (30, 60, 90)),
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    venta_proyectada NUMERIC(14,2) NOT NULL,
    unidades_proyectadas INTEGER,
    confianza NUMERIC(5,2), -- Porcentaje de confianza
    tendencia VARCHAR(20) CHECK (tendencia IN ('CRECIENTE', 'ESTABLE', 'DECRECIENTE')),
    factor_estacionalidad NUMERIC(5,3) DEFAULT 1.0,
    notas TEXT
);

CREATE INDEX idx_pred_ventas_tienda ON bi.predicciones_ventas(tienda, fecha_generacion DESC);
CREATE INDEX idx_pred_ventas_producto ON bi.predicciones_ventas(producto_id);

-- TABLA: Alertas del Sistema
CREATE TYPE bi.alerta_tipo AS ENUM (
    'QUIEBRE_STOCK',           -- Stock por agotarse
    'STOCK_CRITICO',           -- Stock muy bajo
    'SOBRESTOCK',              -- Exceso de inventario
    'VENTA_INUSUAL',           -- Venta muy alta o baja
    'MORA_CLIENTE',            -- Cliente en riesgo de mora
    'MORA_CRITICA',            -- Mora mayor a 60 días
    'FLUJO_CAJA_RIESGO',       -- Flujo de caja proyectado negativo
    'TENDENCIA_NEGATIVA',      -- Tendencia de ventas a la baja
    'OPORTUNIDAD_VENTA'        -- Oportunidad identificada
);

CREATE TYPE bi.alerta_prioridad AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'CRITICA');
CREATE TYPE bi.alerta_estado AS ENUM ('ACTIVA', 'VISTA', 'RESUELTA', 'IGNORADA');

CREATE TABLE bi.alertas (
    alerta_id SERIAL PRIMARY KEY,
    tipo bi.alerta_tipo NOT NULL,
    prioridad bi.alerta_prioridad NOT NULL DEFAULT 'MEDIA',
    estado bi.alerta_estado DEFAULT 'ACTIVA',
    tienda bi.tienda_tipo,
    producto_id INTEGER REFERENCES bi.dim_productos(producto_id),
    cliente_id INTEGER REFERENCES bi.dim_clientes(cliente_id),
    titulo VARCHAR(200) NOT NULL,
    mensaje TEXT NOT NULL,
    datos JSONB,
    fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
    fecha_visto TIMESTAMPTZ,
    fecha_resolucion TIMESTAMPTZ,
    accion_sugerida TEXT
);

CREATE INDEX idx_alertas_estado ON bi.alertas(estado, prioridad DESC);
CREATE INDEX idx_alertas_tienda ON bi.alertas(tienda, fecha_creacion DESC);

-- TABLA: Sugerencias de Reposición
CREATE TABLE bi.sugerencias_reposicion (
    sugerencia_id SERIAL PRIMARY KEY,
    fecha_generacion TIMESTAMPTZ DEFAULT NOW(),
    producto_id INTEGER NOT NULL REFERENCES bi.dim_productos(producto_id),
    tienda bi.tienda_tipo NOT NULL,
    stock_actual INTEGER NOT NULL,
    stock_minimo_sugerido INTEGER NOT NULL,
    cantidad_sugerir INTEGER NOT NULL,
    dias_cobertura_actual INTEGER, -- Días que dura el stock actual
    dias_cobertura_objetivo INTEGER DEFAULT 30,
    venta_promedio_diaria NUMERIC(10,2),
    urgencia bi.alerta_prioridad DEFAULT 'MEDIA',
    razon TEXT,
    estado VARCHAR(20) DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'COMPLETADA'))
);

CREATE INDEX idx_sugerencias_urgencia ON bi.sugerencias_reposicion(urgencia DESC, fecha_generacion DESC);

-- TABLA: Proyecciones de Flujo de Caja
CREATE TABLE bi.proyecciones_flujo_caja (
    proyeccion_id SERIAL PRIMARY KEY,
    fecha_generacion TIMESTAMPTZ DEFAULT NOW(),
    tienda bi.tienda_tipo,
    mes DATE NOT NULL, -- Primer día del mes
    ingresos_proyectados NUMERIC(14,2) NOT NULL,
    cobranza_proyectada NUMERIC(14,2) NOT NULL,
    ingresos_realizados NUMERIC(14,2) DEFAULT 0,
    cobranza_realizada NUMERIC(14,2) DEFAULT 0,
    diferencia NUMERIC(14,2) GENERATED ALWAYS AS (ingresos_realizados - ingresos_proyectados) STORED,
    notas TEXT
);

-- TABLA: Análisis de Riesgo de Mora
CREATE TABLE bi.riesgo_mora (
    riesgo_id SERIAL PRIMARY KEY,
    fecha_calculo TIMESTAMPTZ DEFAULT NOW(),
    cliente_id INTEGER NOT NULL REFERENCES bi.dim_clientes(cliente_id),
    tienda bi.tienda_tipo NOT NULL,
    monto_pendiente NUMERIC(14,2) NOT NULL,
    dias_promedio_mora INTEGER,
    documentos_vencidos INTEGER DEFAULT 0,
    score_riesgo INTEGER CHECK (score_riesgo BETWEEN 0 AND 100), -- 0=bajo, 100=alto
    categoria_riesgo VARCHAR(20) CHECK (categoria_riesgo IN ('BAJO', 'MEDIO', 'ALTO', 'CRITICO')),
    probabilidad_mora NUMERIC(5,2),
    accion_sugerida TEXT
);

CREATE INDEX idx_riesgo_mora_score ON bi.riesgo_mora(score_riesgo DESC);

-- TABLA: Factores de Estacionalidad
CREATE TABLE bi.factores_estacionalidad (
    factor_id SERIAL PRIMARY KEY,
    tienda bi.tienda_tipo NOT NULL,
    mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
    categoria_id INTEGER REFERENCES bi.dim_categorias(categoria_id),
    factor NUMERIC(5,3) NOT NULL DEFAULT 1.0, -- 1.0 = normal, >1 = alta, <1 = baja
    descripcion TEXT,
    UNIQUE (tienda, mes, categoria_id)
);

-- Insertar factores de estacionalidad base
-- BLUEFISHING: Temporada alta en verano (Dic-Feb en Chile)
INSERT INTO bi.factores_estacionalidad (tienda, mes, factor, descripcion) VALUES
    ('BLUEFISHING', 1, 1.4, 'Verano - Temporada alta pesca'),
    ('BLUEFISHING', 2, 1.3, 'Verano - Temporada alta pesca'),
    ('BLUEFISHING', 3, 1.1, 'Fin verano'),
    ('BLUEFISHING', 4, 0.9, 'Otoño - Baja temporada'),
    ('BLUEFISHING', 5, 0.8, 'Otoño - Baja temporada'),
    ('BLUEFISHING', 6, 0.7, 'Invierno - Temporada baja'),
    ('BLUEFISHING', 7, 0.7, 'Invierno - Temporada baja'),
    ('BLUEFISHING', 8, 0.8, 'Invierno - Recuperación'),
    ('BLUEFISHING', 9, 0.9, 'Primavera - Pre-temporada'),
    ('BLUEFISHING', 10, 1.0, 'Primavera - Pre-temporada'),
    ('BLUEFISHING', 11, 1.2, 'Pre-verano'),
    ('BLUEFISHING', 12, 1.5, 'Verano - Inicio temporada alta');

-- EPICBIKE: Temporada alta en primavera/verano, con peaks en fechas especiales
INSERT INTO bi.factores_estacionalidad (tienda, mes, factor, descripcion) VALUES
    ('EPICBIKE', 1, 1.0, 'Verano - Ciclismo activo'),
    ('EPICBIKE', 2, 0.9, 'Verano - Fin vacaciones'),
    ('EPICBIKE', 3, 1.1, 'Otoño - Retorno actividades'),
    ('EPICBIKE', 4, 1.0, 'Otoño'),
    ('EPICBIKE', 5, 0.8, 'Otoño - Pre-invierno'),
    ('EPICBIKE', 6, 0.7, 'Invierno - Temporada baja'),
    ('EPICBIKE', 7, 0.7, 'Invierno - Temporada baja'),
    ('EPICBIKE', 8, 0.8, 'Invierno - Recuperación'),
    ('EPICBIKE', 9, 1.2, 'Primavera - Alta demanda'),
    ('EPICBIKE', 10, 1.3, 'Primavera - Temporada alta'),
    ('EPICBIKE', 11, 1.2, 'Primavera - Pre-verano'),
    ('EPICBIKE', 12, 1.1, 'Navidad - Regalos');

-- ============================================================================
-- FUNCIONES DE PREDICCIÓN Y ANÁLISIS
-- ============================================================================

-- Función: Calcular venta promedio diaria de un producto
CREATE OR REPLACE FUNCTION bi.calcular_venta_promedio_diaria(
    p_producto_id INTEGER,
    p_dias INTEGER DEFAULT 90
) RETURNS NUMERIC AS $$
DECLARE
    v_total NUMERIC;
    v_dias_con_venta INTEGER;
BEGIN
    SELECT 
        COALESCE(SUM(cantidad), 0),
        COUNT(DISTINCT fecha)
    INTO v_total, v_dias_con_venta
    FROM bi.fact_ventas
    WHERE producto_id = p_producto_id
    AND fecha >= CURRENT_DATE - p_dias;
    
    IF v_dias_con_venta = 0 THEN RETURN 0; END IF;
    RETURN ROUND(v_total::NUMERIC / p_dias, 2);
END;
$$ LANGUAGE plpgsql STABLE;

-- Función: Calcular días de cobertura de stock
CREATE OR REPLACE FUNCTION bi.calcular_dias_cobertura(
    p_producto_id INTEGER
) RETURNS INTEGER AS $$
DECLARE
    v_stock INTEGER;
    v_venta_diaria NUMERIC;
BEGIN
    SELECT COALESCE(SUM(cantidad), 0) INTO v_stock
    FROM bi.fact_stock
    WHERE producto_id = p_producto_id
    AND fecha = (SELECT MAX(fecha) FROM bi.fact_stock);
    
    v_venta_diaria := bi.calcular_venta_promedio_diaria(p_producto_id, 90);
    
    IF v_venta_diaria <= 0 THEN RETURN 999; END IF;
    RETURN FLOOR(v_stock / v_venta_diaria);
END;
$$ LANGUAGE plpgsql STABLE;

-- Función: Generar predicción de ventas para una tienda
CREATE OR REPLACE FUNCTION bi.generar_prediccion_ventas(
    p_tienda bi.tienda_tipo,
    p_periodo_dias INTEGER DEFAULT 30
) RETURNS TABLE(
    nivel TEXT,
    nombre TEXT,
    venta_proyectada NUMERIC,
    tendencia TEXT,
    factor_estacional NUMERIC
) AS $$
DECLARE
    v_mes_objetivo INTEGER;
    v_factor_estacional NUMERIC;
    v_venta_base NUMERIC;
    v_tendencia TEXT;
BEGIN
    -- Mes objetivo para factor estacional
    v_mes_objetivo := EXTRACT(MONTH FROM CURRENT_DATE + p_periodo_dias / 2);
    
    -- Obtener factor estacional
    SELECT COALESCE(f.factor, 1.0) INTO v_factor_estacional
    FROM bi.factores_estacionalidad f
    WHERE f.tienda = p_tienda AND f.mes = v_mes_objetivo AND f.categoria_id IS NULL
    LIMIT 1;
    
    IF v_factor_estacional IS NULL THEN v_factor_estacional := 1.0; END IF;
    
    -- Calcular venta base (promedio de los últimos 3 meses)
    SELECT COALESCE(SUM(total) / 90 * p_periodo_dias, 0) INTO v_venta_base
    FROM bi.fact_ventas
    WHERE tienda = p_tienda
    AND fecha >= CURRENT_DATE - 90;
    
    -- Determinar tendencia comparando últimos 30 días vs 30 días anteriores
    WITH periodos AS (
        SELECT 
            SUM(CASE WHEN fecha >= CURRENT_DATE - 30 THEN total ELSE 0 END) as reciente,
            SUM(CASE WHEN fecha >= CURRENT_DATE - 60 AND fecha < CURRENT_DATE - 30 THEN total ELSE 0 END) as anterior
        FROM bi.fact_ventas
        WHERE tienda = p_tienda
    )
    SELECT CASE 
        WHEN reciente > anterior * 1.1 THEN 'CRECIENTE'
        WHEN reciente < anterior * 0.9 THEN 'DECRECIENTE'
        ELSE 'ESTABLE'
    END INTO v_tendencia
    FROM periodos;
    
    RETURN QUERY SELECT 
        'TIENDA'::TEXT,
        p_tienda::TEXT,
        ROUND(v_venta_base * v_factor_estacional, 0),
        v_tendencia,
        v_factor_estacional;
END;
$$ LANGUAGE plpgsql;

-- Función: Detectar productos con riesgo de quiebre de stock
CREATE OR REPLACE FUNCTION bi.detectar_quiebres_stock()
RETURNS TABLE(
    producto_id INTEGER,
    nombre VARCHAR,
    tienda bi.tienda_tipo,
    stock_actual INTEGER,
    dias_cobertura INTEGER,
    venta_diaria NUMERIC,
    urgencia bi.alerta_prioridad,
    accion TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH stock_actual AS (
        SELECT 
            s.producto_id,
            p.nombre,
            p.tienda,
            SUM(s.cantidad) as stock,
            bi.calcular_venta_promedio_diaria(s.producto_id, 90) as venta_diaria
        FROM bi.fact_stock s
        JOIN bi.dim_productos p ON s.producto_id = p.producto_id
        WHERE s.fecha = (SELECT MAX(fecha) FROM bi.fact_stock)
        AND p.es_activo = TRUE
        GROUP BY s.producto_id, p.nombre, p.tienda
    )
    SELECT 
        sa.producto_id,
        sa.nombre,
        sa.tienda,
        sa.stock::INTEGER,
        CASE 
            WHEN sa.venta_diaria > 0 THEN FLOOR(sa.stock / sa.venta_diaria)::INTEGER
            ELSE 999
        END as dias_cobertura,
        sa.venta_diaria,
        CASE 
            WHEN sa.stock = 0 THEN 'CRITICA'::bi.alerta_prioridad
            WHEN sa.venta_diaria > 0 AND sa.stock / sa.venta_diaria < 7 THEN 'ALTA'::bi.alerta_prioridad
            WHEN sa.venta_diaria > 0 AND sa.stock / sa.venta_diaria < 14 THEN 'MEDIA'::bi.alerta_prioridad
            WHEN sa.venta_diaria > 0 AND sa.stock / sa.venta_diaria < 30 THEN 'BAJA'::bi.alerta_prioridad
            ELSE NULL
        END as urgencia,
        CASE 
            WHEN sa.stock = 0 THEN 'REPONER INMEDIATAMENTE'
            WHEN sa.venta_diaria > 0 AND sa.stock / sa.venta_diaria < 7 THEN 'Reponer esta semana'
            WHEN sa.venta_diaria > 0 AND sa.stock / sa.venta_diaria < 14 THEN 'Planificar reposición'
            ELSE 'Monitorear'
        END as accion
    FROM stock_actual sa
    WHERE sa.venta_diaria > 0 AND sa.stock / sa.venta_diaria < 30
    ORDER BY 
        CASE 
            WHEN sa.stock = 0 THEN 0
            WHEN sa.venta_diaria > 0 THEN sa.stock / sa.venta_diaria
            ELSE 999
        END ASC;
END;
$$ LANGUAGE plpgsql;

-- Función: Calcular riesgo de mora de clientes
CREATE OR REPLACE FUNCTION bi.calcular_riesgo_mora()
RETURNS TABLE(
    cliente_id INTEGER,
    razon_social VARCHAR,
    tienda bi.tienda_tipo,
    monto_pendiente NUMERIC,
    documentos_vencidos INTEGER,
    dias_promedio_mora INTEGER,
    score_riesgo INTEGER,
    categoria_riesgo VARCHAR,
    accion_sugerida TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH mora_cliente AS (
        SELECT 
            c.cliente_id,
            cl.razon_social,
            c.tienda,
            SUM(c.monto_original - c.monto_pagado) as pendiente,
            COUNT(*) FILTER (WHERE CURRENT_DATE > c.fecha_vencimiento) as docs_vencidos,
            AVG(GREATEST(CURRENT_DATE - c.fecha_vencimiento, 0)) FILTER (WHERE CURRENT_DATE > c.fecha_vencimiento) as dias_mora
        FROM bi.fact_cobranza c
        JOIN bi.dim_clientes cl ON c.cliente_id = cl.cliente_id
        WHERE c.estado IN ('PENDIENTE', 'PARCIAL', 'VENCIDO')
        GROUP BY c.cliente_id, cl.razon_social, c.tienda
        HAVING SUM(c.monto_original - c.monto_pagado) > 0
    )
    SELECT 
        mc.cliente_id,
        mc.razon_social,
        mc.tienda,
        mc.pendiente,
        mc.docs_vencidos::INTEGER,
        COALESCE(mc.dias_mora, 0)::INTEGER,
        -- Score: combinación de monto, días mora y documentos vencidos
        LEAST(100, (
            COALESCE(mc.dias_mora, 0) * 0.5 + -- Peso días mora
            mc.docs_vencidos * 10 + -- Peso documentos
            CASE WHEN mc.pendiente > 1000000 THEN 20 WHEN mc.pendiente > 500000 THEN 10 ELSE 0 END
        ))::INTEGER as score,
        CASE 
            WHEN COALESCE(mc.dias_mora, 0) > 90 OR mc.docs_vencidos > 5 THEN 'CRITICO'
            WHEN COALESCE(mc.dias_mora, 0) > 60 OR mc.docs_vencidos > 3 THEN 'ALTO'
            WHEN COALESCE(mc.dias_mora, 0) > 30 OR mc.docs_vencidos > 1 THEN 'MEDIO'
            ELSE 'BAJO'
        END::VARCHAR as categoria,
        CASE 
            WHEN COALESCE(mc.dias_mora, 0) > 90 THEN 'Gestión de cobranza urgente - Considerar medidas legales'
            WHEN COALESCE(mc.dias_mora, 0) > 60 THEN 'Contactar cliente - Negociar plan de pago'
            WHEN COALESCE(mc.dias_mora, 0) > 30 THEN 'Enviar recordatorio de pago'
            WHEN mc.docs_vencidos > 0 THEN 'Seguimiento preventivo'
            ELSE 'Cliente al día'
        END as accion
    FROM mora_cliente mc
    ORDER BY 
        COALESCE(mc.dias_mora, 0) DESC,
        mc.pendiente DESC;
END;
$$ LANGUAGE plpgsql;

-- Función: Proyectar flujo de caja
CREATE OR REPLACE FUNCTION bi.proyectar_flujo_caja(
    p_tienda bi.tienda_tipo DEFAULT NULL,
    p_meses INTEGER DEFAULT 3
) RETURNS TABLE(
    mes DATE,
    tienda bi.tienda_tipo,
    ventas_proyectadas NUMERIC,
    cobranza_proyectada NUMERIC,
    cobranza_vencida NUMERIC,
    flujo_neto_proyectado NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH meses AS (
        SELECT DATE_TRUNC('month', CURRENT_DATE + (n || ' months')::INTERVAL)::DATE as mes
        FROM generate_series(0, p_meses - 1) n
    ),
    ventas_historicas AS (
        SELECT 
            v.tienda,
            EXTRACT(MONTH FROM v.fecha)::INTEGER as mes_num,
            AVG(SUM(v.total)) OVER (PARTITION BY v.tienda) as promedio_mensual
        FROM bi.fact_ventas v
        WHERE v.fecha >= CURRENT_DATE - INTERVAL '12 months'
        AND (p_tienda IS NULL OR v.tienda = p_tienda)
        GROUP BY v.tienda, EXTRACT(MONTH FROM v.fecha)
    ),
    cobranza_pendiente AS (
        SELECT 
            c.tienda,
            DATE_TRUNC('month', COALESCE(c.fecha_vencimiento, CURRENT_DATE))::DATE as mes_venc,
            SUM(c.monto_original - c.monto_pagado) as pendiente
        FROM bi.fact_cobranza c
        WHERE c.estado IN ('PENDIENTE', 'PARCIAL', 'VENCIDO')
        AND (p_tienda IS NULL OR c.tienda = p_tienda)
        GROUP BY c.tienda, DATE_TRUNC('month', COALESCE(c.fecha_vencimiento, CURRENT_DATE))
    )
    SELECT 
        m.mes,
        t.tienda,
        COALESCE(vh.promedio_mensual * COALESCE(fe.factor, 1.0), 0) as ventas_proy,
        COALESCE(cp.pendiente, 0) as cobranza_proy,
        SUM(COALESCE(cp2.pendiente, 0)) FILTER (WHERE cp2.mes_venc < m.mes) as cobranza_venc,
        COALESCE(vh.promedio_mensual * COALESCE(fe.factor, 1.0), 0) + COALESCE(cp.pendiente, 0) as flujo_neto
    FROM meses m
    CROSS JOIN (SELECT DISTINCT tienda FROM bi.dim_productos WHERE (p_tienda IS NULL OR tienda = p_tienda)) t
    LEFT JOIN ventas_historicas vh ON vh.tienda = t.tienda
    LEFT JOIN bi.factores_estacionalidad fe ON fe.tienda = t.tienda 
        AND fe.mes = EXTRACT(MONTH FROM m.mes) AND fe.categoria_id IS NULL
    LEFT JOIN cobranza_pendiente cp ON cp.tienda = t.tienda AND cp.mes_venc = m.mes
    LEFT JOIN cobranza_pendiente cp2 ON cp2.tienda = t.tienda
    GROUP BY m.mes, t.tienda, vh.promedio_mensual, fe.factor, cp.pendiente
    ORDER BY t.tienda, m.mes;
END;
$$ LANGUAGE plpgsql;

-- Función: Generar todas las alertas activas
CREATE OR REPLACE FUNCTION bi.generar_alertas_sistema()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
    r RECORD;
BEGIN
    -- Limpiar alertas resueltas antiguas
    DELETE FROM bi.alertas WHERE estado = 'RESUELTA' AND fecha_resolucion < NOW() - INTERVAL '30 days';
    
    -- Alertas de quiebre de stock
    FOR r IN SELECT * FROM bi.detectar_quiebres_stock() WHERE urgencia IS NOT NULL LOOP
        INSERT INTO bi.alertas (tipo, prioridad, tienda, producto_id, titulo, mensaje, accion_sugerida, datos)
        VALUES (
            CASE WHEN r.stock_actual = 0 THEN 'QUIEBRE_STOCK' ELSE 'STOCK_CRITICO' END,
            r.urgencia,
            r.tienda,
            r.producto_id,
            CASE WHEN r.stock_actual = 0 THEN 'QUIEBRE DE STOCK: ' ELSE 'Stock Crítico: ' END || r.nombre,
            'Stock actual: ' || r.stock_actual || ' unidades. Cobertura: ' || r.dias_cobertura || ' días. Venta diaria promedio: ' || r.venta_diaria,
            r.accion,
            jsonb_build_object('stock', r.stock_actual, 'dias_cobertura', r.dias_cobertura, 'venta_diaria', r.venta_diaria)
        )
        ON CONFLICT DO NOTHING;
        v_count := v_count + 1;
    END LOOP;
    
    -- Alertas de mora
    FOR r IN SELECT * FROM bi.calcular_riesgo_mora() WHERE categoria_riesgo IN ('ALTO', 'CRITICO') LOOP
        INSERT INTO bi.alertas (tipo, prioridad, tienda, cliente_id, titulo, mensaje, accion_sugerida, datos)
        VALUES (
            CASE WHEN r.categoria_riesgo = 'CRITICO' THEN 'MORA_CRITICA' ELSE 'MORA_CLIENTE' END,
            CASE WHEN r.categoria_riesgo = 'CRITICO' THEN 'CRITICA' ELSE 'ALTA' END,
            r.tienda,
            r.cliente_id,
            'Riesgo de mora: ' || r.razon_social,
            'Monto pendiente: $' || TO_CHAR(r.monto_pendiente, 'FM999,999,999') || '. Documentos vencidos: ' || r.documentos_vencidos || '. Días promedio mora: ' || r.dias_promedio_mora,
            r.accion_sugerida,
            jsonb_build_object('monto', r.monto_pendiente, 'docs_vencidos', r.documentos_vencidos, 'dias_mora', r.dias_promedio_mora, 'score', r.score_riesgo)
        )
        ON CONFLICT DO NOTHING;
        v_count := v_count + 1;
    END LOOP;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Vista: Dashboard de alertas activas
CREATE OR REPLACE VIEW bi.v_alertas_activas AS
SELECT 
    a.*,
    p.nombre as producto_nombre,
    p.sku,
    c.razon_social as cliente_nombre,
    c.rut
FROM bi.alertas a
LEFT JOIN bi.dim_productos p ON a.producto_id = p.producto_id
LEFT JOIN bi.dim_clientes c ON a.cliente_id = c.cliente_id
WHERE a.estado = 'ACTIVA'
ORDER BY 
    CASE a.prioridad 
        WHEN 'CRITICA' THEN 0 
        WHEN 'ALTA' THEN 1 
        WHEN 'MEDIA' THEN 2 
        ELSE 3 
    END,
    a.fecha_creacion DESC;

-- Vista: Resumen de predicciones
CREATE OR REPLACE VIEW bi.v_predicciones_resumen AS
SELECT 
    tienda,
    nivel,
    periodo_dias,
    SUM(venta_proyectada) as total_proyectado,
    AVG(confianza) as confianza_promedio,
    MAX(fecha_generacion) as ultima_actualizacion
FROM bi.predicciones_ventas
WHERE fecha_generacion >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY tienda, nivel, periodo_dias
ORDER BY tienda, periodo_dias;

-- Grants
GRANT SELECT ON bi.predicciones_ventas TO authenticated;
GRANT SELECT ON bi.alertas TO authenticated;
GRANT SELECT ON bi.sugerencias_reposicion TO authenticated;
GRANT SELECT ON bi.proyecciones_flujo_caja TO authenticated;
GRANT SELECT ON bi.riesgo_mora TO authenticated;
GRANT SELECT ON bi.factores_estacionalidad TO authenticated;
GRANT SELECT ON bi.v_alertas_activas TO authenticated;
GRANT SELECT ON bi.v_predicciones_resumen TO authenticated;

GRANT ALL ON bi.predicciones_ventas TO service_role;
GRANT ALL ON bi.alertas TO service_role;
GRANT ALL ON bi.sugerencias_reposicion TO service_role;
GRANT ALL ON bi.proyecciones_flujo_caja TO service_role;
GRANT ALL ON bi.riesgo_mora TO service_role;
GRANT ALL ON bi.factores_estacionalidad TO service_role;

GRANT EXECUTE ON FUNCTION bi.calcular_venta_promedio_diaria(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION bi.calcular_dias_cobertura(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION bi.generar_prediccion_ventas(bi.tienda_tipo, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION bi.detectar_quiebres_stock() TO authenticated;
GRANT EXECUTE ON FUNCTION bi.calcular_riesgo_mora() TO authenticated;
GRANT EXECUTE ON FUNCTION bi.proyectar_flujo_caja(bi.tienda_tipo, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION bi.generar_alertas_sistema() TO service_role;

