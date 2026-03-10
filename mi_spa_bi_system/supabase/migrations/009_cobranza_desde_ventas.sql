-- ============================================================================
-- MI SPA BI SYSTEM - Poblar Cobranza desde Ventas
-- Los documentos de Bsale no exponen balance directamente, 
-- calculamos desde fact_ventas
-- ============================================================================

-- Insertar fechas faltantes en dim_tiempo
INSERT INTO bi.dim_tiempo (fecha)
SELECT DISTINCT fecha FROM bi.fact_ventas
WHERE fecha NOT IN (SELECT fecha FROM bi.dim_tiempo)
ON CONFLICT (fecha) DO NOTHING;

-- Insertar cobranza desde ventas (asumiendo que son ventas al contado = pagadas)
INSERT INTO bi.fact_cobranza (
    documento_id,
    fecha_emision,
    fecha_vencimiento,
    cliente_id,
    tienda,
    tipo_documento,
    numero_documento,
    monto_original,
    monto_pagado,
    estado
)
SELECT 
    'BSALE-' || bsale_document_id::text as documento_id,
    MIN(fecha) as fecha_emision,
    MIN(fecha) as fecha_vencimiento,
    COALESCE(MIN(cliente_id), 1) as cliente_id,
    tienda,
    'BOLETA' as tipo_documento,
    bsale_document_id::text as numero_documento,
    SUM(total) as monto_original,
    SUM(total) as monto_pagado, -- Asumimos pagado
    'PAGADO' as estado
FROM bi.fact_ventas
WHERE bsale_document_id IS NOT NULL
GROUP BY bsale_document_id, tienda
ON CONFLICT (documento_id) DO UPDATE SET
    monto_original = EXCLUDED.monto_original,
    monto_pagado = EXCLUDED.monto_pagado,
    updated_at = NOW();

-- Mostrar resumen
SELECT 
    tienda,
    estado,
    COUNT(*) as documentos,
    SUM(monto_original) as total_original,
    SUM(monto_pagado) as total_pagado
FROM bi.fact_cobranza
GROUP BY tienda, estado
ORDER BY tienda, estado;

