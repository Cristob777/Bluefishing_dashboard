-- ============================================================================
-- MI SPA BI SYSTEM - Migración 017: Data Warehouse Inteligente
-- Fecha: 2026-01-30
-- ============================================================================
-- 
-- TRANSFORMACIÓN: De "Espejo de Bsale" a "Motor de Inteligencia de Negocios"
-- 
-- COMPONENTES:
-- 1. Star Schema optimizado (Hechos + Dimensiones enriquecidas)
-- 2. Dimensión Tiempo con eventos comerciales (CyberDay, Navidad, etc.)
-- 3. Motor de Forecasting (estructura para Prophet)
-- 4. Alertas predictivas de quiebre (Stock vs Forecast vs Lead Time)
-- 5. pgvector para RAG (Agente BI conversacional)
-- 6. Text-to-SQL (traducción de lenguaje natural a consultas)
-- ============================================================================

-- ============================================================================
-- PARTE 1: EXTENSIONES REQUERIDAS
-- ============================================================================

-- Habilitar pgvector para embeddings (RAG)
CREATE EXTENSION IF NOT EXISTS vector;

-- Habilitar pg_trgm para búsqueda fuzzy
CREATE EXTENSION IF NOT EXISTS pg_trgm;


-- ============================================================================
-- PARTE 2: DIMENSIÓN TIEMPO ENRIQUECIDA (Eventos Comerciales)
-- ============================================================================
-- La dim_tiempo original solo tiene datos básicos.
-- Agregamos eventos comerciales chilenos para análisis estacional.
-- ============================================================================

-- Agregar columnas de eventos comerciales
ALTER TABLE bi.dim_tiempo 
    ADD COLUMN IF NOT EXISTS es_feriado BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS nombre_feriado VARCHAR(100),
    ADD COLUMN IF NOT EXISTS es_cyber BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS es_black_friday BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS es_navidad BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS es_año_nuevo BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS es_fiestas_patrias BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS temporada VARCHAR(50),
    ADD COLUMN IF NOT EXISTS temporada_pesca VARCHAR(50),
    ADD COLUMN IF NOT EXISTS temporada_ciclismo VARCHAR(50),
    ADD COLUMN IF NOT EXISTS semana_del_año INTEGER,
    ADD COLUMN IF NOT EXISTS es_inicio_mes BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS es_fin_mes BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS es_quincena BOOLEAN DEFAULT FALSE;

-- Actualizar eventos comerciales chilenos
UPDATE bi.dim_tiempo SET
    -- Fiestas Patrias (18-19 Sept)
    es_fiestas_patrias = (mes = 9 AND dia BETWEEN 17 AND 20),
    nombre_feriado = CASE WHEN mes = 9 AND dia = 18 THEN 'Fiestas Patrias' 
                          WHEN mes = 9 AND dia = 19 THEN 'Glorias del Ejército' END,
    
    -- Navidad y Año Nuevo
    es_navidad = (mes = 12 AND dia BETWEEN 20 AND 26),
    es_año_nuevo = (mes = 12 AND dia >= 28) OR (mes = 1 AND dia <= 2),
    
    -- CyberDay Chile (primer lunes de octubre típicamente - simplificado)
    es_cyber = (mes = 10 AND dia BETWEEN 1 AND 5),
    
    -- Black Friday (cuarto viernes de noviembre)
    es_black_friday = (mes = 11 AND dia BETWEEN 24 AND 28),
    
    -- Feriados irrenunciables
    es_feriado = 
        (mes = 1 AND dia = 1) OR  -- Año Nuevo
        (mes = 5 AND dia = 1) OR  -- Día del Trabajo
        (mes = 9 AND dia IN (18, 19)) OR  -- Fiestas Patrias
        (mes = 12 AND dia = 25) OR -- Navidad
        (mes = 12 AND dia = 31),   -- Fin de año
    
    -- Temporadas
    temporada = CASE 
        WHEN mes IN (12, 1, 2) THEN 'VERANO'
        WHEN mes IN (3, 4, 5) THEN 'OTOÑO'
        WHEN mes IN (6, 7, 8) THEN 'INVIERNO'
        ELSE 'PRIMAVERA'
    END,
    
    -- Temporada de pesca (BLUEFISHING) - Alta en verano
    temporada_pesca = CASE 
        WHEN mes IN (12, 1, 2, 3) THEN 'ALTA'
        WHEN mes IN (4, 5, 10, 11) THEN 'MEDIA'
        ELSE 'BAJA'
    END,
    
    -- Temporada de ciclismo (EPICBIKE) - Alta en primavera/verano
    temporada_ciclismo = CASE 
        WHEN mes IN (9, 10, 11, 12, 1, 2, 3) THEN 'ALTA'
        WHEN mes IN (4, 5, 8) THEN 'MEDIA'
        ELSE 'BAJA'
    END,
    
    -- Semana del año
    semana_del_año = EXTRACT(WEEK FROM fecha),
    
    -- Indicadores de período
    es_inicio_mes = (dia <= 5),
    es_fin_mes = (dia >= 25),
    es_quincena = (dia IN (1, 15, 16))
WHERE fecha >= '2020-01-01';

-- Índices para consultas por eventos
CREATE INDEX IF NOT EXISTS idx_tiempo_temporada ON bi.dim_tiempo (temporada);
CREATE INDEX IF NOT EXISTS idx_tiempo_cyber ON bi.dim_tiempo (es_cyber) WHERE es_cyber = TRUE;
CREATE INDEX IF NOT EXISTS idx_tiempo_feriado ON bi.dim_tiempo (es_feriado) WHERE es_feriado = TRUE;


-- ============================================================================
-- PARTE 3: DIMENSIÓN PRODUCTOS ENRIQUECIDA
-- ============================================================================
-- Agregamos métricas calculadas y clasificación ABC para análisis avanzado
-- ============================================================================

ALTER TABLE bi.dim_productos
    ADD COLUMN IF NOT EXISTS clasificacion_abc CHAR(1),
    ADD COLUMN IF NOT EXISTS margen_pct NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS dias_inventario_promedio INTEGER,
    ADD COLUMN IF NOT EXISTS velocidad_rotacion VARCHAR(20),
    ADD COLUMN IF NOT EXISTS es_estacional BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS temporada_alta VARCHAR(50),
    ADD COLUMN IF NOT EXISTS lead_time_dias INTEGER DEFAULT 15,
    ADD COLUMN IF NOT EXISTS punto_reorden INTEGER,
    ADD COLUMN IF NOT EXISTS stock_seguridad INTEGER,
    ADD COLUMN IF NOT EXISTS proveedor_principal VARCHAR(100),
    ADD COLUMN IF NOT EXISTS embedding vector(1536); -- Para RAG con OpenAI embeddings

-- Índice para búsqueda vectorial (RAG)
CREATE INDEX IF NOT EXISTS idx_productos_embedding 
    ON bi.dim_productos USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);


-- ============================================================================
-- PARTE 4: TABLA DE FORECASTING (Predicciones Prophet)
-- ============================================================================
-- Estructura para almacenar predicciones generadas por Prophet
-- ============================================================================

DROP TABLE IF EXISTS bi.forecast_ventas CASCADE;
CREATE TABLE bi.forecast_ventas (
    forecast_id BIGSERIAL PRIMARY KEY,
    
    -- Dimensiones
    fecha DATE NOT NULL,
    tienda bi.tienda_tipo,
    producto_id INTEGER REFERENCES bi.dim_productos(producto_id),
    bodega_id INTEGER REFERENCES bi.dim_bodegas(bodega_id),
    categoria_id INTEGER REFERENCES bi.dim_categorias(categoria_id),
    
    -- Nivel de agregación
    nivel_agregacion VARCHAR(20) NOT NULL CHECK (nivel_agregacion IN ('TIENDA', 'CATEGORIA', 'PRODUCTO', 'SKU', 'BODEGA')),
    
    -- Predicciones
    venta_predicha NUMERIC(14,2) NOT NULL,
    unidades_predichas INTEGER,
    limite_inferior NUMERIC(14,2),  -- Intervalo de confianza 95%
    limite_superior NUMERIC(14,2),
    
    -- Componentes del modelo (para explicabilidad)
    tendencia NUMERIC(14,2),
    estacionalidad_semanal NUMERIC(14,2),
    estacionalidad_anual NUMERIC(14,2),
    efecto_feriados NUMERIC(14,2),
    
    -- Métricas del modelo
    modelo_version VARCHAR(50) DEFAULT 'prophet_v1',
    mape NUMERIC(5,2),  -- Mean Absolute Percentage Error
    rmse NUMERIC(14,2), -- Root Mean Square Error
    
    -- Metadata
    generado_en TIMESTAMPTZ DEFAULT NOW(),
    parametros_modelo JSONB,
    
    -- Constraint único
    CONSTRAINT uq_forecast_key UNIQUE (fecha, tienda, producto_id, bodega_id, nivel_agregacion)
);

-- Índices para consultas de forecast
CREATE INDEX IF NOT EXISTS idx_forecast_fecha ON bi.forecast_ventas (fecha);
CREATE INDEX IF NOT EXISTS idx_forecast_tienda_fecha ON bi.forecast_ventas (tienda, fecha);
CREATE INDEX IF NOT EXISTS idx_forecast_producto ON bi.forecast_ventas (producto_id, fecha);
CREATE INDEX IF NOT EXISTS idx_forecast_nivel ON bi.forecast_ventas (nivel_agregacion, fecha);


-- ============================================================================
-- PARTE 5: TABLA DE ALERTAS PREDICTIVAS (Quiebres Inminentes)
-- ============================================================================
-- Alertas inteligentes basadas en: Stock Actual vs Forecast vs Lead Time
-- ============================================================================

DROP TABLE IF EXISTS bi.alertas_predictivas CASCADE;
CREATE TABLE bi.alertas_predictivas (
    alerta_id BIGSERIAL PRIMARY KEY,
    
    -- Contexto
    producto_id INTEGER NOT NULL REFERENCES bi.dim_productos(producto_id),
    bodega_id INTEGER REFERENCES bi.dim_bodegas(bodega_id),
    tienda bi.tienda_tipo NOT NULL,
    
    -- Tipo de alerta
    tipo_alerta VARCHAR(50) NOT NULL CHECK (tipo_alerta IN (
        'QUIEBRE_INMINENTE',      -- Se agota antes de que llegue reposición
        'STOCK_EXCESIVO',         -- Más de 90 días de inventario
        'DEMANDA_ANOMALA',        -- Venta muy diferente al forecast
        'OPORTUNIDAD_PROMOCION',  -- Stock alto + demanda baja
        'REORDEN_URGENTE',        -- Pedir ahora para evitar quiebre
        'TENDENCIA_NEGATIVA',     -- Ventas cayendo vs forecast
        'TENDENCIA_POSITIVA'      -- Ventas subiendo vs forecast
    )),
    
    -- Datos del análisis
    stock_actual INTEGER NOT NULL,
    venta_diaria_promedio NUMERIC(10,2),
    venta_diaria_forecast NUMERIC(10,2),
    dias_hasta_quiebre INTEGER,
    lead_time_proveedor INTEGER,
    
    -- Cálculo de urgencia
    dias_para_pedir INTEGER GENERATED ALWAYS AS (
        GREATEST(0, dias_hasta_quiebre - lead_time_proveedor)
    ) STORED,
    
    -- Recomendación
    cantidad_sugerida_pedido INTEGER,
    accion_recomendada TEXT,
    impacto_estimado NUMERIC(14,2), -- Venta perdida si no se actúa
    
    -- Estado
    prioridad VARCHAR(10) NOT NULL CHECK (prioridad IN ('CRITICA', 'ALTA', 'MEDIA', 'BAJA')),
    estado VARCHAR(20) DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA', 'VISTA', 'EN_PROCESO', 'RESUELTA', 'IGNORADA')),
    
    -- Metadata
    fecha_deteccion TIMESTAMPTZ DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ DEFAULT NOW(),
    fecha_resolucion TIMESTAMPTZ,
    resuelto_por UUID,
    notas TEXT
);

-- Índices para alertas
CREATE INDEX IF NOT EXISTS idx_alertas_pred_estado ON bi.alertas_predictivas (estado, prioridad DESC);
CREATE INDEX IF NOT EXISTS idx_alertas_pred_producto ON bi.alertas_predictivas (producto_id);
CREATE INDEX IF NOT EXISTS idx_alertas_pred_urgencia ON bi.alertas_predictivas (dias_para_pedir) WHERE estado = 'ACTIVA';


-- ============================================================================
-- PARTE 6: FUNCIÓN DE DETECCIÓN DE QUIEBRES INMINENTES
-- ============================================================================
-- Cruza Stock Actual con Forecast y Lead Time del proveedor
-- Fórmula: Si Stock / Venta_Diaria_Forecast < Lead_Time → Pedir YA
-- ============================================================================

CREATE OR REPLACE FUNCTION bi.detectar_quiebres_inminentes()
RETURNS INTEGER AS $$
DECLARE
    v_alertas_generadas INTEGER := 0;
    v_record RECORD;
BEGIN
    -- Limpiar alertas antiguas resueltas
    DELETE FROM bi.alertas_predictivas 
    WHERE estado = 'RESUELTA' AND fecha_resolucion < NOW() - INTERVAL '30 days';
    
    -- Detectar productos en riesgo
    FOR v_record IN 
        WITH stock_actual AS (
            -- Stock actual por producto y bodega
            SELECT 
                fs.producto_id,
                fs.bodega_id,
                p.tienda,
                p.nombre AS producto_nombre,
                p.lead_time_dias,
                p.punto_reorden,
                SUM(fs.cantidad) AS stock,
                SUM(fs.cantidad_disponible) AS stock_disponible
            FROM bi.fact_stock fs
            JOIN bi.dim_productos p ON fs.producto_id = p.producto_id
            WHERE fs.fecha = (SELECT MAX(fecha) FROM bi.fact_stock)
              AND p.es_activo = TRUE
            GROUP BY fs.producto_id, fs.bodega_id, p.tienda, p.nombre, p.lead_time_dias, p.punto_reorden
        ),
        ventas_historicas AS (
            -- Venta diaria promedio de los últimos 30 días
            SELECT 
                producto_id,
                bodega_id,
                AVG(cantidad) AS venta_diaria_real,
                STDDEV(cantidad) AS desviacion_venta
            FROM bi.fact_ventas
            WHERE fecha >= CURRENT_DATE - 30
            GROUP BY producto_id, bodega_id
        ),
        forecast_futuro AS (
            -- Forecast de los próximos 30 días
            SELECT 
                producto_id,
                bodega_id,
                AVG(venta_predicha) / 30 AS venta_diaria_forecast
            FROM bi.forecast_ventas
            WHERE fecha BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
              AND nivel_agregacion = 'PRODUCTO'
            GROUP BY producto_id, bodega_id
        )
        SELECT 
            sa.producto_id,
            sa.bodega_id,
            sa.tienda,
            sa.producto_nombre,
            sa.stock,
            sa.stock_disponible,
            COALESCE(sa.lead_time_dias, 15) AS lead_time,
            COALESCE(vh.venta_diaria_real, 0) AS venta_diaria_real,
            COALESCE(ff.venta_diaria_forecast, vh.venta_diaria_real, 0.1) AS venta_diaria_forecast,
            
            -- Días hasta quiebre
            CASE 
                WHEN COALESCE(ff.venta_diaria_forecast, vh.venta_diaria_real, 0.1) > 0 
                THEN FLOOR(sa.stock_disponible / GREATEST(ff.venta_diaria_forecast, vh.venta_diaria_real, 0.1))::INTEGER
                ELSE 999
            END AS dias_hasta_quiebre,
            
            -- Tipo de alerta
            CASE 
                WHEN sa.stock_disponible = 0 THEN 'QUIEBRE_INMINENTE'
                WHEN sa.stock_disponible / GREATEST(COALESCE(ff.venta_diaria_forecast, vh.venta_diaria_real, 0.1), 0.1) < COALESCE(sa.lead_time_dias, 15) THEN 'REORDEN_URGENTE'
                WHEN sa.stock_disponible / GREATEST(COALESCE(ff.venta_diaria_forecast, vh.venta_diaria_real, 0.1), 0.1) < COALESCE(sa.lead_time_dias, 15) * 1.5 THEN 'QUIEBRE_INMINENTE'
                WHEN sa.stock_disponible / GREATEST(COALESCE(vh.venta_diaria_real, 0.1), 0.1) > 90 THEN 'STOCK_EXCESIVO'
                ELSE NULL
            END AS tipo_alerta,
            
            -- Prioridad
            CASE 
                WHEN sa.stock_disponible = 0 THEN 'CRITICA'
                WHEN sa.stock_disponible / GREATEST(COALESCE(ff.venta_diaria_forecast, 0.1), 0.1) < 7 THEN 'CRITICA'
                WHEN sa.stock_disponible / GREATEST(COALESCE(ff.venta_diaria_forecast, 0.1), 0.1) < 14 THEN 'ALTA'
                WHEN sa.stock_disponible / GREATEST(COALESCE(ff.venta_diaria_forecast, 0.1), 0.1) < 21 THEN 'MEDIA'
                ELSE 'BAJA'
            END AS prioridad,
            
            -- Cantidad sugerida (cobertura de 45 días + stock seguridad)
            GREATEST(0, 
                CEIL(COALESCE(ff.venta_diaria_forecast, vh.venta_diaria_real, 1) * 45 - sa.stock_disponible)
            )::INTEGER AS cantidad_sugerida
            
        FROM stock_actual sa
        LEFT JOIN ventas_historicas vh ON sa.producto_id = vh.producto_id AND sa.bodega_id = vh.bodega_id
        LEFT JOIN forecast_futuro ff ON sa.producto_id = ff.producto_id AND sa.bodega_id = ff.bodega_id
        WHERE sa.stock_disponible IS NOT NULL
    LOOP
        -- Solo insertar si hay una alerta válida
        IF v_record.tipo_alerta IS NOT NULL THEN
            INSERT INTO bi.alertas_predictivas (
                producto_id, bodega_id, tienda, tipo_alerta,
                stock_actual, venta_diaria_promedio, venta_diaria_forecast,
                dias_hasta_quiebre, lead_time_proveedor,
                cantidad_sugerida_pedido, prioridad,
                accion_recomendada, impacto_estimado
            ) VALUES (
                v_record.producto_id,
                v_record.bodega_id,
                v_record.tienda,
                v_record.tipo_alerta,
                v_record.stock_disponible,
                v_record.venta_diaria_real,
                v_record.venta_diaria_forecast,
                v_record.dias_hasta_quiebre,
                v_record.lead_time,
                v_record.cantidad_sugerida,
                v_record.prioridad,
                CASE v_record.tipo_alerta
                    WHEN 'QUIEBRE_INMINENTE' THEN 'URGENTE: Producto se agotará en ' || v_record.dias_hasta_quiebre || ' días. Pedir ' || v_record.cantidad_sugerida || ' unidades YA.'
                    WHEN 'REORDEN_URGENTE' THEN 'Pedir ' || v_record.cantidad_sugerida || ' unidades hoy. Lead time: ' || v_record.lead_time || ' días.'
                    WHEN 'STOCK_EXCESIVO' THEN 'Considerar promoción o liquidación. Stock cubre ' || v_record.dias_hasta_quiebre || ' días de venta.'
                    ELSE 'Monitorear'
                END,
                v_record.venta_diaria_forecast * GREATEST(0, v_record.lead_time - v_record.dias_hasta_quiebre)
            )
            ON CONFLICT (producto_id, bodega_id, tipo_alerta) 
            WHERE estado = 'ACTIVA'
            DO UPDATE SET
                stock_actual = EXCLUDED.stock_actual,
                venta_diaria_forecast = EXCLUDED.venta_diaria_forecast,
                dias_hasta_quiebre = EXCLUDED.dias_hasta_quiebre,
                cantidad_sugerida_pedido = EXCLUDED.cantidad_sugerida_pedido,
                prioridad = EXCLUDED.prioridad,
                accion_recomendada = EXCLUDED.accion_recomendada,
                fecha_actualizacion = NOW();
            
            v_alertas_generadas := v_alertas_generadas + 1;
        END IF;
    END LOOP;
    
    RETURN v_alertas_generadas;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- PARTE 7: RAG - EMBEDDINGS Y BÚSQUEDA SEMÁNTICA
-- ============================================================================
-- Estructura para Retrieval-Augmented Generation
-- Permite al Agente BI buscar información relevante por significado
-- ============================================================================

-- Tabla de conocimiento del negocio (para RAG)
DROP TABLE IF EXISTS bi.knowledge_base CASCADE;
CREATE TABLE bi.knowledge_base (
    kb_id BIGSERIAL PRIMARY KEY,
    
    -- Tipo de conocimiento
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN (
        'PRODUCTO',           -- Descripción de producto
        'CATEGORIA',          -- Descripción de categoría
        'REGLA_NEGOCIO',      -- Reglas como "Curanipe solo vende Bluefishing"
        'METRICA',            -- Definición de KPIs
        'PROCEDIMIENTO',      -- Cómo hacer algo
        'FAQ',                -- Preguntas frecuentes
        'CONTEXTO_TEMPORAL',  -- Eventos como CyberDay, temporadas
        'ANOMALIA'            -- Explicaciones de anomalías detectadas
    )),
    
    -- Contenido
    titulo VARCHAR(255) NOT NULL,
    contenido TEXT NOT NULL,
    contenido_embedding vector(1536), -- OpenAI embeddings
    
    -- Metadata
    entidad_relacionada VARCHAR(100), -- ej: 'producto:123', 'bodega:CURANIPE'
    tags TEXT[],
    fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ DEFAULT NOW(),
    creado_por VARCHAR(100) DEFAULT 'SYSTEM',
    es_activo BOOLEAN DEFAULT TRUE
);

-- Índice para búsqueda semántica
CREATE INDEX IF NOT EXISTS idx_kb_embedding 
    ON bi.knowledge_base USING ivfflat (contenido_embedding vector_cosine_ops)
    WITH (lists = 50);

CREATE INDEX IF NOT EXISTS idx_kb_tipo ON bi.knowledge_base (tipo);
CREATE INDEX IF NOT EXISTS idx_kb_tags ON bi.knowledge_base USING GIN (tags);

-- Insertar conocimiento base del negocio
INSERT INTO bi.knowledge_base (tipo, titulo, contenido, entidad_relacionada, tags) VALUES
-- Reglas de negocio
('REGLA_NEGOCIO', 'Stock Curanipe', 
 'La bodega Tienda Curanipe es EXCLUSIVA para artículos de pesca (Bluefishing). Su stock NO se suma al inventario disponible para e-commerce. Solo vende de forma física en la tienda de Curanipe.',
 'bodega:CURANIPE', ARRAY['curanipe', 'bluefishing', 'stock', 'exclusivo', 'fisico']),

('REGLA_NEGOCIO', 'Stock Compartido Multi-marca',
 'Las bodegas Casa Matriz, Tienda Web y Mercado Libre comparten stock entre ambas marcas (Bluefishing y Epicbike). Si hay 10 unidades en Casa Matriz, están disponibles para venta de cualquiera de las dos marcas.',
 'bodega:COMPARTIDA', ARRAY['stock', 'compartido', 'epicbike', 'bluefishing', 'multimarca']),

('REGLA_NEGOCIO', 'Razón Social',
 'Mi Tienda Spa es la razón social que tributa. Opera dos marcas comerciales: Bluefishing.cl (artículos de pesca) y Epicbike.cl (artículos de ciclismo). Ambas marcas se gestionan desde el mismo ERP Bsale.',
 'empresa:MI_TIENDA_SPA', ARRAY['razon social', 'tributacion', 'mi tienda spa', 'bsale']),

-- Métricas
('METRICA', 'Ticket Promedio',
 'El ticket promedio se calcula como: Ventas Totales / Número de Transacciones. Indica el valor promedio de cada compra. Un ticket promedio alto indica ventas de mayor valor unitario.',
 'metrica:TICKET_PROMEDIO', ARRAY['ticket', 'promedio', 'kpi', 'ventas']),

('METRICA', 'Rotación de Inventario',
 'La rotación de inventario se calcula como: Costo de Ventas Anualizado / Valor del Inventario Promedio. Una rotación alta (>4) indica que el inventario se vende rápido. Una rotación baja (<2) indica stock estancado.',
 'metrica:ROTACION', ARRAY['rotacion', 'inventario', 'stock', 'kpi']),

('METRICA', 'Días de Cobertura',
 'Los días de cobertura indican cuántos días durará el stock actual basado en la venta promedio diaria. Fórmula: Stock Actual / Venta Diaria Promedio. Menos de 7 días es crítico, menos de 14 es alerta.',
 'metrica:DIAS_COBERTURA', ARRAY['cobertura', 'dias', 'stock', 'quiebre']),

-- Contexto temporal
('CONTEXTO_TEMPORAL', 'Temporada Alta Pesca',
 'La temporada alta de pesca en Chile es en verano (diciembre a marzo). Durante estos meses, las ventas de Bluefishing pueden aumentar 40-50%. Se recomienda aumentar stock de artículos de pesca antes de noviembre.',
 'temporada:PESCA_ALTA', ARRAY['temporada', 'pesca', 'bluefishing', 'verano', 'estacionalidad']),

('CONTEXTO_TEMPORAL', 'Temporada Alta Ciclismo',
 'La temporada alta de ciclismo es en primavera y verano (septiembre a marzo). Las ventas de Epicbike aumentan significativamente. El mes de diciembre es especialmente fuerte por regalos navideños.',
 'temporada:CICLISMO_ALTA', ARRAY['temporada', 'ciclismo', 'epicbike', 'primavera', 'verano']),

('CONTEXTO_TEMPORAL', 'CyberDay Chile',
 'El CyberDay en Chile típicamente ocurre en octubre. Es uno de los eventos de e-commerce más importantes. Se recomienda preparar promociones y asegurar stock al menos 3 semanas antes.',
 'evento:CYBERDAY', ARRAY['cyberday', 'promocion', 'ecommerce', 'octubre']);


-- ============================================================================
-- PARTE 8: FUNCIÓN DE BÚSQUEDA SEMÁNTICA (RAG)
-- ============================================================================
-- Busca conocimiento relevante usando similitud de vectores
-- ============================================================================

CREATE OR REPLACE FUNCTION bi.buscar_conocimiento(
    p_query_embedding vector(1536),
    p_tipos TEXT[] DEFAULT NULL,
    p_limite INTEGER DEFAULT 5,
    p_umbral_similitud FLOAT DEFAULT 0.7
)
RETURNS TABLE(
    kb_id BIGINT,
    tipo VARCHAR,
    titulo VARCHAR,
    contenido TEXT,
    similitud FLOAT,
    tags TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        kb.kb_id,
        kb.tipo,
        kb.titulo,
        kb.contenido,
        1 - (kb.contenido_embedding <=> p_query_embedding) AS similitud,
        kb.tags
    FROM bi.knowledge_base kb
    WHERE kb.es_activo = TRUE
      AND (p_tipos IS NULL OR kb.tipo = ANY(p_tipos))
      AND kb.contenido_embedding IS NOT NULL
      AND 1 - (kb.contenido_embedding <=> p_query_embedding) >= p_umbral_similitud
    ORDER BY kb.contenido_embedding <=> p_query_embedding
    LIMIT p_limite;
END;
$$ LANGUAGE plpgsql STABLE;


-- ============================================================================
-- PARTE 9: TEXT-TO-SQL - CATÁLOGO DE CONSULTAS
-- ============================================================================
-- Mapeo de intenciones en lenguaje natural a consultas SQL
-- ============================================================================

DROP TABLE IF EXISTS bi.text_to_sql_catalog CASCADE;
CREATE TABLE bi.text_to_sql_catalog (
    catalog_id SERIAL PRIMARY KEY,
    
    -- Patrón de intención
    intencion VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT NOT NULL,
    ejemplos_preguntas TEXT[] NOT NULL,
    
    -- SQL template
    sql_template TEXT NOT NULL,
    parametros_requeridos TEXT[], -- ej: ['tienda', 'fecha_inicio']
    parametros_opcionales TEXT[],
    
    -- Metadata
    categoria VARCHAR(50),
    complejidad VARCHAR(10) CHECK (complejidad IN ('SIMPLE', 'MEDIA', 'COMPLEJA')),
    es_activo BOOLEAN DEFAULT TRUE
);

-- Insertar catálogo de consultas comunes
INSERT INTO bi.text_to_sql_catalog (intencion, descripcion, ejemplos_preguntas, sql_template, parametros_requeridos, parametros_opcionales, categoria, complejidad) VALUES

-- Ventas
('ventas_periodo', 'Consultar ventas totales en un período',
 ARRAY['¿Cuánto vendimos este mes?', '¿Cuáles son las ventas de hoy?', 'Ventas de la semana', 'Total vendido en enero'],
 'SELECT SUM(total) as ventas_totales, COUNT(DISTINCT bsale_document_id) as transacciones, SUM(cantidad) as unidades
  FROM bi.fact_ventas 
  WHERE fecha BETWEEN $1 AND $2 
  AND ($3::text IS NULL OR tienda = $3::bi.tienda_tipo)',
 ARRAY['fecha_inicio', 'fecha_fin'], ARRAY['tienda'], 'VENTAS', 'SIMPLE'),

('ventas_por_tienda', 'Comparar ventas entre marcas',
 ARRAY['¿Cuánto vendió Epicbike vs Bluefishing?', 'Comparar ventas por marca', '¿Qué tienda vende más?'],
 'SELECT tienda, SUM(total) as ventas, COUNT(DISTINCT bsale_document_id) as transacciones, ROUND(AVG(total)::numeric, 0) as ticket_promedio
  FROM bi.fact_ventas 
  WHERE fecha BETWEEN $1 AND $2
  GROUP BY tienda
  ORDER BY ventas DESC',
 ARRAY['fecha_inicio', 'fecha_fin'], NULL, 'VENTAS', 'SIMPLE'),

('ticket_promedio', 'Calcular ticket promedio',
 ARRAY['¿Cuál es el ticket promedio?', 'Ticket promedio de Curanipe', 'Valor promedio de compra'],
 'SELECT ROUND(SUM(total)::numeric / NULLIF(COUNT(DISTINCT bsale_document_id), 0), 0) as ticket_promedio
  FROM bi.fact_ventas 
  WHERE fecha BETWEEN $1 AND $2
  AND ($3::integer IS NULL OR bodega_id = $3)',
 ARRAY['fecha_inicio', 'fecha_fin'], ARRAY['bodega_id'], 'VENTAS', 'SIMPLE'),

('top_productos', 'Productos más vendidos',
 ARRAY['¿Cuáles son los productos más vendidos?', 'Top 10 productos', 'Productos estrella'],
 'SELECT p.nombre, p.tienda, SUM(v.cantidad) as unidades, SUM(v.total) as venta_total
  FROM bi.fact_ventas v
  JOIN bi.dim_productos p ON v.producto_id = p.producto_id
  WHERE v.fecha BETWEEN $1 AND $2
  GROUP BY p.producto_id, p.nombre, p.tienda
  ORDER BY venta_total DESC
  LIMIT $3',
 ARRAY['fecha_inicio', 'fecha_fin', 'limite'], NULL, 'VENTAS', 'MEDIA'),

-- Stock
('stock_actual', 'Consultar stock actual',
 ARRAY['¿Cuánto stock tenemos?', 'Inventario actual', 'Stock total'],
 'SELECT p.tienda, SUM(fs.cantidad) as unidades, SUM(fs.cantidad * p.precio_venta) as valor_venta
  FROM bi.fact_stock fs
  JOIN bi.dim_productos p ON fs.producto_id = p.producto_id
  WHERE fs.fecha = (SELECT MAX(fecha) FROM bi.fact_stock)
  AND ($1::text IS NULL OR p.tienda = $1::bi.tienda_tipo)
  GROUP BY p.tienda',
 NULL, ARRAY['tienda'], 'INVENTARIO', 'SIMPLE'),

('productos_sin_stock', 'Productos agotados',
 ARRAY['¿Qué productos están agotados?', 'Productos sin stock', 'Quiebres de stock'],
 'SELECT p.sku, p.nombre, p.tienda, COALESCE(fs.cantidad, 0) as stock
  FROM bi.dim_productos p
  LEFT JOIN bi.fact_stock fs ON p.producto_id = fs.producto_id 
    AND fs.fecha = (SELECT MAX(fecha) FROM bi.fact_stock)
  WHERE p.es_activo = TRUE AND COALESCE(fs.cantidad, 0) = 0
  ORDER BY p.tienda, p.nombre',
 NULL, NULL, 'INVENTARIO', 'MEDIA'),

('dias_cobertura', 'Días de cobertura de stock',
 ARRAY['¿Para cuántos días alcanza el stock?', 'Días de inventario', 'Cobertura de stock'],
 'SELECT * FROM bi.v_rotacion_inventario WHERE dias_cobertura < 30 ORDER BY dias_cobertura',
 NULL, NULL, 'INVENTARIO', 'SIMPLE'),

-- Cobranza
('cartera_pendiente', 'Cartera por cobrar',
 ARRAY['¿Cuánto tenemos por cobrar?', 'Cartera pendiente', 'Cuentas por cobrar'],
 'SELECT tienda, estado, SUM(monto_original - monto_pagado) as pendiente, COUNT(*) as documentos
  FROM bi.fact_cobranza
  WHERE estado IN (''PENDIENTE'', ''PARCIAL'', ''VENCIDO'')
  AND ($1::text IS NULL OR tienda = $1::bi.tienda_tipo)
  GROUP BY tienda, estado
  ORDER BY tienda, pendiente DESC',
 NULL, ARRAY['tienda'], 'COBRANZA', 'SIMPLE'),

('clientes_morosos', 'Clientes con mora',
 ARRAY['¿Quiénes están en mora?', 'Clientes morosos', 'Deudas vencidas'],
 'SELECT * FROM bi.calcular_riesgo_mora() WHERE categoria_riesgo IN (''ALTO'', ''CRITICO'') ORDER BY score_riesgo DESC',
 NULL, NULL, 'COBRANZA', 'MEDIA'),

-- Predicciones
('forecast_ventas', 'Pronóstico de ventas',
 ARRAY['¿Cuánto vamos a vender?', 'Pronóstico del mes', 'Predicción de ventas'],
 'SELECT * FROM bi.generar_prediccion_ventas($1, $2)',
 ARRAY['tienda', 'periodo_dias'], NULL, 'PREDICCION', 'SIMPLE'),

-- Alertas
('alertas_activas', 'Alertas del sistema',
 ARRAY['¿Hay alertas?', '¿Qué problemas hay?', 'Alertas críticas'],
 'SELECT * FROM bi.mcp_get_alertas($1, $2)',
 NULL, ARRAY['prioridad', 'limite'], 'ALERTAS', 'SIMPLE');

-- Índice para búsqueda por ejemplos
CREATE INDEX IF NOT EXISTS idx_t2s_ejemplos ON bi.text_to_sql_catalog USING GIN (ejemplos_preguntas);


-- ============================================================================
-- PARTE 10: FUNCIÓN TEXT-TO-SQL
-- ============================================================================
-- Traduce preguntas en lenguaje natural a consultas SQL
-- ============================================================================

CREATE OR REPLACE FUNCTION bi.text_to_sql(
    p_pregunta TEXT,
    p_contexto JSONB DEFAULT '{}'::JSONB
)
RETURNS TABLE(
    intencion VARCHAR,
    sql_generado TEXT,
    parametros JSONB,
    confianza FLOAT
) AS $$
DECLARE
    v_pregunta_lower TEXT;
    v_mejor_match RECORD;
    v_sql TEXT;
    v_params JSONB;
BEGIN
    v_pregunta_lower := LOWER(p_pregunta);
    
    -- Buscar la mejor coincidencia en el catálogo
    SELECT 
        c.intencion,
        c.sql_template,
        c.parametros_requeridos,
        -- Calcular similitud simple basada en keywords
        (
            SELECT COUNT(*) 
            FROM unnest(c.ejemplos_preguntas) AS ej 
            WHERE v_pregunta_lower % LOWER(ej)
        )::FLOAT / GREATEST(array_length(c.ejemplos_preguntas, 1), 1) AS score
    INTO v_mejor_match
    FROM bi.text_to_sql_catalog c
    WHERE c.es_activo = TRUE
    ORDER BY (
        SELECT COUNT(*) 
        FROM unnest(c.ejemplos_preguntas) AS ej 
        WHERE v_pregunta_lower % LOWER(ej) OR v_pregunta_lower ILIKE '%' || LOWER(ej) || '%'
    ) DESC
    LIMIT 1;
    
    IF v_mejor_match IS NULL THEN
        RETURN QUERY SELECT 
            'NO_MATCH'::VARCHAR,
            'No se encontró una consulta que coincida con la pregunta.'::TEXT,
            '{}'::JSONB,
            0.0::FLOAT;
        RETURN;
    END IF;
    
    -- Extraer parámetros del contexto o usar defaults
    v_params := jsonb_build_object(
        'fecha_inicio', COALESCE(p_contexto->>'fecha_inicio', (CURRENT_DATE - 30)::TEXT),
        'fecha_fin', COALESCE(p_contexto->>'fecha_fin', CURRENT_DATE::TEXT),
        'tienda', p_contexto->>'tienda',
        'bodega_id', p_contexto->>'bodega_id',
        'limite', COALESCE(p_contexto->>'limite', '10')
    );
    
    -- Reemplazar placeholders en el SQL
    v_sql := v_mejor_match.sql_template;
    v_sql := REPLACE(v_sql, '$1', COALESCE(quote_literal(v_params->>'fecha_inicio'), 'NULL'));
    v_sql := REPLACE(v_sql, '$2', COALESCE(quote_literal(v_params->>'fecha_fin'), 'NULL'));
    v_sql := REPLACE(v_sql, '$3', COALESCE(quote_literal(v_params->>'tienda'), 'NULL'));
    
    RETURN QUERY SELECT 
        v_mejor_match.intencion,
        v_sql,
        v_params,
        GREATEST(0.5, v_mejor_match.score)::FLOAT;
END;
$$ LANGUAGE plpgsql STABLE;


-- ============================================================================
-- PARTE 11: VISTAS MATERIALIZADAS OPTIMIZADAS
-- ============================================================================
-- Vistas pre-calculadas para dashboard ultrarrápido
-- ============================================================================

-- Vista: Métricas diarias consolidadas (para sparklines)
DROP MATERIALIZED VIEW IF EXISTS bi.mv_metricas_diarias CASCADE;
CREATE MATERIALIZED VIEW bi.mv_metricas_diarias AS
SELECT 
    v.fecha,
    v.tienda,
    t.temporada,
    t.es_feriado,
    t.es_cyber,
    t.nombre_dia,
    COUNT(DISTINCT v.bsale_document_id) AS transacciones,
    SUM(v.cantidad) AS unidades,
    SUM(v.total) AS venta_total,
    ROUND(SUM(v.total)::NUMERIC / NULLIF(COUNT(DISTINCT v.bsale_document_id), 0), 0) AS ticket_promedio,
    COUNT(DISTINCT v.cliente_id) AS clientes_unicos,
    COUNT(DISTINCT v.producto_id) AS productos_vendidos
FROM bi.fact_ventas v
JOIN bi.dim_tiempo t ON v.fecha = t.fecha
WHERE v.fecha >= CURRENT_DATE - 365
GROUP BY v.fecha, v.tienda, t.temporada, t.es_feriado, t.es_cyber, t.nombre_dia
WITH DATA;

CREATE UNIQUE INDEX idx_mv_metricas_diarias_pk ON bi.mv_metricas_diarias (fecha, tienda);
CREATE INDEX idx_mv_metricas_diarias_fecha ON bi.mv_metricas_diarias (fecha DESC);

-- Vista: Comparativo YoY (Year over Year)
DROP MATERIALIZED VIEW IF EXISTS bi.mv_comparativo_yoy CASCADE;
CREATE MATERIALIZED VIEW bi.mv_comparativo_yoy AS
WITH ventas_mensual AS (
    SELECT 
        DATE_TRUNC('month', fecha)::DATE AS mes,
        tienda,
        SUM(total) AS venta_total,
        COUNT(DISTINCT bsale_document_id) AS transacciones
    FROM bi.fact_ventas
    WHERE fecha >= CURRENT_DATE - INTERVAL '2 years'
    GROUP BY DATE_TRUNC('month', fecha), tienda
)
SELECT 
    v1.mes,
    v1.tienda,
    v1.venta_total AS venta_actual,
    v2.venta_total AS venta_año_anterior,
    ROUND(((v1.venta_total - COALESCE(v2.venta_total, 0)) * 100.0 / NULLIF(v2.venta_total, 0))::NUMERIC, 1) AS variacion_yoy_pct,
    v1.transacciones AS transacciones_actual,
    v2.transacciones AS transacciones_año_anterior
FROM ventas_mensual v1
LEFT JOIN ventas_mensual v2 ON v1.tienda = v2.tienda 
    AND v2.mes = v1.mes - INTERVAL '1 year'
ORDER BY v1.tienda, v1.mes DESC
WITH DATA;

CREATE UNIQUE INDEX idx_mv_yoy_pk ON bi.mv_comparativo_yoy (mes, tienda);


-- ============================================================================
-- PARTE 12: FUNCIÓN DE REFRESH ACTUALIZADA
-- ============================================================================

CREATE OR REPLACE FUNCTION bi.refresh_all_materialized_views()
RETURNS void AS $$
BEGIN
    -- Vistas existentes
    REFRESH MATERIALIZED VIEW bi.mv_resumen_ejecutivo;
    REFRESH MATERIALIZED VIEW bi.mv_ventas_diarias;
    REFRESH MATERIALIZED VIEW bi.mv_aging_cartera;
    REFRESH MATERIALIZED VIEW bi.mv_top_productos;
    
    -- Vistas de stock/marca
    REFRESH MATERIALIZED VIEW CONCURRENTLY bi.mv_stock_disponible_marca;
    REFRESH MATERIALIZED VIEW CONCURRENTLY bi.mv_disponibilidad_web;
    
    -- Nuevas vistas
    REFRESH MATERIALIZED VIEW CONCURRENTLY bi.mv_metricas_diarias;
    REFRESH MATERIALIZED VIEW CONCURRENTLY bi.mv_comparativo_yoy;
    
    -- Detectar alertas predictivas
    PERFORM bi.detectar_quiebres_inminentes();
    
EXCEPTION WHEN OTHERS THEN
    -- Si falla concurrently, intentar sin él
    REFRESH MATERIALIZED VIEW bi.mv_stock_disponible_marca;
    REFRESH MATERIALIZED VIEW bi.mv_disponibilidad_web;
    REFRESH MATERIALIZED VIEW bi.mv_metricas_diarias;
    REFRESH MATERIALIZED VIEW bi.mv_comparativo_yoy;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- PARTE 13: GRANTS
-- ============================================================================

-- Tablas nuevas
GRANT SELECT ON bi.forecast_ventas TO authenticated, anon;
GRANT SELECT ON bi.alertas_predictivas TO authenticated, anon;
GRANT SELECT ON bi.knowledge_base TO authenticated, anon;
GRANT SELECT ON bi.text_to_sql_catalog TO authenticated, anon;

-- Vistas nuevas
GRANT SELECT ON bi.mv_metricas_diarias TO authenticated, anon;
GRANT SELECT ON bi.mv_comparativo_yoy TO authenticated, anon;

-- Funciones
GRANT EXECUTE ON FUNCTION bi.detectar_quiebres_inminentes() TO service_role;
GRANT EXECUTE ON FUNCTION bi.buscar_conocimiento(vector, TEXT[], INTEGER, FLOAT) TO authenticated;
GRANT EXECUTE ON FUNCTION bi.text_to_sql(TEXT, JSONB) TO authenticated;

-- Service role puede insertar forecasts
GRANT INSERT, UPDATE ON bi.forecast_ventas TO service_role;
GRANT INSERT, UPDATE ON bi.alertas_predictivas TO service_role;
GRANT INSERT, UPDATE ON bi.knowledge_base TO service_role;


-- ============================================================================
-- VERIFICACIÓN FINAL
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '════════════════════════════════════════════════════════════════';
    RAISE NOTICE '✅ MIGRACIÓN 017 COMPLETADA: Data Warehouse Inteligente';
    RAISE NOTICE '════════════════════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE '📊 DIMENSIÓN TIEMPO ENRIQUECIDA:';
    RAISE NOTICE '   • Eventos comerciales (CyberDay, Black Friday, Fiestas Patrias)';
    RAISE NOTICE '   • Temporadas por marca (pesca, ciclismo)';
    RAISE NOTICE '   • Indicadores de período (quincena, fin de mes)';
    RAISE NOTICE '';
    RAISE NOTICE '🔮 FORECASTING (Prophet-ready):';
    RAISE NOTICE '   • bi.forecast_ventas (predicciones por nivel)';
    RAISE NOTICE '   • Componentes: tendencia, estacionalidad, efecto feriados';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️ ALERTAS PREDICTIVAS:';
    RAISE NOTICE '   • bi.alertas_predictivas (quiebres inminentes)';
    RAISE NOTICE '   • bi.detectar_quiebres_inminentes() (Stock vs Forecast vs Lead Time)';
    RAISE NOTICE '';
    RAISE NOTICE '🤖 RAG (pgvector):';
    RAISE NOTICE '   • bi.knowledge_base (conocimiento del negocio)';
    RAISE NOTICE '   • bi.buscar_conocimiento() (búsqueda semántica)';
    RAISE NOTICE '   • Reglas de negocio pre-cargadas (Curanipe, temporadas)';
    RAISE NOTICE '';
    RAISE NOTICE '💬 TEXT-TO-SQL:';
    RAISE NOTICE '   • bi.text_to_sql_catalog (mapeo de intenciones)';
    RAISE NOTICE '   • bi.text_to_sql() (traduce preguntas a SQL)';
    RAISE NOTICE '';
    RAISE NOTICE '📈 VISTAS OPTIMIZADAS:';
    RAISE NOTICE '   • bi.mv_metricas_diarias (sparklines)';
    RAISE NOTICE '   • bi.mv_comparativo_yoy (Year over Year)';
    RAISE NOTICE '';
    RAISE NOTICE '════════════════════════════════════════════════════════════════';
END $$;


-- ============================================================================
-- FIN DE MIGRACIÓN 017
-- ============================================================================
