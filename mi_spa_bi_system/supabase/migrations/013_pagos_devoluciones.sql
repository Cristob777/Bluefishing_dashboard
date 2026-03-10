-- ============================================================================
-- MI SPA BI SYSTEM - Pagos y Devoluciones
-- ============================================================================

-- 1. Tabla de Pagos recibidos
DROP TABLE IF EXISTS bi.fact_pagos CASCADE;
CREATE TABLE bi.fact_pagos (
    pago_id SERIAL PRIMARY KEY,
    bsale_payment_id INTEGER UNIQUE,
    bsale_document_id INTEGER,
    fecha DATE NOT NULL,
    tienda VARCHAR(20) NOT NULL,
    cliente_id INTEGER REFERENCES bi.dim_clientes(cliente_id),
    metodo_pago VARCHAR(50),
    monto NUMERIC(15,2) NOT NULL,
    referencia VARCHAR(100),
    estado VARCHAR(20) DEFAULT 'APLICADO',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_pagos_fecha ON bi.fact_pagos(fecha);
CREATE INDEX idx_pagos_tienda ON bi.fact_pagos(tienda);
CREATE INDEX idx_pagos_cliente ON bi.fact_pagos(cliente_id);

-- 2. Tabla de Devoluciones / Notas de Crédito
DROP TABLE IF EXISTS bi.fact_devoluciones CASCADE;
CREATE TABLE bi.fact_devoluciones (
    devolucion_id SERIAL PRIMARY KEY,
    bsale_return_id INTEGER,
    bsale_document_id INTEGER,
    fecha DATE NOT NULL,
    tienda VARCHAR(20) NOT NULL,
    cliente_id INTEGER REFERENCES bi.dim_clientes(cliente_id),
    producto_id INTEGER REFERENCES bi.dim_productos(producto_id),
    tipo VARCHAR(30) DEFAULT 'NOTA_CREDITO', -- NOTA_CREDITO, DEVOLUCION
    cantidad INTEGER DEFAULT 1,
    monto NUMERIC(15,2) NOT NULL,
    motivo VARCHAR(200),
    estado VARCHAR(20) DEFAULT 'PROCESADA',
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(bsale_return_id, producto_id)
);

CREATE INDEX idx_devoluciones_fecha ON bi.fact_devoluciones(fecha);
CREATE INDEX idx_devoluciones_tienda ON bi.fact_devoluciones(tienda);
CREATE INDEX idx_devoluciones_producto ON bi.fact_devoluciones(producto_id);

-- 3. Vista: Resumen de pagos por período
CREATE OR REPLACE VIEW bi.v_pagos_periodo AS
SELECT 
    DATE_TRUNC('month', fecha)::date as mes,
    TO_CHAR(fecha, 'TMMonth YYYY') as periodo,
    tienda,
    metodo_pago,
    COUNT(*) as num_pagos,
    SUM(monto) as total_pagado,
    AVG(monto)::numeric(15,2) as pago_promedio
FROM bi.fact_pagos
GROUP BY DATE_TRUNC('month', fecha), TO_CHAR(fecha, 'TMMonth YYYY'), tienda, metodo_pago
ORDER BY mes DESC;

-- 4. Vista: Resumen de devoluciones por período
CREATE OR REPLACE VIEW bi.v_devoluciones_periodo AS
SELECT 
    DATE_TRUNC('month', fecha)::date as mes,
    TO_CHAR(fecha, 'TMMonth YYYY') as periodo,
    tienda,
    tipo,
    COUNT(*) as num_devoluciones,
    SUM(cantidad) as unidades_devueltas,
    SUM(monto) as total_devuelto,
    AVG(monto)::numeric(15,2) as devolucion_promedio
FROM bi.fact_devoluciones
GROUP BY DATE_TRUNC('month', fecha), TO_CHAR(fecha, 'TMMonth YYYY'), tienda, tipo
ORDER BY mes DESC;

-- 5. Vista: Top productos devueltos
CREATE OR REPLACE VIEW bi.v_top_productos_devueltos AS
SELECT 
    p.producto_id,
    p.sku,
    p.nombre,
    p.tienda,
    COUNT(*) as num_devoluciones,
    SUM(d.cantidad) as unidades_devueltas,
    SUM(d.monto) as monto_devuelto,
    ROUND(SUM(d.monto) / NULLIF(SUM(v.total), 1) * 100, 2) as tasa_devolucion_pct
FROM bi.fact_devoluciones d
JOIN bi.dim_productos p ON d.producto_id = p.producto_id
LEFT JOIN (
    SELECT producto_id, SUM(total) as total
    FROM bi.fact_ventas
    WHERE fecha >= CURRENT_DATE - 90
    GROUP BY producto_id
) v ON p.producto_id = v.producto_id
WHERE d.fecha >= CURRENT_DATE - 90
GROUP BY p.producto_id, p.sku, p.nombre, p.tienda
ORDER BY monto_devuelto DESC;

-- 6. Vista: Flujo de caja (ventas - devoluciones + pagos)
CREATE OR REPLACE VIEW bi.v_flujo_caja AS
SELECT 
    fecha,
    tienda,
    SUM(ventas) as ventas,
    SUM(pagos) as pagos_recibidos,
    SUM(devoluciones) as devoluciones,
    SUM(ventas) - SUM(devoluciones) as venta_neta,
    SUM(pagos) - SUM(devoluciones) as flujo_neto
FROM (
    -- Ventas
    SELECT fecha, tienda::varchar as tienda, SUM(total) as ventas, 0::numeric as pagos, 0::numeric as devoluciones
    FROM bi.fact_ventas
    WHERE fecha >= CURRENT_DATE - 30
    GROUP BY fecha, tienda
    
    UNION ALL
    
    -- Pagos
    SELECT fecha, tienda::varchar as tienda, 0::numeric as ventas, SUM(monto) as pagos, 0::numeric as devoluciones
    FROM bi.fact_pagos
    WHERE fecha >= CURRENT_DATE - 30
    GROUP BY fecha, tienda
    
    UNION ALL
    
    -- Devoluciones
    SELECT fecha, tienda::varchar as tienda, 0::numeric as ventas, 0::numeric as pagos, SUM(monto) as devoluciones
    FROM bi.fact_devoluciones
    WHERE fecha >= CURRENT_DATE - 30
    GROUP BY fecha, tienda
) t
GROUP BY fecha, tienda
ORDER BY fecha DESC;

-- 7. Actualizar vista de resumen ejecutivo con pagos y devoluciones
DROP MATERIALIZED VIEW IF EXISTS bi.mv_resumen_ejecutivo CASCADE;
CREATE MATERIALIZED VIEW bi.mv_resumen_ejecutivo AS
SELECT 
    p.tienda,
    -- Stock
    COUNT(DISTINCT p.producto_id) FILTER (WHERE p.stock_actual > 0) as productos_con_stock,
    COALESCE(SUM(p.stock_actual) FILTER (WHERE p.stock_actual > 0), 0) as unidades_stock,
    COALESCE(SUM(p.stock_actual * COALESCE(p.precio_costo, 0)) FILTER (WHERE p.stock_actual > 0), 0) as valor_stock_costo,
    COALESCE(SUM(p.stock_actual * COALESCE(p.precio_venta, 0)) FILTER (WHERE p.stock_actual > 0), 0) as valor_stock_venta,
    -- Ventas mes actual
    COALESCE((
        SELECT SUM(v.total) 
        FROM bi.fact_ventas v 
        WHERE v.tienda = p.tienda 
        AND v.fecha >= DATE_TRUNC('month', CURRENT_DATE)
    ), 0) as ventas_mes,
    COALESCE((
        SELECT COUNT(DISTINCT v.bsale_document_id)
        FROM bi.fact_ventas v 
        WHERE v.tienda = p.tienda 
        AND v.fecha >= DATE_TRUNC('month', CURRENT_DATE)
    ), 0) as num_ventas_mes,
    -- Pagos del mes
    COALESCE((
        SELECT SUM(pg.monto) 
        FROM bi.fact_pagos pg 
        WHERE pg.tienda = p.tienda 
        AND pg.fecha >= DATE_TRUNC('month', CURRENT_DATE)
    ), 0) as pagos_mes,
    -- Devoluciones del mes
    COALESCE((
        SELECT SUM(d.monto) 
        FROM bi.fact_devoluciones d 
        WHERE d.tienda = p.tienda 
        AND d.fecha >= DATE_TRUNC('month', CURRENT_DATE)
    ), 0) as devoluciones_mes,
    -- Por cobrar
    COALESCE((
        SELECT SUM(c.saldo_pendiente) 
        FROM bi.fact_cobranza c 
        WHERE c.tienda = p.tienda 
        AND c.estado IN ('PENDIENTE', 'VENCIDA')
    ), 0) as por_cobrar
FROM bi.dim_productos p
GROUP BY p.tienda;

CREATE UNIQUE INDEX ON bi.mv_resumen_ejecutivo(tienda);

-- 8. Vista: KPIs de cobranza mejorada
CREATE OR REPLACE VIEW bi.v_kpi_cobranza AS
SELECT 
    tienda,
    SUM(CASE WHEN estado = 'PENDIENTE' THEN saldo_pendiente ELSE 0 END) as pendiente,
    SUM(CASE WHEN estado = 'VENCIDA' THEN saldo_pendiente ELSE 0 END) as vencida,
    SUM(CASE WHEN estado = 'PAGADA' THEN monto_original ELSE 0 END) as cobrada,
    COUNT(DISTINCT cliente_id) FILTER (WHERE estado = 'VENCIDA') as clientes_morosos,
    AVG(EXTRACT(DAY FROM CURRENT_DATE - fecha_vencimiento)) 
        FILTER (WHERE estado = 'VENCIDA') as dias_mora_promedio
FROM bi.fact_cobranza
GROUP BY tienda;

-- GRANTS
GRANT SELECT ON bi.fact_pagos TO authenticated, anon;
GRANT SELECT ON bi.fact_devoluciones TO authenticated, anon;
GRANT SELECT ON bi.v_pagos_periodo TO authenticated, anon;
GRANT SELECT ON bi.v_devoluciones_periodo TO authenticated, anon;
GRANT SELECT ON bi.v_top_productos_devueltos TO authenticated, anon;
GRANT SELECT ON bi.v_flujo_caja TO authenticated, anon;
GRANT SELECT ON bi.mv_resumen_ejecutivo TO authenticated, anon;
GRANT SELECT ON bi.v_kpi_cobranza TO authenticated, anon;

-- Refrescar vista
REFRESH MATERIALIZED VIEW bi.mv_resumen_ejecutivo;
