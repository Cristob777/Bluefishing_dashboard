-- ============================================================================
-- MI SPA BI SYSTEM - Schema Completo del Data Warehouse
-- Versión: 2.0 
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS bi;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- TIPOS ENUMERADOS
CREATE TYPE bi.tienda_tipo AS ENUM ('EPICBIKE', 'BLUEFISHING');
CREATE TYPE bi.bodega_tipo AS ENUM ('CASA_MATRIZ', 'TIENDA_WEB', 'CURANIPE', 'MELI');
CREATE TYPE bi.estado_documento AS ENUM ('PENDIENTE', 'PARCIAL', 'PAGADO', 'VENCIDO', 'ANULADO');

-- DIMENSIÓN TIEMPO
CREATE TABLE bi.dim_tiempo (
    fecha DATE PRIMARY KEY,
    anio SMALLINT NOT NULL,
    trimestre SMALLINT NOT NULL,
    mes SMALLINT NOT NULL,
    semana SMALLINT NOT NULL,
    dia SMALLINT NOT NULL,
    dia_semana SMALLINT NOT NULL,
    nombre_dia VARCHAR(10) NOT NULL,
    nombre_mes VARCHAR(10) NOT NULL,
    es_fin_semana BOOLEAN NOT NULL
);

INSERT INTO bi.dim_tiempo (fecha, anio, trimestre, mes, semana, dia, dia_semana, nombre_dia, nombre_mes, es_fin_semana)
SELECT d::DATE, EXTRACT(YEAR FROM d)::SMALLINT, EXTRACT(QUARTER FROM d)::SMALLINT,
    EXTRACT(MONTH FROM d)::SMALLINT, EXTRACT(WEEK FROM d)::SMALLINT, EXTRACT(DAY FROM d)::SMALLINT,
    EXTRACT(ISODOW FROM d)::SMALLINT, TO_CHAR(d, 'TMDay'), TO_CHAR(d, 'TMMonth'),
    EXTRACT(ISODOW FROM d) IN (6, 7)
FROM generate_series('2020-01-01'::DATE, '2030-12-31'::DATE, '1 day'::INTERVAL) d
ON CONFLICT (fecha) DO NOTHING;

-- DIMENSIÓN BODEGAS
CREATE TABLE bi.dim_bodegas (
    bodega_id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    bsale_office_id INTEGER,
    tienda bi.tienda_tipo NOT NULL,
    es_activa BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO bi.dim_bodegas (codigo, nombre, tienda) VALUES
    ('CASA_MATRIZ', 'Casa Matriz Mayorista', 'BLUEFISHING'),
    ('TIENDA_WEB', 'Tienda y Web', 'BLUEFISHING'),
    ('CURANIPE', 'Tienda Curanipe', 'BLUEFISHING'),
    ('MELI', 'Mercado Libre', 'BLUEFISHING');

-- DIMENSIÓN CATEGORÍAS
CREATE TABLE bi.dim_categorias (
    categoria_id SERIAL PRIMARY KEY,
    nivel1_codigo VARCHAR(20) NOT NULL,
    nivel1_nombre VARCHAR(100) NOT NULL,
    nivel2_codigo VARCHAR(20) NOT NULL,
    nivel2_nombre VARCHAR(100) NOT NULL,
    nivel3_codigo VARCHAR(20),
    nivel3_nombre VARCHAR(100),
    bsale_category_id INTEGER,
    tienda bi.tienda_tipo NOT NULL,
    es_activa BOOLEAN DEFAULT TRUE
);

-- DIMENSIÓN PRODUCTOS
CREATE TABLE bi.dim_productos (
    producto_id SERIAL PRIMARY KEY,
    sku VARCHAR(50),
    bsale_product_id INTEGER,
    bsale_variant_id INTEGER UNIQUE,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    marca VARCHAR(100),
    tienda bi.tienda_tipo NOT NULL,
    categoria_id INTEGER REFERENCES bi.dim_categorias(categoria_id),
    precio_costo NUMERIC(12,2) DEFAULT 0,
    precio_venta NUMERIC(12,2) DEFAULT 0,
    es_activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_productos_tienda ON bi.dim_productos(tienda);
CREATE INDEX idx_productos_bsale_variant ON bi.dim_productos(bsale_variant_id);

-- DIMENSIÓN CLIENTES
CREATE TABLE bi.dim_clientes (
    cliente_id SERIAL PRIMARY KEY,
    bsale_client_id INTEGER UNIQUE,
    rut VARCHAR(12),
    razon_social VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    telefono VARCHAR(50),
    ciudad VARCHAR(100),
    comuna VARCHAR(100),
    tienda_principal bi.tienda_tipo,
    tiene_credito BOOLEAN DEFAULT FALSE,
    cupo_credito NUMERIC(14,2) DEFAULT 0,
    tipo_cliente VARCHAR(50),
    es_activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cliente genérico (FALLA #4)
INSERT INTO bi.dim_clientes (bsale_client_id, rut, razon_social, tipo_cliente)
VALUES (0, '66666666-6', 'CLIENTE GENERICO / CONSUMIDOR FINAL', 'CONSUMIDOR_FINAL');

-- FACT STOCK
CREATE TABLE bi.fact_stock (
    stock_id BIGSERIAL PRIMARY KEY,
    fecha DATE NOT NULL REFERENCES bi.dim_tiempo(fecha),
    producto_id INTEGER NOT NULL REFERENCES bi.dim_productos(producto_id),
    bodega_id INTEGER NOT NULL REFERENCES bi.dim_bodegas(bodega_id),
    cantidad INTEGER NOT NULL DEFAULT 0,
    cantidad_disponible INTEGER NOT NULL DEFAULT 0,
    cantidad_reservada INTEGER DEFAULT 0,
    bsale_sync_at TIMESTAMPTZ,
    CONSTRAINT uq_stock_fecha_prod_bod UNIQUE (fecha, producto_id, bodega_id)
);

CREATE INDEX idx_stock_fecha ON bi.fact_stock(fecha DESC);

-- FACT VENTAS (FALLA #5: constraint único)
CREATE TABLE bi.fact_ventas (
    venta_id BIGSERIAL PRIMARY KEY,
    fecha DATE NOT NULL REFERENCES bi.dim_tiempo(fecha),
    producto_id INTEGER REFERENCES bi.dim_productos(producto_id),
    cliente_id INTEGER REFERENCES bi.dim_clientes(cliente_id),
    bodega_id INTEGER REFERENCES bi.dim_bodegas(bodega_id),
    bsale_document_id INTEGER NOT NULL,
    bsale_detail_id INTEGER,
    bsale_variant_id INTEGER,
    tienda bi.tienda_tipo NOT NULL,
    tipo_documento VARCHAR(50),
    numero_documento VARCHAR(50),
    cantidad INTEGER NOT NULL DEFAULT 1,
    precio_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
    descuento_monto NUMERIC(12,2) DEFAULT 0,
    subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
    impuesto NUMERIC(14,2) DEFAULT 0,
    total NUMERIC(14,2) NOT NULL DEFAULT 0,
    costo_unitario NUMERIC(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    bsale_created_at TIMESTAMPTZ,
    CONSTRAINT uq_ventas_doc_detail UNIQUE (bsale_document_id, bsale_detail_id)
);

CREATE INDEX idx_ventas_fecha ON bi.fact_ventas(fecha DESC);
CREATE INDEX idx_ventas_tienda ON bi.fact_ventas(tienda);
CREATE INDEX idx_ventas_bsale_variant ON bi.fact_ventas(bsale_variant_id);

-- FACT COBRANZA
CREATE TABLE bi.fact_cobranza (
    cobranza_id BIGSERIAL PRIMARY KEY,
    fecha_emision DATE NOT NULL REFERENCES bi.dim_tiempo(fecha),
    fecha_vencimiento DATE REFERENCES bi.dim_tiempo(fecha),
    cliente_id INTEGER NOT NULL REFERENCES bi.dim_clientes(cliente_id),
    documento_id VARCHAR(50) UNIQUE NOT NULL,
    tienda bi.tienda_tipo NOT NULL,
    tipo_documento VARCHAR(50) NOT NULL,
    numero_documento VARCHAR(50),
    monto_original NUMERIC(14,2) NOT NULL,
    monto_pagado NUMERIC(14,2) DEFAULT 0,
    estado bi.estado_documento DEFAULT 'PENDIENTE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- VISTAS MATERIALIZADAS
CREATE MATERIALIZED VIEW bi.mv_resumen_ejecutivo AS
SELECT 
    p.tienda,
    COUNT(DISTINCT CASE WHEN s.cantidad > 0 THEN s.producto_id END) AS productos_con_stock,
    COALESCE(SUM(s.cantidad), 0) AS unidades_stock,
    COALESCE(SUM(s.cantidad * p.precio_costo), 0) AS valor_stock_costo,
    COALESCE(SUM(s.cantidad * p.precio_venta), 0) AS valor_stock_venta,
    COALESCE((SELECT SUM(v.total) FROM bi.fact_ventas v WHERE v.tienda = p.tienda 
        AND v.fecha >= DATE_TRUNC('month', CURRENT_DATE)), 0) AS ventas_mes,
    COALESCE((SELECT SUM(c.monto_original - c.monto_pagado) FROM bi.fact_cobranza c
        WHERE c.tienda = p.tienda AND c.estado IN ('PENDIENTE', 'PARCIAL', 'VENCIDO')), 0) AS por_cobrar
FROM bi.dim_productos p
LEFT JOIN bi.fact_stock s ON p.producto_id = s.producto_id 
    AND s.fecha = (SELECT MAX(fecha) FROM bi.fact_stock)
WHERE p.es_activo = TRUE
GROUP BY p.tienda;

CREATE MATERIALIZED VIEW bi.mv_ventas_diarias AS
SELECT fecha, tienda, COUNT(DISTINCT bsale_document_id) AS num_documentos,
    SUM(cantidad) AS unidades, SUM(total) AS venta_total
FROM bi.fact_ventas
WHERE fecha >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY fecha, tienda;

CREATE MATERIALIZED VIEW bi.mv_aging_cartera AS
SELECT c.tienda, cl.cliente_id, cl.razon_social, cl.rut,
    SUM(CASE WHEN CURRENT_DATE <= c.fecha_vencimiento THEN c.monto_original - c.monto_pagado ELSE 0 END) AS vigente,
    SUM(CASE WHEN CURRENT_DATE - c.fecha_vencimiento BETWEEN 1 AND 30 THEN c.monto_original - c.monto_pagado ELSE 0 END) AS mora_1_30,
    SUM(CASE WHEN CURRENT_DATE - c.fecha_vencimiento BETWEEN 31 AND 60 THEN c.monto_original - c.monto_pagado ELSE 0 END) AS mora_31_60,
    SUM(CASE WHEN CURRENT_DATE - c.fecha_vencimiento BETWEEN 61 AND 90 THEN c.monto_original - c.monto_pagado ELSE 0 END) AS mora_61_90,
    SUM(CASE WHEN CURRENT_DATE - c.fecha_vencimiento > 90 THEN c.monto_original - c.monto_pagado ELSE 0 END) AS mora_90_plus,
    SUM(c.monto_original - c.monto_pagado) AS total_pendiente
FROM bi.fact_cobranza c
JOIN bi.dim_clientes cl ON c.cliente_id = cl.cliente_id
WHERE c.estado IN ('PENDIENTE', 'PARCIAL', 'VENCIDO')
GROUP BY c.tienda, cl.cliente_id, cl.razon_social, cl.rut;

CREATE MATERIALIZED VIEW bi.mv_top_productos AS
SELECT p.producto_id, p.sku, p.nombre, p.tienda, p.marca,
    SUM(v.cantidad) AS unidades_vendidas, SUM(v.total) AS venta_total
FROM bi.fact_ventas v
JOIN bi.dim_productos p ON v.producto_id = p.producto_id
WHERE v.fecha >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY p.producto_id, p.sku, p.nombre, p.tienda, p.marca;

-- FUNCIÓN REFRESH
CREATE OR REPLACE FUNCTION bi.refresh_all_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW bi.mv_resumen_ejecutivo;
    REFRESH MATERIALIZED VIEW bi.mv_ventas_diarias;
    REFRESH MATERIALIZED VIEW bi.mv_aging_cartera;
    REFRESH MATERIALIZED VIEW bi.mv_top_productos;
END;
$$ LANGUAGE plpgsql;

-- GRANTS
GRANT USAGE ON SCHEMA bi TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA bi TO anon, authenticated;
GRANT ALL ON SCHEMA bi TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA bi TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA bi TO service_role;
