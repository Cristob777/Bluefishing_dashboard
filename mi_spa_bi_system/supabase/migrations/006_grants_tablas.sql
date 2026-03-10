-- ============================================================================
-- MI SPA BI SYSTEM - Grants para Tablas (service_role para ETL)
-- ============================================================================

-- Grants para dimensiones
GRANT ALL ON bi.dim_tiempo TO service_role;
GRANT ALL ON bi.dim_bodegas TO service_role;
GRANT ALL ON bi.dim_categorias TO service_role;
GRANT ALL ON bi.dim_productos TO service_role;
GRANT ALL ON bi.dim_clientes TO service_role;

-- Grants para facts
GRANT ALL ON bi.fact_stock TO service_role;
GRANT ALL ON bi.fact_ventas TO service_role;
GRANT ALL ON bi.fact_cobranza TO service_role;

-- Grants para secuencias (necesario para INSERT con SERIAL)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA bi TO service_role;

-- Grants de lectura para el dashboard (authenticated users)
GRANT SELECT ON bi.dim_tiempo TO authenticated, anon;
GRANT SELECT ON bi.dim_bodegas TO authenticated, anon;
GRANT SELECT ON bi.dim_categorias TO authenticated, anon;
GRANT SELECT ON bi.dim_productos TO authenticated, anon;
GRANT SELECT ON bi.dim_clientes TO authenticated, anon;
GRANT SELECT ON bi.fact_stock TO authenticated, anon;
GRANT SELECT ON bi.fact_ventas TO authenticated, anon;
GRANT SELECT ON bi.fact_cobranza TO authenticated, anon;

-- Grant USAGE del schema bi
GRANT USAGE ON SCHEMA bi TO service_role, authenticated, anon;

