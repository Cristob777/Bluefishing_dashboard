-- ============================================================================
-- MI SPA BI SYSTEM - Sistema de Logging para ETL
-- ============================================================================

-- Tabla de Jobs ETL
CREATE TABLE bi.etl_jobs (
    job_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo VARCHAR(50) NOT NULL,
    estado VARCHAR(20) DEFAULT 'RUNNING',
    fecha_inicio TIMESTAMPTZ DEFAULT NOW(),
    fecha_fin TIMESTAMPTZ,
    duracion_segundos NUMERIC(10,2),
    registros_procesados INTEGER DEFAULT 0,
    registros_insertados INTEGER DEFAULT 0,
    registros_actualizados INTEGER DEFAULT 0,
    registros_errores INTEGER DEFAULT 0,
    parametros JSONB,
    mensaje TEXT,
    error_detalle TEXT
);

CREATE INDEX idx_etl_jobs_fecha ON bi.etl_jobs(fecha_inicio DESC);

-- Tabla de Logs
CREATE TABLE bi.etl_logs (
    log_id BIGSERIAL PRIMARY KEY,
    job_id UUID REFERENCES bi.etl_jobs(job_id),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    nivel VARCHAR(10) NOT NULL,
    componente VARCHAR(50),
    mensaje TEXT NOT NULL,
    datos JSONB,
    error_code VARCHAR(50)
);

CREATE INDEX idx_etl_logs_job ON bi.etl_logs(job_id);

-- Tabla sync status
CREATE TABLE bi.etl_sync_status (
    sync_id SERIAL PRIMARY KEY,
    entidad VARCHAR(50) UNIQUE NOT NULL,
    ultima_sync TIMESTAMPTZ,
    registros_totales INTEGER DEFAULT 0,
    estado VARCHAR(20) DEFAULT 'IDLE'
);

INSERT INTO bi.etl_sync_status (entidad) VALUES
    ('productos'), ('stock'), ('ventas'), ('clientes'), ('cobranza');

-- Funciones de logging
CREATE OR REPLACE FUNCTION bi.etl_start_job(p_tipo VARCHAR, p_parametros JSONB DEFAULT NULL)
RETURNS UUID AS $$
DECLARE v_job_id UUID;
BEGIN
    INSERT INTO bi.etl_jobs (tipo, parametros) VALUES (p_tipo, p_parametros)
    RETURNING job_id INTO v_job_id;
    RETURN v_job_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION bi.etl_end_job(p_job_id UUID, p_estado VARCHAR, p_mensaje TEXT DEFAULT NULL, p_stats JSONB DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
    UPDATE bi.etl_jobs SET
        estado = p_estado,
        fecha_fin = NOW(),
        duracion_segundos = EXTRACT(EPOCH FROM (NOW() - fecha_inicio)),
        mensaje = p_mensaje,
        registros_procesados = COALESCE((p_stats->>'procesados')::INTEGER, registros_procesados),
        registros_insertados = COALESCE((p_stats->>'insertados')::INTEGER, registros_insertados),
        registros_errores = COALESCE((p_stats->>'errores')::INTEGER, registros_errores)
    WHERE job_id = p_job_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION bi.etl_log(p_job_id UUID, p_nivel VARCHAR, p_componente VARCHAR, p_mensaje TEXT, p_datos JSONB DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
    INSERT INTO bi.etl_logs (job_id, nivel, componente, mensaje, datos)
    VALUES (p_job_id, p_nivel, p_componente, p_mensaje, p_datos);
END;
$$ LANGUAGE plpgsql;

-- Vista de jobs recientes
CREATE OR REPLACE VIEW bi.v_etl_jobs_recientes AS
SELECT job_id, tipo, estado, fecha_inicio, fecha_fin, duracion_segundos,
    registros_procesados, registros_insertados, registros_errores, mensaje
FROM bi.etl_jobs ORDER BY fecha_inicio DESC LIMIT 50;

-- Vista de salud ETL
CREATE OR REPLACE VIEW bi.v_etl_health AS
SELECT
    (SELECT COUNT(*) FROM bi.etl_jobs WHERE fecha_inicio > NOW() - INTERVAL '24 hours') AS jobs_24h,
    (SELECT COUNT(*) FROM bi.etl_jobs WHERE fecha_inicio > NOW() - INTERVAL '24 hours' AND estado = 'SUCCESS') AS exitosos_24h,
    (SELECT COUNT(*) FROM bi.etl_jobs WHERE fecha_inicio > NOW() - INTERVAL '24 hours' AND estado = 'FAILED') AS fallidos_24h,
    (SELECT MAX(fecha_fin) FROM bi.etl_jobs WHERE tipo = 'PRODUCTOS' AND estado = 'SUCCESS') AS ultimo_sync_productos,
    (SELECT MAX(fecha_fin) FROM bi.etl_jobs WHERE tipo = 'VENTAS' AND estado = 'SUCCESS') AS ultimo_sync_ventas,
    (SELECT MAX(fecha_fin) FROM bi.etl_jobs WHERE tipo = 'STOCK' AND estado = 'SUCCESS') AS ultimo_sync_stock;

GRANT SELECT ON bi.v_etl_jobs_recientes TO authenticated;
GRANT SELECT ON bi.v_etl_health TO authenticated;
GRANT ALL ON bi.etl_jobs TO service_role;
GRANT ALL ON bi.etl_logs TO service_role;
GRANT ALL ON bi.etl_sync_status TO service_role;
