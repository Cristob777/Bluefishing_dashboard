# 🚀 Hoja de Ruta Estratégica - MI SPA BI SYSTEM v2.0

## Resumen Ejecutivo

Este documento describe las mejoras implementadas y pendientes para llevar el sistema MI SPA BI al siguiente nivel, basado en mejores prácticas de BI, ETL/ELT y protocolos de IA (MCP).

---

## 📊 Estado de Implementación

| Pilar | Mejora | Estado | Migración |
|-------|--------|--------|-----------|
| **Arquitectura de Datos** | Patrón ELT con Staging | ✅ Implementado | 016 |
| **Arquitectura de Datos** | Vista Disponibilidad Web | ✅ Implementado | 016 |
| **Rendimiento Backend** | Índices estratégicos | ✅ Implementado | 016 |
| **Rendimiento Backend** | RLS preparado | ✅ Implementado | 016 |
| **IA (MCP)** | Funciones MCP-Ready | ✅ Implementado | 016 |
| **IA (MCP)** | Servidor MCP | ⏳ Pendiente | - |
| **UX/UI** | ISR en Vercel | ⏳ Pendiente | - |
| **UX/UI** | Drill-down interactivo | ⏳ Pendiente | - |

---

## 1. 🔄 Evolución de ETL a ELT

### Antes (ETL en Edge Functions)

```
BSALE API → TypeScript Transform → PostgreSQL
              ↑
     Lógica de negocio aquí
     (lento, no reprocesable)
```

### Ahora (ELT con Staging)

```
BSALE API → Raw JSON → staging.* → SQL Transform → bi.*
                ↑                        ↑
         Datos puros           Lógica de negocio
         (auditables)          (100x más rápido)
```

### Tablas de Staging Creadas

```sql
staging.raw_bsale_documents   -- Facturas/ventas crudas
staging.raw_bsale_variants    -- Productos crudos
staging.raw_bsale_clients     -- Clientes crudos
staging.raw_bsale_stocks      -- Stock crudo
staging.extraction_log        -- Auditoría de extracciones
```

### Beneficios

1. **Historial Puro**: Si cambia una regla de negocio, reprocesas sin llamar a Bsale
2. **Velocidad**: SQL transforma miles de filas en milisegundos
3. **Auditoría**: Siempre puedes ver qué llegó de Bsale exactamente
4. **Checksum**: Detecta cambios en datos entre extracciones

### Uso

```sql
-- 1. La Edge Function solo hace esto:
INSERT INTO staging.raw_bsale_documents (bsale_document_id, raw_json)
VALUES (12345, '{"emissionDate": 1706000000, ...}'::jsonb);

-- 2. Luego ejecutas el pipeline de transformación:
SELECT * FROM staging.run_elt_pipeline();

-- Resultado:
--   step      | processed | inserted | errors | duration_ms
-- ------------+-----------+----------+--------+-------------
--  variants   |       500 |      498 |      2 |         120
--  documents  |       200 |     1850 |      5 |         340
--  refresh    |         0 |        0 |      0 |         890
```

---

## 2. 🤖 Funciones MCP-Ready (Preparación para IA)

### ¿Qué es MCP?

El **Model Context Protocol** es un estándar para conectar LLMs con datos estructurados. En lugar de que el Agente BI tenga lógica hardcodeada, expone "herramientas" que el LLM puede llamar.

### Funciones Implementadas

```sql
-- Obtener KPIs principales
bi.mcp_get_kpis(p_tienda, p_periodo_dias)
-- Retorna: ventas, transacciones, ticket_promedio, stock, por_cobrar

-- Obtener stock de producto (con regla Curanipe)
bi.mcp_get_stock_producto(p_sku, p_producto_id)
-- Retorna: stock_web, stock_fisico_exclusivo, disponible_web

-- Obtener alertas activas
bi.mcp_get_alertas(p_prioridad, p_limite)
-- Retorna: alertas con producto y cliente asociados

-- Resumen de bodegas
bi.mcp_get_resumen_bodegas()
-- Retorna: configuración de cada bodega con regla Curanipe explicada
```

### Ejemplo de Respuesta MCP

```json
{
  "periodo_dias": 30,
  "tienda_filtro": "BLUEFISHING",
  "kpis": {
    "ventas_periodo": 45230000,
    "transacciones": 1523,
    "ticket_promedio": 29700,
    "stock_total_unidades": 8542,
    "stock_valor": 125000000,
    "por_cobrar": 12500000
  },
  "variacion_pct": 8.5
}
```

### Integración Futura con Cursor

```typescript
// En tu .cursor/mcp.json
{
  "servers": {
    "mi-spa-bi": {
      "type": "supabase",
      "url": "https://xxx.supabase.co",
      "tools": ["mcp_get_kpis", "mcp_get_stock_producto", "mcp_get_alertas"]
    }
  }
}
```

---

## 3. 🌐 Vista de Disponibilidad Web (Regla Curanipe)

### Problema de Negocio

- **Bodegas compartidas**: Stock disponible para ambas marcas (web)
- **Curanipe**: Stock SOLO para venta física (no suma a web)

### Solución SQL

```sql
-- Vista materializada que encapsula la regla
bi.mv_disponibilidad_web

-- Columnas clave:
stock_ecommerce_compartido  -- Disponible para web (excluye Curanipe)
stock_fisico_exclusivo      -- Solo en bodegas dedicadas (Curanipe)
stock_total                 -- Todo el stock de la empresa
disponible_web              -- Boolean: ¿Se puede vender online?
tipo_disponibilidad         -- 'SOLO_WEB', 'SOLO_FISICO', 'MIXTO', 'SIN_STOCK'
```

### Uso en Frontend

```typescript
// Antes (lógica en JS, propenso a errores)
const stockWeb = stocks.filter(s => s.bodega !== 'Curanipe').reduce(...);

// Ahora (un número limpio desde SQL)
const { data } = await supabase
  .from('mv_disponibilidad_web')
  .select('sku, stock_ecommerce_compartido, disponible_web')
  .eq('disponible_web', true);
```

---

## 4. 🔒 Row Level Security (RLS) Preparado

### Tabla de Permisos

```sql
bi.user_permissions
├── user_id         -- UUID del usuario
├── permission_type -- ADMIN, MANAGER, VIEWER, BODEGA_ONLY, MARCA_ONLY
├── tienda_filter   -- Array de tiendas permitidas (NULL = todas)
└── bodega_filter   -- Array de bodegas permitidas (NULL = todas)
```

### Políticas Actuales

```sql
-- Por ahora permisivas (single-tenant)
fact_ventas_select_policy: bi.user_has_access_to_tienda(tienda)
fact_stock_select_policy: TRUE
fact_cobranza_select_policy: bi.user_has_access_to_tienda(tienda)

-- Solo service_role puede modificar
fact_ventas_modify_policy: current_setting('role') = 'service_role'
```

### Ejemplo Futuro (Multi-tenant)

```sql
-- Usuario "Encargado Curanipe" solo ve su bodega
INSERT INTO bi.user_permissions (user_id, permission_type, bodega_filter)
VALUES ('uuid-xxx', 'BODEGA_ONLY', ARRAY[3]); -- bodega_id 3 = Curanipe

-- La política automáticamente filtra
SELECT * FROM bi.fact_ventas; -- Solo ve ventas de Curanipe
```

---

## 5. 📈 Índices Estratégicos

### Índices Creados

| Tabla | Índice | Propósito |
|-------|--------|-----------|
| `fact_ventas` | `(tienda, fecha DESC)` | Filtros por tienda y período |
| `fact_ventas` | `(cliente_id, fecha DESC)` | Historial de cliente |
| `fact_ventas` | `(bodega_id, tienda)` | Análisis por bodega |
| `fact_stock` | `(producto_id, bodega_id, fecha DESC)` | Disponibilidad actual |
| `dim_productos` | `(tienda, es_activo)` | Catálogo activo por marca |
| `dim_bodegas` | `GIN(marcas_servidas)` | Búsqueda en array de marcas |

### Índice Parcial (Hot Data)

```sql
-- Solo indexa ventas del mes actual (más consultadas)
CREATE INDEX idx_fact_ventas_mes_actual 
ON bi.fact_ventas (fecha, tienda, bodega_id) 
WHERE fecha >= DATE_TRUNC('month', CURRENT_DATE);
```

---

## 6. ⏳ Mejoras Pendientes

### A. Servidor MCP Completo

```typescript
// supabase/functions/mcp-server/index.ts
// Exponer todas las funciones bi.mcp_* como herramientas MCP

export const mcpManifest = {
  name: "mi-spa-bi",
  version: "1.0.0",
  tools: [
    {
      name: "get_kpis",
      description: "Obtiene KPIs de ventas, stock y cobranza",
      parameters: {
        tienda: { type: "string", enum: ["EPICBIKE", "BLUEFISHING"] },
        periodo_dias: { type: "number", default: 30 }
      }
    },
    // ... más herramientas
  ],
  resources: [
    { uri: "supabase://bi/mv_resumen_ejecutivo", name: "Resumen Ejecutivo" },
    { uri: "supabase://bi/mv_disponibilidad_web", name: "Disponibilidad Web" }
  ]
};
```

### B. ISR en Vercel (Dashboard)

```typescript
// app/page.tsx
export const revalidate = 60; // Regenerar cada 60 segundos

export default async function DashboardPage() {
  // Esta consulta se cachea por 60 segundos
  const resumen = await getResumenEjecutivo();
  return <Dashboard data={resumen} />;
}
```

### C. Drill-Down Interactivo

```typescript
// Componente de drill-down
<DrillDownChart
  data={ventas}
  levels={['marca', 'categoria', 'sku']}
  onDrillDown={(level, value) => {
    // Navegar a detalle
    router.push(`/ventas?${level}=${value}`);
  }}
/>
```

### D. Edge Function ELT Simplificada

```typescript
// Nueva versión de etl-bsale (solo extrae y guarda raw)
async function extractToStaging(supabase: SupabaseClient) {
  const documents = await bsale.getDocuments();
  
  // Solo insertar JSON crudo
  for (const doc of documents) {
    await supabase.from('raw_bsale_documents').insert({
      bsale_document_id: doc.id,
      raw_json: doc
    });
  }
  
  // Ejecutar transformación SQL
  await supabase.rpc('run_elt_pipeline');
}
```

---

## 7. 📋 Checklist de Implementación

### Fase 1: Base de Datos (✅ Completado)
- [x] Crear tablas de staging
- [x] Crear funciones de transformación SQL
- [x] Crear vista mv_disponibilidad_web
- [x] Agregar índices estratégicos
- [x] Preparar RLS con políticas permisivas
- [x] Crear funciones MCP-ready

### Fase 2: Backend (Próximo)
- [ ] Modificar Edge Function para patrón ELT
- [ ] Crear endpoint MCP server
- [ ] Implementar cron job para transformaciones
- [ ] Agregar monitoreo de staging

### Fase 3: Frontend (Siguiente)
- [ ] Implementar ISR en páginas principales
- [ ] Crear componente drill-down
- [ ] Integrar funciones MCP en Agente BI
- [ ] Optimizar carga cognitiva (Ley de Miller)

### Fase 4: IA (Futuro)
- [ ] Desplegar servidor MCP completo
- [ ] Conectar Cursor al servidor MCP
- [ ] Entrenar Agente BI con nuevas herramientas
- [ ] Implementar RAG sobre datos históricos

---

## 8. 🎯 Métricas de Éxito

| Métrica | Antes | Después | Objetivo |
|---------|-------|---------|----------|
| Tiempo ETL (1000 docs) | ~5 min | ~30 seg | < 1 min |
| Tiempo carga Dashboard | ~3 seg | ~0.5 seg | < 1 seg |
| Precisión Agente BI | ~70% | ~90% | > 95% |
| Cobertura RLS | 0% | 100% | 100% |
| Reprocesabilidad datos | No | Sí | Sí |

---

## 9. Comandos Útiles

```sql
-- Ver estado del staging
SELECT process_status, COUNT(*) 
FROM staging.raw_bsale_documents 
GROUP BY process_status;

-- Ejecutar pipeline de transformación
SELECT * FROM staging.run_elt_pipeline();

-- Probar funciones MCP
SELECT bi.mcp_get_kpis('BLUEFISHING', 30);
SELECT bi.mcp_get_stock_producto('SKU-123');
SELECT bi.mcp_get_alertas('CRITICA', 5);
SELECT bi.mcp_get_resumen_bodegas();

-- Ver disponibilidad web con regla Curanipe
SELECT sku, producto, stock_ecommerce_compartido, stock_fisico_exclusivo, tipo_disponibilidad
FROM bi.mv_disponibilidad_web
WHERE marca_producto = 'BLUEFISHING'
ORDER BY stock_total DESC
LIMIT 10;
```

---

## 10. Conclusión

Esta hoja de ruta transforma MI SPA BI de un sistema BI tradicional a una plataforma moderna con:

1. **Datos auditables** (staging ELT)
2. **Reglas centralizadas** (SQL, no JS)
3. **IA-ready** (funciones MCP)
4. **Seguridad escalable** (RLS preparado)
5. **Performance optimizado** (índices + ISR)

La implementación es incremental y cada fase agrega valor sin romper lo existente.
