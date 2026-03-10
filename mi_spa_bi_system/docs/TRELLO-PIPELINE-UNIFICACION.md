# Unificación Trello → Dashboard Bluefishing BI

Este documento describe el **pipeline real** extraído de Trello y cómo unificarlo en el dashboard (Wholesale CRM y módulos relacionados).

**Fecha de extracción:** 2026-03-09  
**Origen:** API Trello — boards, listas y cards del usuario.

---

## 1. Boards encontrados (resumen)

| Board | Listas (columnas) | Cards total | Uso |
|-------|-------------------|-------------|-----|
| **Área de Vendedores de Terreno** | 10 | 269 | **Pipeline principal wholesale** — clientes, pedidos, despacho, reclamos |
| **Epicbike.cl** | 7 | 57 | Pipeline secundario (bicicletas) — listado clientes → contacto → pedido → preparación → tránsito |
| **Importaciones Mi Tienda Spa** | 4 | 40 | Pipeline de **importaciones**: documentación → producción → llegada órdenes → recepción marcas |
| **Operations and Business Development** | 7 | 8 | Tareas internas (facturación, ventas, importación, Mercado Libre, WooCommerce, etc.) |

El que debe unificarse al dashboard es **Área de Vendedores de Terreno**.

---

## 2. Pipeline real: Área de Vendedores de Terreno

Columnas en orden (flujo de trabajo real):

| # | Lista Trello | Cards | Equivalente en dashboard (actual) |
|---|--------------|-------|-----------------------------------|
| 1 | CLIENTES PERU | 8 | Fuera de Chile — considerar como “lista especial” o filtro Zona |
| 2 | LISTAS DE TIENDAS CERRADAS | 18 | Clientes inactivos/cerrados — no es etapa de pedido |
| 3 | **CLIENTES** | 129 | Base de contactos (no es etapa del pipeline de pedidos) |
| 4 | **REGISTRO VISITA CLIENTE Contacto con el cliente** | 54 | Contacto / visita programada |
| 5 | **NUEVO PEDIDO** | 25 | `new_order` |
| 6 | **En Preparacion** | 3 | `preparing` |
| 7 | **LISTO PARA DESPACHO** | 18 | `ready_to_ship` |
| 8 | **En transito a Cliente** | 7 | `in_transit` |
| 9 | **Confirmacon de Entrega** | 3 | `delivered` |
| 10 | **COMPRA CON RECLAMO** | 4 | `complaint` |

### 2.1 Diferencias con el dashboard actual

- El dashboard hoy tiene 6 columnas: New → Preparing → Ready to ship → In transit → Delivered → Complaint.
- En Trello hay **3 listas previas al pedido**: CLIENTES (base), REGISTRO VISITA (contacto), y luego NUEVO PEDIDO. Es decir:
  - **CLIENTES** = directorio de contactos (no es una columna de “estado del pedido”).
  - **REGISTRO VISITA CLIENTE** = “contacto con el cliente” / visita — en el dashboard podría ser una pestaña “Contactos” o “Visitas” además del pipeline de pedidos.
- **CLIENTES PERU** y **LISTAS DE TIENDAS CERRADAS** son listas auxiliares (segmentos de clientes), no etapas del flujo de pedidos.

### 2.2 Mapeo recomendado para sincronización

| Id lista Trello (nombre) | Stage key en dashboard | Notas |
|--------------------------|------------------------|--------|
| NUEVO PEDIDO | `new_order` | |
| En Preparacion | `preparing` | |
| LISTO PARA DESPACHO | `ready_to_ship` | |
| En transito a Cliente | `in_transit` | |
| Confirmacon de Entrega | `delivered` | |
| COMPRA CON RECLAMO | `complaint` | |
| CLIENTES | (no es etapa; es fuente de contactos) | Sincronizar como “contactos” / CRM |
| REGISTRO VISITA CLIENTE... | (opcional) `contact` / “Visita” | Ver verificación de visita / llamada |
| CLIENTES PERU | Filtro o tag “Perú” | |
| LISTAS DE TIENDAS CERRADAS | Filtro “Cerrados” / inactivos | |

---

## 3. Etiquetas (labels) en Trello a conservar

En las cards se usan etiquetas que deben reflejarse en el dashboard:

- **Zona:** ZONA NORTE, ZONA CENTRO, ZONA SUR, LITORAL CENTRAL, REGION METROPOLITANA, Zona Norte, Zona Central, Zona Sur.
- **Descuento:** dscto 10%, dscto especial, SIN DSCTO.
- **Estado cliente:** CONTACTO FRECUENTE, CLIENTES NUEVOS, CREDITO, NO RESPONDE!, Visita, CERRO TIENDA.
- **Otros:** PENDIENTE PAGO, CONSIGNACION, CLIENTE PREFERENCIAL, AGENDAR CITA, etc.

**Recomendación:** En la unificación, mapear labels a campos del CRM (zona, descuento, estado de contacto, crédito) para filtros y vistas.

---

## 4. Pipeline Epicbike.cl (referencia)

Para un segundo negocio (bicicletas) el flujo es:

1. LISTADO CLIENTES  
2. clientes ya contactados  
3. Visita programada  
4. tiendas ya visitadas  
5. Nuevo Pedido  
6. En Preparacion  
7. En transito a Cliente  

No hay “Listo para despacho” ni “Confirmación de entrega” ni “Reclamo” en este board. Si en el futuro se unifica multi-marca, este pipeline podría ser un “board” alternativo con las mismas etapas base.

---

## 5. Pipeline Importaciones (referencia)

Flujo de **importaciones** (no ventas a cliente final):

1. DOCUMENTACION  
2. PEDIDOS EN PRODUCCION  
3. LLEGADA DE ORDENES  
4. RECEPCION MARCAS  

Útil para un futuro módulo “Importaciones” o “Compras” en el dashboard (no reemplaza el CRM wholesale).

---

## 6. Próximos pasos para unificar en el dashboard

1. **Sincronización Trello → Supabase (v3)**  
   - Leer boards/listas/cards vía API Trello (script ya existe: `scripts/trello-extract-pipeline.js`).  
   - Guardar en tablas: `trello_boards`, `trello_lists`, `trello_cards` (o equivalente) y enlazar con `clientes` / `pedidos` por nombre o RUT si está en la card.

2. **Ajustar columnas del Wholesale CRM**  
   - Mantener las 6 columnas de pedido (New → … → Complaint).  
   - Añadir origen de datos: “Trello” vs “Demo” hasta que la sync esté activa.  
   - Opcional: columna o filtro “Contacto / Visita” alimentado por la lista REGISTRO VISITA CLIENTE.

3. **Contactos (lista CLIENTES)**  
   - Tratar la lista CLIENTES como fuente de “contactos” del CRM: importar o sincronizar nombres, etiquetas (zona, descuento) y enlace a la card Trello.

4. **Labels → campos**  
   - Normalizar ZONA NORTE/CENTRO/SUR y “dscto 10%” / “SIN DSCTO” en campos del modelo de datos (cliente/contacto) para reportes y filtros.

---

## 7. Archivos generados

- **`dashboard/public/trello-pipeline-export.json`** — Export crudo: boards, listas, cards (ids, nombres, desc, due, labels).  
- **`scripts/TRELLO-PIPELINE-EXPORT.md`** — Resumen legible por board y lista.  
- **`docs/TRELLO-PIPELINE-UNIFICACION.md`** — Este documento (unificación y próximos pasos).

Para re-exportar Trello (tras cambios en los boards):

```bash
cd <repo_root>
node mi_spa_bi_system/scripts/trello-extract-pipeline.js
```

Requiere `.env` con `API_TRELLO_KEY` y `TRELLO_TOKEN`.
