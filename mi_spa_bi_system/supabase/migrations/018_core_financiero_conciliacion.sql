-- =============================================================================
-- MIGRACIÓN 018: CORE FINANCIERO - CONCILIACIÓN Y COBRANZA
-- =============================================================================
-- Sistema de gestión financiera con conciliación N:N
-- - Muchos pagos para una factura
-- - Un pago para muchas facturas
-- - Control de crédito y validaciones de integridad
-- =============================================================================

-- ============================================================================
-- PARTE 1: EXTENSIONES Y TIPOS
-- ============================================================================

-- Tipo ENUM para estado financiero de facturas
DO $$ BEGIN
    CREATE TYPE bi.estado_financiero AS ENUM (
        'PENDIENTE',    -- Sin pagos
        'PARCIAL',      -- Pagos parciales
        'PAGADA',       -- Completamente pagada
        'VENCIDA',      -- Pasó fecha de vencimiento sin pagar
        'ANULADA'       -- Anulada/Cancelada
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tipo ENUM para método de pago
DO $$ BEGIN
    CREATE TYPE bi.metodo_pago AS ENUM (
        'TRANSFERENCIA',
        'CHEQUE',
        'EFECTIVO',
        'TARJETA_CREDITO',
        'TARJETA_DEBITO',
        'DEPOSITO',
        'WEBPAY',
        'COMPENSACION',
        'OTRO'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tipo ENUM para estado de crédito
DO $$ BEGIN
    CREATE TYPE bi.estado_credito AS ENUM (
        'OK',           -- Todo en orden
        'MOROSO',       -- Tiene deuda vencida
        'SOBREGIRADO',  -- Excede límite de crédito
        'BLOQUEADO'     -- Bloqueo manual
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- PARTE 2: TABLAS PRINCIPALES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2.1 CLIENTS - Clientes con datos financieros extendidos
-- ----------------------------------------------------------------------------
-- Nota: Esta tabla extiende dim_clientes con información financiera

CREATE TABLE IF NOT EXISTS bi.fin_clientes (
    cliente_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Referencias externas
    dim_cliente_id INTEGER REFERENCES bi.dim_clientes(cliente_id),
    bsale_id INTEGER UNIQUE,
    rut VARCHAR(15) UNIQUE NOT NULL,
    
    -- Datos básicos
    razon_social VARCHAR(255) NOT NULL,
    nombre_fantasia VARCHAR(255),
    email VARCHAR(255),
    telefono VARCHAR(50),
    direccion TEXT,
    comuna VARCHAR(100),
    ciudad VARCHAR(100),
    
    -- Datos financieros
    credit_limit NUMERIC(14,2) DEFAULT 0,           -- Cupo máximo de deuda
    payment_terms_days INTEGER DEFAULT 0,            -- Días de plazo de pago
    allowed_payers TEXT[] DEFAULT '{}',              -- RUTs autorizados (Logic Holdings)
    is_credit_blocked BOOLEAN DEFAULT FALSE,         -- Bloqueo manual de crédito
    
    -- Auditoría
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(100) DEFAULT 'SYSTEM'
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_fin_clientes_rut ON bi.fin_clientes(rut);
CREATE INDEX IF NOT EXISTS idx_fin_clientes_bsale_id ON bi.fin_clientes(bsale_id);
CREATE INDEX IF NOT EXISTS idx_fin_clientes_dim_cliente ON bi.fin_clientes(dim_cliente_id);

-- Comentarios
COMMENT ON TABLE bi.fin_clientes IS 'Clientes con información financiera extendida para control de crédito';
COMMENT ON COLUMN bi.fin_clientes.credit_limit IS 'Límite de crédito máximo permitido';
COMMENT ON COLUMN bi.fin_clientes.payment_terms_days IS 'Días de plazo para pago (ej: 30, 60, 90)';
COMMENT ON COLUMN bi.fin_clientes.allowed_payers IS 'Array de RUTs autorizados para pagar por este cliente (Logic Holdings)';

-- ----------------------------------------------------------------------------
-- 2.2 INVOICES - Facturas (La Deuda)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bi.fin_facturas (
    factura_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Cliente
    cliente_id UUID NOT NULL REFERENCES bi.fin_clientes(cliente_id),
    
    -- Referencias Bsale
    bsale_id INTEGER UNIQUE,
    bsale_folio VARCHAR(50),
    bsale_url TEXT,                                  -- URL al PDF
    
    -- Documento
    tipo_documento VARCHAR(50) DEFAULT 'FACTURA',    -- FACTURA, BOLETA, NOTA_CREDITO, etc.
    numero_documento VARCHAR(50),
    
    -- Fechas
    issue_date DATE NOT NULL,                        -- Fecha de emisión
    due_date DATE NOT NULL,                          -- Fecha de vencimiento
    
    -- Montos
    subtotal NUMERIC(14,2) DEFAULT 0,
    iva NUMERIC(14,2) DEFAULT 0,
    total_amount NUMERIC(14,2) NOT NULL,             -- Monto original (INMUTABLE)
    outstanding_balance NUMERIC(14,2) NOT NULL,      -- Saldo pendiente (DINÁMICO)
    
    -- Estado
    financial_status bi.estado_financiero DEFAULT 'PENDIENTE',
    
    -- Metadata
    tienda bi.tienda_tipo,
    notas TEXT,
    
    -- Auditoría
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    synced_from_bsale_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT chk_outstanding_positive CHECK (outstanding_balance >= 0),
    CONSTRAINT chk_total_positive CHECK (total_amount > 0),
    CONSTRAINT chk_outstanding_le_total CHECK (outstanding_balance <= total_amount)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_fin_facturas_cliente ON bi.fin_facturas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_fin_facturas_status ON bi.fin_facturas(financial_status);
CREATE INDEX IF NOT EXISTS idx_fin_facturas_due_date ON bi.fin_facturas(due_date);
CREATE INDEX IF NOT EXISTS idx_fin_facturas_bsale_id ON bi.fin_facturas(bsale_id);
CREATE INDEX IF NOT EXISTS idx_fin_facturas_outstanding ON bi.fin_facturas(outstanding_balance) WHERE outstanding_balance > 0;

-- Comentarios
COMMENT ON TABLE bi.fin_facturas IS 'Facturas y documentos de venta - representa la deuda del cliente';
COMMENT ON COLUMN bi.fin_facturas.total_amount IS 'Monto original de la factura - NO debe modificarse';
COMMENT ON COLUMN bi.fin_facturas.outstanding_balance IS 'Saldo pendiente - se actualiza automáticamente con conciliaciones';

-- ----------------------------------------------------------------------------
-- 2.3 PAYMENTS - Pagos (El Haber / La Bolsa de Dinero)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bi.fin_pagos (
    pago_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Cliente que paga
    cliente_id UUID NOT NULL REFERENCES bi.fin_clientes(cliente_id),
    
    -- Pagador (puede ser diferente al cliente - Logic Holdings)
    pagador_rut VARCHAR(15),
    pagador_nombre VARCHAR(255),
    
    -- Monto
    amount_received NUMERIC(14,2) NOT NULL,          -- Monto total recibido
    unallocated_balance NUMERIC(14,2) NOT NULL,      -- Saldo disponible para asignar
    
    -- Detalles del pago
    payment_date DATE NOT NULL,
    payment_method bi.metodo_pago DEFAULT 'TRANSFERENCIA',
    reference_code VARCHAR(100),                      -- ID transacción bancaria
    banco VARCHAR(100),
    cuenta_destino VARCHAR(50),
    
    -- Metadata
    comprobante_url TEXT,
    notas TEXT,
    
    -- Auditoría
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(100) DEFAULT 'SYSTEM',
    
    -- Constraints
    CONSTRAINT chk_amount_positive CHECK (amount_received > 0),
    CONSTRAINT chk_unallocated_positive CHECK (unallocated_balance >= 0),
    CONSTRAINT chk_unallocated_le_received CHECK (unallocated_balance <= amount_received)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_fin_pagos_cliente ON bi.fin_pagos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_fin_pagos_fecha ON bi.fin_pagos(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_fin_pagos_unallocated ON bi.fin_pagos(unallocated_balance) WHERE unallocated_balance > 0;
CREATE INDEX IF NOT EXISTS idx_fin_pagos_reference ON bi.fin_pagos(reference_code);

-- Comentarios
COMMENT ON TABLE bi.fin_pagos IS 'Pagos recibidos - representa el dinero disponible para asignar a facturas';
COMMENT ON COLUMN bi.fin_pagos.unallocated_balance IS 'Saldo no asignado - se reduce con cada conciliación';

-- ----------------------------------------------------------------------------
-- 2.4 RECONCILIATIONS - Tabla Pivote Transaccional
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bi.fin_conciliaciones (
    conciliacion_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Referencias
    pago_id UUID NOT NULL REFERENCES bi.fin_pagos(pago_id),
    factura_id UUID NOT NULL REFERENCES bi.fin_facturas(factura_id),
    
    -- Monto aplicado
    amount_applied NUMERIC(14,2) NOT NULL,           -- Cuánto de ESTE pago se aplica a ESTA factura
    
    -- Auditoría
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(100) DEFAULT 'SYSTEM',
    notas TEXT,
    
    -- Constraints
    CONSTRAINT chk_amount_applied_positive CHECK (amount_applied > 0),
    CONSTRAINT uq_pago_factura UNIQUE (pago_id, factura_id)  -- Evita duplicados
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_fin_conciliaciones_pago ON bi.fin_conciliaciones(pago_id);
CREATE INDEX IF NOT EXISTS idx_fin_conciliaciones_factura ON bi.fin_conciliaciones(factura_id);
CREATE INDEX IF NOT EXISTS idx_fin_conciliaciones_fecha ON bi.fin_conciliaciones(created_at DESC);

-- Comentarios
COMMENT ON TABLE bi.fin_conciliaciones IS 'Relación N:N entre pagos y facturas - representa la asignación de fondos';
COMMENT ON COLUMN bi.fin_conciliaciones.amount_applied IS 'Monto de este pago aplicado a esta factura específica';

-- ============================================================================
-- PARTE 3: FUNCIONES Y TRIGGERS DE VALIDACIÓN
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 3.1 Función de validación BEFORE INSERT en conciliaciones
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION bi.fn_validar_conciliacion()
RETURNS TRIGGER AS $$
DECLARE
    v_pago_disponible NUMERIC(14,2);
    v_factura_pendiente NUMERIC(14,2);
    v_pago_cliente_id UUID;
    v_factura_cliente_id UUID;
BEGIN
    -- Obtener saldo disponible del pago
    SELECT unallocated_balance, cliente_id
    INTO v_pago_disponible, v_pago_cliente_id
    FROM bi.fin_pagos
    WHERE pago_id = NEW.pago_id;
    
    -- Verificar que el pago existe
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El pago con ID % no existe', NEW.pago_id;
    END IF;
    
    -- Obtener saldo pendiente de la factura
    SELECT outstanding_balance, cliente_id
    INTO v_factura_pendiente, v_factura_cliente_id
    FROM bi.fin_facturas
    WHERE factura_id = NEW.factura_id;
    
    -- Verificar que la factura existe
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La factura con ID % no existe', NEW.factura_id;
    END IF;
    
    -- VALIDACIÓN 1: El pago tiene fondos suficientes
    IF v_pago_disponible < NEW.amount_applied THEN
        RAISE EXCEPTION 'Fondos insuficientes en el pago. Disponible: $%, Intentando aplicar: $%', 
            v_pago_disponible, NEW.amount_applied;
    END IF;
    
    -- VALIDACIÓN 2: No se paga de más en la factura
    IF v_factura_pendiente < NEW.amount_applied THEN
        RAISE EXCEPTION 'El monto excede el saldo de la factura. Pendiente: $%, Intentando aplicar: $%', 
            v_factura_pendiente, NEW.amount_applied;
    END IF;
    
    -- VALIDACIÓN 3: Verificar que el pago y la factura pertenecen al mismo cliente
    -- (O que el pagador está en la lista de pagadores autorizados)
    IF v_pago_cliente_id != v_factura_cliente_id THEN
        -- Verificar si es un pagador autorizado (Logic Holdings)
        DECLARE
            v_pagador_rut VARCHAR(15);
            v_allowed_payers TEXT[];
        BEGIN
            SELECT pagador_rut INTO v_pagador_rut FROM bi.fin_pagos WHERE pago_id = NEW.pago_id;
            SELECT allowed_payers INTO v_allowed_payers FROM bi.fin_clientes WHERE cliente_id = v_factura_cliente_id;
            
            IF v_pagador_rut IS NULL OR NOT (v_pagador_rut = ANY(v_allowed_payers)) THEN
                RAISE EXCEPTION 'El pago no pertenece al cliente de la factura y el pagador no está autorizado';
            END IF;
        END;
    END IF;
    
    -- Todo OK, permitir la inserción
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger BEFORE INSERT
DROP TRIGGER IF EXISTS trg_validar_conciliacion ON bi.fin_conciliaciones;
CREATE TRIGGER trg_validar_conciliacion
    BEFORE INSERT ON bi.fin_conciliaciones
    FOR EACH ROW
    EXECUTE FUNCTION bi.fn_validar_conciliacion();

-- ----------------------------------------------------------------------------
-- 3.2 Función de actualización AFTER INSERT en conciliaciones
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION bi.fn_aplicar_conciliacion()
RETURNS TRIGGER AS $$
DECLARE
    v_nuevo_saldo_factura NUMERIC(14,2);
BEGIN
    -- 1. Descontar del saldo disponible del pago
    UPDATE bi.fin_pagos
    SET 
        unallocated_balance = unallocated_balance - NEW.amount_applied,
        updated_at = NOW()
    WHERE pago_id = NEW.pago_id;
    
    -- 2. Descontar del saldo pendiente de la factura
    UPDATE bi.fin_facturas
    SET 
        outstanding_balance = outstanding_balance - NEW.amount_applied,
        updated_at = NOW()
    WHERE factura_id = NEW.factura_id
    RETURNING outstanding_balance INTO v_nuevo_saldo_factura;
    
    -- 3. Actualizar estado de la factura según el nuevo saldo
    UPDATE bi.fin_facturas
    SET financial_status = CASE
        WHEN v_nuevo_saldo_factura = 0 THEN 'PAGADA'::bi.estado_financiero
        WHEN v_nuevo_saldo_factura < total_amount THEN 'PARCIAL'::bi.estado_financiero
        ELSE financial_status  -- Mantener estado actual si no cambió
    END
    WHERE factura_id = NEW.factura_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger AFTER INSERT
DROP TRIGGER IF EXISTS trg_aplicar_conciliacion ON bi.fin_conciliaciones;
CREATE TRIGGER trg_aplicar_conciliacion
    AFTER INSERT ON bi.fin_conciliaciones
    FOR EACH ROW
    EXECUTE FUNCTION bi.fn_aplicar_conciliacion();

-- ----------------------------------------------------------------------------
-- 3.3 Función para reversar conciliación (si se elimina)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION bi.fn_reversar_conciliacion()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. Devolver el monto al pago
    UPDATE bi.fin_pagos
    SET 
        unallocated_balance = unallocated_balance + OLD.amount_applied,
        updated_at = NOW()
    WHERE pago_id = OLD.pago_id;
    
    -- 2. Devolver el monto a la factura
    UPDATE bi.fin_facturas
    SET 
        outstanding_balance = outstanding_balance + OLD.amount_applied,
        financial_status = CASE
            WHEN outstanding_balance + OLD.amount_applied = total_amount THEN 'PENDIENTE'::bi.estado_financiero
            ELSE 'PARCIAL'::bi.estado_financiero
        END,
        updated_at = NOW()
    WHERE factura_id = OLD.factura_id;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger BEFORE DELETE
DROP TRIGGER IF EXISTS trg_reversar_conciliacion ON bi.fin_conciliaciones;
CREATE TRIGGER trg_reversar_conciliacion
    BEFORE DELETE ON bi.fin_conciliaciones
    FOR EACH ROW
    EXECUTE FUNCTION bi.fn_reversar_conciliacion();

-- ----------------------------------------------------------------------------
-- 3.4 Trigger para actualizar estado VENCIDA automáticamente
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION bi.fn_actualizar_facturas_vencidas()
RETURNS void AS $$
BEGIN
    UPDATE bi.fin_facturas
    SET 
        financial_status = 'VENCIDA'::bi.estado_financiero,
        updated_at = NOW()
    WHERE 
        financial_status IN ('PENDIENTE', 'PARCIAL')
        AND due_date < CURRENT_DATE
        AND outstanding_balance > 0;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PARTE 4: VISTAS DE NEGOCIO
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 4.1 Vista: Salud Crediticia del Cliente
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW bi.v_client_credit_health AS
SELECT
    c.cliente_id,
    c.rut,
    c.razon_social,
    c.credit_limit,
    c.payment_terms_days,
    c.is_credit_blocked,
    
    -- Cálculos de deuda
    COALESCE(deuda.total_debt, 0) AS total_debt,
    COALESCE(deuda.overdue_debt, 0) AS overdue_debt,
    COALESCE(deuda.facturas_pendientes, 0) AS facturas_pendientes,
    COALESCE(deuda.facturas_vencidas, 0) AS facturas_vencidas,
    
    -- Crédito disponible
    c.credit_limit - COALESCE(deuda.total_debt, 0) AS available_credit,
    
    -- Porcentaje de utilización
    CASE 
        WHEN c.credit_limit > 0 
        THEN ROUND((COALESCE(deuda.total_debt, 0) / c.credit_limit) * 100, 2)
        ELSE 0
    END AS credit_utilization_pct,
    
    -- Estado de crédito
    CASE
        WHEN c.is_credit_blocked THEN 'BLOQUEADO'::bi.estado_credito
        WHEN COALESCE(deuda.overdue_debt, 0) > 0 THEN 'MOROSO'::bi.estado_credito
        WHEN c.credit_limit > 0 AND COALESCE(deuda.total_debt, 0) > c.credit_limit THEN 'SOBREGIRADO'::bi.estado_credito
        ELSE 'OK'::bi.estado_credito
    END AS credit_status,
    
    -- Días promedio de mora
    COALESCE(deuda.dias_mora_promedio, 0) AS dias_mora_promedio,
    
    -- Último pago
    pagos.ultimo_pago_fecha,
    pagos.ultimo_pago_monto,
    
    -- Pagos no asignados
    COALESCE(pagos.saldo_no_asignado, 0) AS saldo_no_asignado

FROM bi.fin_clientes c

LEFT JOIN LATERAL (
    SELECT
        SUM(f.outstanding_balance) AS total_debt,
        SUM(CASE WHEN f.due_date < CURRENT_DATE AND f.outstanding_balance > 0 THEN f.outstanding_balance ELSE 0 END) AS overdue_debt,
        COUNT(*) FILTER (WHERE f.outstanding_balance > 0) AS facturas_pendientes,
        COUNT(*) FILTER (WHERE f.due_date < CURRENT_DATE AND f.outstanding_balance > 0) AS facturas_vencidas,
        AVG(CASE WHEN f.due_date < CURRENT_DATE AND f.outstanding_balance > 0 
            THEN CURRENT_DATE - f.due_date ELSE NULL END)::INTEGER AS dias_mora_promedio
    FROM bi.fin_facturas f
    WHERE f.cliente_id = c.cliente_id
) deuda ON TRUE

LEFT JOIN LATERAL (
    SELECT
        MAX(p.payment_date) AS ultimo_pago_fecha,
        (SELECT amount_received FROM bi.fin_pagos WHERE cliente_id = c.cliente_id ORDER BY payment_date DESC LIMIT 1) AS ultimo_pago_monto,
        SUM(p.unallocated_balance) AS saldo_no_asignado
    FROM bi.fin_pagos p
    WHERE p.cliente_id = c.cliente_id
) pagos ON TRUE;

COMMENT ON VIEW bi.v_client_credit_health IS 'Vista consolidada de salud crediticia por cliente';

-- ----------------------------------------------------------------------------
-- 4.2 Vista: Aging de Cartera (Antigüedad de Deuda)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW bi.v_aging_cartera AS
SELECT
    c.cliente_id,
    c.rut,
    c.razon_social,
    
    -- Por vencer
    SUM(CASE WHEN f.due_date >= CURRENT_DATE THEN f.outstanding_balance ELSE 0 END) AS por_vencer,
    
    -- Vencido 1-30 días
    SUM(CASE WHEN f.due_date < CURRENT_DATE AND f.due_date >= CURRENT_DATE - 30 
        THEN f.outstanding_balance ELSE 0 END) AS vencido_1_30,
    
    -- Vencido 31-60 días
    SUM(CASE WHEN f.due_date < CURRENT_DATE - 30 AND f.due_date >= CURRENT_DATE - 60 
        THEN f.outstanding_balance ELSE 0 END) AS vencido_31_60,
    
    -- Vencido 61-90 días
    SUM(CASE WHEN f.due_date < CURRENT_DATE - 60 AND f.due_date >= CURRENT_DATE - 90 
        THEN f.outstanding_balance ELSE 0 END) AS vencido_61_90,
    
    -- Vencido +90 días
    SUM(CASE WHEN f.due_date < CURRENT_DATE - 90 
        THEN f.outstanding_balance ELSE 0 END) AS vencido_90_plus,
    
    -- Total
    SUM(f.outstanding_balance) AS total_pendiente,
    
    -- Número de documentos
    COUNT(*) FILTER (WHERE f.outstanding_balance > 0) AS num_documentos

FROM bi.fin_clientes c
INNER JOIN bi.fin_facturas f ON f.cliente_id = c.cliente_id
WHERE f.outstanding_balance > 0
GROUP BY c.cliente_id, c.rut, c.razon_social
ORDER BY total_pendiente DESC;

COMMENT ON VIEW bi.v_aging_cartera IS 'Análisis de antigüedad de cartera por cliente';

-- ----------------------------------------------------------------------------
-- 4.3 Vista: Resumen de Conciliaciones por Factura
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW bi.v_factura_conciliaciones AS
SELECT
    f.factura_id,
    f.bsale_folio,
    f.numero_documento,
    c.rut AS cliente_rut,
    c.razon_social AS cliente_nombre,
    f.issue_date,
    f.due_date,
    f.total_amount,
    f.outstanding_balance,
    f.financial_status,
    f.tienda,
    
    -- Días desde emisión
    CURRENT_DATE - f.issue_date AS dias_desde_emision,
    
    -- Días de mora (si aplica)
    CASE WHEN f.due_date < CURRENT_DATE AND f.outstanding_balance > 0
        THEN CURRENT_DATE - f.due_date
        ELSE 0
    END AS dias_mora,
    
    -- Total pagado
    COALESCE(conc.total_pagado, 0) AS total_pagado,
    
    -- Número de pagos aplicados
    COALESCE(conc.num_pagos, 0) AS num_pagos_aplicados,
    
    -- Detalle de pagos
    conc.pagos_detalle

FROM bi.fin_facturas f
INNER JOIN bi.fin_clientes c ON c.cliente_id = f.cliente_id
LEFT JOIN LATERAL (
    SELECT
        SUM(rc.amount_applied) AS total_pagado,
        COUNT(*) AS num_pagos,
        JSONB_AGG(JSONB_BUILD_OBJECT(
            'pago_id', p.pago_id,
            'fecha', p.payment_date,
            'monto_aplicado', rc.amount_applied,
            'metodo', p.payment_method,
            'referencia', p.reference_code
        ) ORDER BY p.payment_date) AS pagos_detalle
    FROM bi.fin_conciliaciones rc
    INNER JOIN bi.fin_pagos p ON p.pago_id = rc.pago_id
    WHERE rc.factura_id = f.factura_id
) conc ON TRUE
ORDER BY f.due_date;

COMMENT ON VIEW bi.v_factura_conciliaciones IS 'Vista detallada de facturas con historial de pagos aplicados';

-- ----------------------------------------------------------------------------
-- 4.4 Vista: Pagos con detalle de asignación
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW bi.v_pago_asignaciones AS
SELECT
    p.pago_id,
    c.rut AS cliente_rut,
    c.razon_social AS cliente_nombre,
    p.pagador_rut,
    p.pagador_nombre,
    p.payment_date,
    p.payment_method,
    p.reference_code,
    p.banco,
    p.amount_received,
    p.unallocated_balance,
    
    -- Monto ya asignado
    p.amount_received - p.unallocated_balance AS monto_asignado,
    
    -- Porcentaje asignado
    ROUND(((p.amount_received - p.unallocated_balance) / p.amount_received) * 100, 2) AS pct_asignado,
    
    -- Número de facturas pagadas
    COALESCE(asig.num_facturas, 0) AS num_facturas_pagadas,
    
    -- Detalle de asignaciones
    asig.facturas_detalle

FROM bi.fin_pagos p
INNER JOIN bi.fin_clientes c ON c.cliente_id = p.cliente_id
LEFT JOIN LATERAL (
    SELECT
        COUNT(*) AS num_facturas,
        JSONB_AGG(JSONB_BUILD_OBJECT(
            'factura_id', f.factura_id,
            'folio', f.bsale_folio,
            'monto_factura', f.total_amount,
            'monto_aplicado', rc.amount_applied,
            'fecha_factura', f.issue_date
        ) ORDER BY f.issue_date) AS facturas_detalle
    FROM bi.fin_conciliaciones rc
    INNER JOIN bi.fin_facturas f ON f.factura_id = rc.factura_id
    WHERE rc.pago_id = p.pago_id
) asig ON TRUE
ORDER BY p.payment_date DESC;

COMMENT ON VIEW bi.v_pago_asignaciones IS 'Vista detallada de pagos con facturas asignadas';

-- ============================================================================
-- PARTE 5: FUNCIONES UTILITARIAS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 5.1 Función: Conciliar pago automáticamente (FIFO)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION bi.fn_conciliar_pago_fifo(
    p_pago_id UUID,
    p_cliente_id UUID DEFAULT NULL
)
RETURNS TABLE (
    factura_id UUID,
    folio VARCHAR,
    monto_aplicado NUMERIC,
    saldo_restante NUMERIC
) AS $$
DECLARE
    v_saldo_disponible NUMERIC(14,2);
    v_cliente_id UUID;
    r_factura RECORD;
    v_monto_a_aplicar NUMERIC(14,2);
BEGIN
    -- Obtener saldo disponible del pago
    SELECT unallocated_balance, cliente_id
    INTO v_saldo_disponible, v_cliente_id
    FROM bi.fin_pagos
    WHERE pago_id = p_pago_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pago no encontrado';
    END IF;
    
    -- Usar cliente_id del parámetro si se proporciona
    IF p_cliente_id IS NOT NULL THEN
        v_cliente_id := p_cliente_id;
    END IF;
    
    IF v_saldo_disponible <= 0 THEN
        RAISE NOTICE 'El pago no tiene saldo disponible para asignar';
        RETURN;
    END IF;
    
    -- Iterar por facturas pendientes del cliente (FIFO: más antiguas primero)
    FOR r_factura IN
        SELECT f.factura_id, f.bsale_folio, f.outstanding_balance
        FROM bi.fin_facturas f
        WHERE f.cliente_id = v_cliente_id
          AND f.outstanding_balance > 0
          AND f.financial_status NOT IN ('PAGADA', 'ANULADA')
        ORDER BY f.due_date ASC, f.issue_date ASC
    LOOP
        EXIT WHEN v_saldo_disponible <= 0;
        
        -- Calcular monto a aplicar (el menor entre disponible y pendiente)
        v_monto_a_aplicar := LEAST(v_saldo_disponible, r_factura.outstanding_balance);
        
        -- Insertar conciliación
        INSERT INTO bi.fin_conciliaciones (pago_id, factura_id, amount_applied, notas)
        VALUES (p_pago_id, r_factura.factura_id, v_monto_a_aplicar, 'Conciliación automática FIFO');
        
        -- Actualizar saldo disponible local
        v_saldo_disponible := v_saldo_disponible - v_monto_a_aplicar;
        
        -- Retornar resultado
        factura_id := r_factura.factura_id;
        folio := r_factura.bsale_folio;
        monto_aplicado := v_monto_a_aplicar;
        saldo_restante := v_saldo_disponible;
        RETURN NEXT;
    END LOOP;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION bi.fn_conciliar_pago_fifo IS 'Asigna automáticamente un pago a facturas pendientes usando método FIFO';

-- ----------------------------------------------------------------------------
-- 5.2 Función: Obtener resumen financiero del cliente
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION bi.fn_resumen_financiero_cliente(p_cliente_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_resultado JSONB;
BEGIN
    SELECT JSONB_BUILD_OBJECT(
        'cliente', JSONB_BUILD_OBJECT(
            'cliente_id', c.cliente_id,
            'rut', c.rut,
            'razon_social', c.razon_social,
            'credit_limit', c.credit_limit,
            'payment_terms_days', c.payment_terms_days,
            'is_blocked', c.is_credit_blocked
        ),
        'metricas', JSONB_BUILD_OBJECT(
            'total_deuda', COALESCE(SUM(f.outstanding_balance), 0),
            'deuda_vencida', COALESCE(SUM(CASE WHEN f.due_date < CURRENT_DATE THEN f.outstanding_balance ELSE 0 END), 0),
            'credito_disponible', c.credit_limit - COALESCE(SUM(f.outstanding_balance), 0),
            'facturas_pendientes', COUNT(*) FILTER (WHERE f.outstanding_balance > 0),
            'pagos_sin_asignar', (SELECT COALESCE(SUM(unallocated_balance), 0) FROM bi.fin_pagos WHERE cliente_id = c.cliente_id)
        ),
        'estado', CASE
            WHEN c.is_credit_blocked THEN 'BLOQUEADO'
            WHEN EXISTS (SELECT 1 FROM bi.fin_facturas WHERE cliente_id = c.cliente_id AND due_date < CURRENT_DATE AND outstanding_balance > 0) THEN 'MOROSO'
            WHEN c.credit_limit > 0 AND COALESCE(SUM(f.outstanding_balance), 0) > c.credit_limit THEN 'SOBREGIRADO'
            ELSE 'OK'
        END
    ) INTO v_resultado
    FROM bi.fin_clientes c
    LEFT JOIN bi.fin_facturas f ON f.cliente_id = c.cliente_id
    WHERE c.cliente_id = p_cliente_id
    GROUP BY c.cliente_id, c.rut, c.razon_social, c.credit_limit, c.payment_terms_days, c.is_credit_blocked;
    
    RETURN v_resultado;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION bi.fn_resumen_financiero_cliente IS 'Retorna resumen financiero completo de un cliente en formato JSON';

-- ----------------------------------------------------------------------------
-- 5.3 Función: Verificar si cliente puede comprar
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION bi.fn_puede_comprar(
    p_cliente_id UUID,
    p_monto_compra NUMERIC DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
    v_credit_status bi.estado_credito;
    v_available_credit NUMERIC(14,2);
    v_puede_comprar BOOLEAN;
    v_razon TEXT;
BEGIN
    -- Obtener estado crediticio
    SELECT 
        credit_status,
        available_credit
    INTO v_credit_status, v_available_credit
    FROM bi.v_client_credit_health
    WHERE cliente_id = p_cliente_id;
    
    IF NOT FOUND THEN
        RETURN JSONB_BUILD_OBJECT(
            'puede_comprar', FALSE,
            'razon', 'Cliente no encontrado'
        );
    END IF;
    
    -- Evaluar
    CASE v_credit_status
        WHEN 'BLOQUEADO' THEN
            v_puede_comprar := FALSE;
            v_razon := 'Cliente bloqueado manualmente';
        WHEN 'MOROSO' THEN
            v_puede_comprar := FALSE;
            v_razon := 'Cliente tiene deuda vencida';
        WHEN 'SOBREGIRADO' THEN
            v_puede_comprar := FALSE;
            v_razon := 'Cliente excede su límite de crédito';
        ELSE
            IF p_monto_compra > v_available_credit AND v_available_credit > 0 THEN
                v_puede_comprar := FALSE;
                v_razon := FORMAT('La compra de $%s excede el crédito disponible de $%s', 
                    p_monto_compra, v_available_credit);
            ELSE
                v_puede_comprar := TRUE;
                v_razon := 'OK';
            END IF;
    END CASE;
    
    RETURN JSONB_BUILD_OBJECT(
        'puede_comprar', v_puede_comprar,
        'estado_credito', v_credit_status,
        'credito_disponible', v_available_credit,
        'monto_solicitado', p_monto_compra,
        'razon', v_razon
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION bi.fn_puede_comprar IS 'Verifica si un cliente puede realizar una compra según su estado crediticio';

-- ============================================================================
-- PARTE 6: ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE bi.fin_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bi.fin_facturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE bi.fin_pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE bi.fin_conciliaciones ENABLE ROW LEVEL SECURITY;

-- Políticas básicas (acceso completo para authenticated users)
CREATE POLICY "fin_clientes_policy" ON bi.fin_clientes FOR ALL USING (true);
CREATE POLICY "fin_facturas_policy" ON bi.fin_facturas FOR ALL USING (true);
CREATE POLICY "fin_pagos_policy" ON bi.fin_pagos FOR ALL USING (true);
CREATE POLICY "fin_conciliaciones_policy" ON bi.fin_conciliaciones FOR ALL USING (true);

-- ============================================================================
-- PARTE 7: GRANTS
-- ============================================================================

GRANT SELECT ON bi.v_client_credit_health TO authenticated, anon;
GRANT SELECT ON bi.v_aging_cartera TO authenticated, anon;
GRANT SELECT ON bi.v_factura_conciliaciones TO authenticated, anon;
GRANT SELECT ON bi.v_pago_asignaciones TO authenticated, anon;

GRANT ALL ON bi.fin_clientes TO authenticated;
GRANT ALL ON bi.fin_facturas TO authenticated;
GRANT ALL ON bi.fin_pagos TO authenticated;
GRANT ALL ON bi.fin_conciliaciones TO authenticated;

GRANT EXECUTE ON FUNCTION bi.fn_conciliar_pago_fifo TO authenticated;
GRANT EXECUTE ON FUNCTION bi.fn_resumen_financiero_cliente TO authenticated;
GRANT EXECUTE ON FUNCTION bi.fn_puede_comprar TO authenticated;

-- ============================================================================
-- PARTE 8: DATOS DE PRUEBA (Comentados - Descomentar para testing)
-- ============================================================================

/*
-- Insertar cliente de prueba
INSERT INTO bi.fin_clientes (rut, razon_social, credit_limit, payment_terms_days)
VALUES 
    ('76.xxx.xxx-x', 'Cliente Demo S.A.', 5000000, 30),
    ('77.xxx.xxx-x', 'Otro Cliente Ltda.', 3000000, 60);

-- Insertar facturas de prueba
INSERT INTO bi.fin_facturas (cliente_id, bsale_folio, issue_date, due_date, total_amount, outstanding_balance, tienda)
SELECT 
    c.cliente_id,
    'F-' || generate_series(1, 5),
    CURRENT_DATE - (generate_series(1, 5) * 15),
    CURRENT_DATE - (generate_series(1, 5) * 15) + 30,
    200000,
    200000,
    'EPICBIKE'
FROM bi.fin_clientes c
WHERE c.rut = '76.xxx.xxx-x';

-- Insertar pago de prueba
INSERT INTO bi.fin_pagos (cliente_id, amount_received, unallocated_balance, payment_date, payment_method, reference_code)
SELECT 
    c.cliente_id,
    500000,
    500000,
    CURRENT_DATE,
    'TRANSFERENCIA',
    'TRF-2024-001'
FROM bi.fin_clientes c
WHERE c.rut = '76.xxx.xxx-x';

-- Probar conciliación automática
SELECT * FROM bi.fn_conciliar_pago_fifo(
    (SELECT pago_id FROM bi.fin_pagos ORDER BY created_at DESC LIMIT 1)
);
*/

-- ============================================================================
-- FIN DE LA MIGRACIÓN 018
-- ============================================================================
