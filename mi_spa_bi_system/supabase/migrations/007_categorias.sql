-- ============================================================================
-- MI SPA BI SYSTEM - Carga de Categorías de Bsale
-- ============================================================================

-- Limpiar categorías existentes
TRUNCATE bi.dim_categorias RESTART IDENTITY CASCADE;

-- Insertar categorías de Bsale
-- EPICBIKE: IDs 32, 33, 34, 39, 40, 42, 43
-- BLUEFISHING: resto

INSERT INTO bi.dim_categorias (nivel1_codigo, nivel1_nombre, nivel2_codigo, nivel2_nombre, bsale_category_id, tienda) VALUES
('26', 'ACCESORIO', '26', 'ACCESORIO', 26, 'BLUEFISHING'),
('25', 'ACSESORIO', '25', 'ACSESORIO', 25, 'BLUEFISHING'),
('4', 'ANZUELO', '4', 'ANZUELO', 4, 'BLUEFISHING'),
('2', 'Aparato', '2', 'Aparato', 2, 'BLUEFISHING'),
('23', 'ARGOLLAS', '23', 'ARGOLLAS', 23, 'BLUEFISHING'),
('35', 'ARPONES', '35', 'ARPONES', 35, 'BLUEFISHING'),
('32', 'BICICLETAS', '32', 'BICICLETAS', 32, 'EPICBIKE'),
('27', 'BOLSOS', '27', 'BOLSOS', 27, 'BLUEFISHING'),
('31', 'CAJAS', '31', 'CAJAS', 31, 'BLUEFISHING'),
('11', 'CAÑAS', '11', 'CAÑAS', 11, 'BLUEFISHING'),
('28', 'CARNADA', '28', 'CARNADA', 28, 'BLUEFISHING'),
('3', 'CARRETE', '3', 'CARRETE', 3, 'BLUEFISHING'),
('42', 'CASCOS', '42', 'CASCOS', 42, 'EPICBIKE'),
('40', 'Electrolyte', '40', 'Electrolyte', 40, 'EPICBIKE'),
('39', 'Energy Gel', '39', 'Energy Gel', 39, 'EPICBIKE'),
('6', 'FLUORO CARBON', '6', 'FLUORO CARBON', 6, 'BLUEFISHING'),
('29', 'GAS PIMIENTA', '29', 'GAS PIMIENTA', 29, 'BLUEFISHING'),
('43', 'INDUMENTARIA', '43', 'INDUMENTARIA', 43, 'EPICBIKE'),
('18', 'JIGHEAD', '18', 'JIGHEAD', 18, 'BLUEFISHING'),
('9', 'JIGS', '9', 'JIGS', 9, 'BLUEFISHING'),
('17', 'JOCKEY', '17', 'JOCKEY', 17, 'BLUEFISHING'),
('15', 'LEADER', '15', 'LEADER', 15, 'BLUEFISHING'),
('41', 'LINEAS', '41', 'LINEAS', 41, 'BLUEFISHING'),
('30', 'Linternas', '30', 'Linternas', 30, 'BLUEFISHING'),
('10', 'METAL VIB', '10', 'METAL VIB', 10, 'BLUEFISHING'),
('12', 'MUNDO PESAS', '12', 'MUNDO PESAS', 12, 'BLUEFISHING'),
('16', 'NYLON', '16', 'NYLON', 16, 'BLUEFISHING'),
('5', 'OUTDOOR', '5', 'OUTDOOR', 5, 'BLUEFISHING'),
('14', 'PE-BRAIDED', '14', 'PE-BRAIDED', 14, 'BLUEFISHING'),
('13', 'PESAS', '13', 'PESAS', 13, 'BLUEFISHING'),
('37', 'RELOJES', '37', 'RELOJES', 37, 'BLUEFISHING'),
('34', 'REPUESTOS BIKE', '34', 'REPUESTOS BIKE', 34, 'EPICBIKE'),
('8', 'REPUESTOS CARRETES', '8', 'REPUESTOS CARRETES', 8, 'BLUEFISHING'),
('7', 'REPUESTOS VARIOS', '7', 'REPUESTOS VARIOS', 7, 'BLUEFISHING'),
('38', 'REPUESTOS APNEA', '38', 'REPUESTOS APNEA', 38, 'BLUEFISHING'),
('44', 'RODAMIENTOS', '44', 'RODAMIENTOS', 44, 'BLUEFISHING'),
('21', 'SEÑUELO', '21', 'SEÑUELO', 21, 'BLUEFISHING'),
('33', 'SERVICIO BIKE', '33', 'SERVICIO BIKE', 33, 'EPICBIKE'),
('1', 'Sin Tipo', '1', 'Sin Tipo', 1, 'BLUEFISHING'),
('24', 'SNAP', '24', 'SNAP', 24, 'BLUEFISHING'),
('22', 'TRIPLES', '22', 'TRIPLES', 22, 'BLUEFISHING'),
('20', 'VESTUARIO', '20', 'VESTUARIO', 20, 'BLUEFISHING'),
('19', 'VINILO', '19', 'VINILO', 19, 'BLUEFISHING'),
('45', 'WADER', '45', 'WADER', 45, 'BLUEFISHING'),
('36', 'WETSUIT', '36', 'WETSUIT', 36, 'BLUEFISHING');

-- Crear vista para análisis por categoría
CREATE OR REPLACE VIEW bi.v_productos_por_categoria AS
SELECT 
    c.categoria_id,
    c.nivel1_nombre as categoria,
    c.tienda,
    c.bsale_category_id,
    COUNT(DISTINCT p.producto_id) as total_productos,
    COUNT(DISTINCT CASE WHEN p.es_activo THEN p.producto_id END) as productos_activos
FROM bi.dim_categorias c
LEFT JOIN bi.dim_productos p ON p.categoria_id = c.categoria_id
GROUP BY c.categoria_id, c.nivel1_nombre, c.tienda, c.bsale_category_id
ORDER BY c.tienda, total_productos DESC;

-- Crear vista para ventas por categoría
CREATE OR REPLACE VIEW bi.v_ventas_por_categoria AS
SELECT 
    c.categoria_id,
    c.nivel1_nombre as categoria,
    c.tienda,
    COALESCE(SUM(v.total), 0) as venta_total,
    COALESCE(SUM(v.cantidad), 0) as unidades_vendidas,
    COUNT(DISTINCT v.bsale_document_id) as num_documentos,
    COUNT(DISTINCT v.producto_id) as productos_vendidos
FROM bi.dim_categorias c
LEFT JOIN bi.dim_productos p ON p.categoria_id = c.categoria_id
LEFT JOIN bi.fact_ventas v ON v.producto_id = p.producto_id
    AND v.fecha >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY c.categoria_id, c.nivel1_nombre, c.tienda
ORDER BY venta_total DESC;

-- Agregar campo bsale_category_id a dim_productos si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'bi' AND table_name = 'dim_productos' AND column_name = 'bsale_category_id') THEN
        ALTER TABLE bi.dim_productos ADD COLUMN bsale_category_id INTEGER;
    END IF;
END $$;

-- Actualizar categoria_id basándose en bsale_category_id
UPDATE bi.dim_productos p
SET categoria_id = c.categoria_id
FROM bi.dim_categorias c
WHERE p.bsale_category_id = c.bsale_category_id
AND p.categoria_id IS NULL;

-- Grants
GRANT SELECT ON bi.v_productos_por_categoria TO authenticated, anon;
GRANT SELECT ON bi.v_ventas_por_categoria TO authenticated, anon;

