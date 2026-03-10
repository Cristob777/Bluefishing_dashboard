-- ============================================================================
-- MI SPA BI SYSTEM - Grants para Vistas Materializadas
-- ============================================================================

-- Grants para vistas materializadas
GRANT SELECT ON bi.mv_resumen_ejecutivo TO anon, authenticated;
GRANT SELECT ON bi.mv_ventas_diarias TO anon, authenticated;
GRANT SELECT ON bi.mv_aging_cartera TO anon, authenticated;
GRANT SELECT ON bi.mv_top_productos TO anon, authenticated;

-- Grant para función refresh (solo service_role puede ejecutarla)
GRANT EXECUTE ON FUNCTION bi.refresh_all_materialized_views() TO service_role;

