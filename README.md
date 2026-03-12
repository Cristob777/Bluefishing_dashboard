# MISPA Dashboard — BI Platform for E-Commerce Operations

> Production-grade BI system integrating ERP data (Bsale API) with ML forecasting and financial analytics for a 15,000+ SKU e-commerce operation.

[![Next.js](https://img.shields.io/badge/Next.js-14.0.4-black?logo=nextdotjs)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)](https://supabase.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-000?logo=vercel)](https://vercel.com/)

---

<img width="1919" height="842" alt="Captura de pantalla 2026-03-12 103737" src="https://github.com/user-attachments/assets/8e4fac80-70cc-45ad-ad03-74da477703d2" />
<img width="1916" height="652" alt="Captura de pantalla 2026-03-12 114039" src="https://github.com/user-attachments/assets/8c9f5ae4-c1f6-4e00-baa6-0f8ff6ca8f42" />
<img width="1915" height="824" alt="Captura de pantalla 2026-03-12 114059" src="https://github.com/user-attachments/assets/a8720f9f-15b7-4183-9622-ad46fec33660" />
<img width="1919" height="822" alt="Captura de pantalla 2026-03-12 114134" src="https://github.com/user-attachments/assets/d0f3e5d4-b9ab-4972-9408-1c4b2f510693" />
<img width="1919" height="686" alt="Captura de pantalla 2026-03-12 114111" src="https://github.com/user-attachments/assets/bc02e3fd-f72e-47e0-9d89-6d71d5e93756" />

## The Problem

MISPA operates **BlueFishing.cl** — a Chilean e-commerce brand specializing in fishing gear and apparel — running all transactions through Bsale (Chile's leading POS/ERP platform). Before this project:

- **Reporting took ~48 hours** of manual Excel work per cycle
- **No visibility into payment status for wholesale clients** — merchandise was shipped to mayoristas on credit terms, stock deducted immediately, but payment only arrives weeks or months later. Nobody tracked which invoices were actually paid — reconciliation was done manually in Excel
- **Product categorization was manual** across 15,000+ SKUs with no standardized taxonomy
- **Inventory decisions were reactive** — stockouts and dead stock discovered too late
- **Zero forecasting capability** — purchasing based on gut feeling, not data
- **No regional sales intelligence** — couldn't see performance by geography or client type
- **Credit risk was invisible** — no system to block or flag risky clients before extending credit
- **No seller accountability** — no way to track if sales reps were following up with their assigned clients, calling them back, or letting accounts go cold

---

## What MISPA Dashboard Solves

| Problem | Before | After |
|---------|--------|-------|
| Reporting cycle | ~48 hours manual Excel | < 5 minutes, automated |
| Product categorization | Manual, inconsistent | Automated across 33+ categories |
| Payment visibility (wholesale) | None — Excel reconciliation weeks after due date | Real-time status per invoice + FIFO conciliation + aging by client |
| Inventory health | Reactive, spreadsheet-based | Proactive alerts: critical stock, dead stock, ABC classification |
| Sales forecasting | Gut feeling | SQL-based predictive models with stock coverage projections |
| Customer intelligence | None | Dual segmentation: RFM (8 segments) + commercial tiers (5 levels) |
| Regional analysis | None | Geographic sales heatmaps + per-region category/client breakdown |
| Credit control (wholesale) | None — reps didn't know if client was overdue | Automated credit health scoring + purchase blocking before shipping |
| Business queries | Ask someone, wait for Excel | Internal BI agent + WhatsApp webhook for owner queries |
| Wholesale visibility | None | Dedicated B2B analytics: top mayoristas by region, zone summaries |
| Seller performance | No tracking — managers didn't know if reps called their clients | Per-seller metrics, client follow-up tracking, accountability dashboard |

---

## Business Impact

### Revenue Protection: Wholesale Credit & Payment Tracking

The most critical problem this system solves is the gap between **shipping merchandise and collecting payment from wholesale clients**. BlueFishing sells to mayoristas (B2B clients) on credit terms — the standard flow is:

1. A wholesale order is placed → invoice is emitted in Bsale
2. Stock is deducted immediately and merchandise is shipped
3. The client has 30, 60, or 90 days to pay depending on their credit terms
4. **Nobody tracked whether the payment actually arrived on time — or at all**

This creates a silent cash leak. The business has inventory out the door, revenue on paper, but cash sitting in accounts receivable with no systematic follow-up. Before MISPA Dashboard, someone had to cross-reference Bsale invoices against bank statements in Excel — typically weeks after the payment was already overdue.

**What the Financial module does now — replacing the manual Excel process:**

- Automatically syncs invoices and payments from Bsale into a normalized financial schema (`fin_facturas`, `fin_pagos`, `fin_conciliaciones`)
- **FIFO conciliation engine** (`fn_conciliar_pago_fifo`) — automatically matches payments to oldest outstanding invoices first, with full validation and reversal support
- Classifies each invoice status in real-time: **paid**, **partially paid**, **overdue**, **in default** — with `fn_actualizar_facturas_vencidas()` running automatically
- Applies aging buckets (current, 1–30, 31–60, 61–90, 90+ days) via `v_aging_cartera` to quantify financial exposure
- **Credit health scoring** per client (`v_client_credit_health`) with statuses: OK, MOROSO, SOBREGIRADO, BLOQUEADO
- **Purchase blocking** (`fn_puede_comprar`) — the system decides if a client can place new orders based on outstanding debt, mora status, and credit limit
- Projects **cash flow** via `v_flujo_caja` based on expected vs. actual collection rates
- Triggers automated alerts through `generar_alertas_sistema()` when invoices cross overdue thresholds

### Quantified Business Outcomes

| Metric | Impact |
|--------|--------|
| **Reporting labor saved** | ~48 hours/cycle → <5 min = ~190 hours/year recovered |
| **Invoice visibility** | From 0% real-time tracking to 100% of wholesale credit invoices monitored with aging and FIFO conciliation |
| **Overdue detection speed** | From weeks (manual Excel reconciliation) to same-day automated alerts |
| **Credit risk control** | Per-client credit health status with automated purchase blocking — no more shipping to overdue mayoristas |
| **Dead stock identification** | SKUs with zero movement >90 days flagged automatically, freeing working capital |
| **Stockout prevention** | Predictive stock coverage (days remaining) calculated per product, with break alerts |
| **Customer segmentation** | Full client base scored via RFM (8 segments) + commercial tiers (5 levels) + client type (mayorista/minorista) |
| **Regional intelligence** | Sales, clients, categories, and warehouse performance broken down by Chilean region with heatmaps |
| **Forecast-driven purchasing** | SQL-based predictive models with seasonal factors replace gut-feeling ordering |
| **Self-service analytics** | Internal BI agent + WhatsApp webhook — owner queries data without waiting for reports |
| **Seller accountability** | Per-rep client follow-up tracking — managers see which accounts are being contacted and which are going cold |

### How This Translates to Business Value

**Cash flow:** With wholesale clients on 30–90 day credit terms, delayed detection of unpaid invoices means delayed collection action. The FIFO conciliation engine automatically matches payments to invoices — no manual Excel reconciliation needed. Every week of delay in identifying an overdue mayorista invoice is a week of lost collection opportunity. The system compresses this from weeks to hours.

**Credit protection:** `fn_puede_comprar()` prevents the business from shipping more merchandise to wholesale clients who haven't paid previous orders. Before this, sales reps had no way to know a mayorista was already overdue — now the system blocks risky transactions automatically.

**Working capital:** ABC classification and dead stock detection directly impact how much capital is tied up in inventory. Identifying and liquidating non-rotating stock frees cash for high-performing products.

**Operational efficiency:** The ~190 hours/year saved on manual reporting is redistributed to higher-value activities — negotiating with suppliers, managing customer relationships, and growing the business instead of maintaining spreadsheets.

**Decision quality:** Every purchasing, pricing, and credit decision is now backed by data instead of intuition. The BI agent and WhatsApp webhook allow non-technical team members to query the data directly.

**Sales team management:** Managers can now see which sellers are actively working their accounts and which are letting clients go cold. RFM segmentation automatically surfaces at-risk clients — sellers get actionable lists of who to call, and management has visibility into whether follow-up is happening. This closes the loop between client intelligence and sales execution.

---

## Architecture

```
                    ┌──────────────┐
                    │   Bsale API  │  ← Single Source of Truth
                    │    (V1)      │
                    └──────┬───────┘
                           │
              ┌────────────▼────────────┐
              │    Supabase Edge        │
              │    Functions (Deno)     │
              │    ETL + Transforms     │
              └────────────┬────────────┘
                           │
              ┌────────────▼────────────┐
              │   staging schema        │  Raw Bsale data:
              │   (raw_bsale_*)         │  documents, variants,
              │                         │  clients, stocks
              └────────────┬────────────┘
                           │  Transform + Load
              ┌────────────▼────────────┐
              │   bi schema             │  Business-ready:
              │   dim_* + fact_*        │  productos, clientes,
              │   fin_* (financial)     │  ventas, cobranza,
              │   58 views + 8 MVs     │  pagos, conciliaciones
              └────────────┬────────────┘
                           │
         ┌─────────────────┼──────────────────┐
         │                 │                  │
  ┌──────▼──────┐  ┌──────▼───────┐  ┌──────▼───────┐
  │ 51 SQL      │  │ Next.js 14   │  │ WhatsApp     │
  │ Functions   │  │ Dashboard    │  │ BI Webhook   │
  │ (RPC)       │  │ (20 pages)   │  │              │
  └─────────────┘  └──────────────┘  └──────────────┘
```

**Core principle:** Bsale owns all transactional data. BlueFishing.cl is the commercial web layer — it doesn't hold data, generate stock, or run transactions. MISPA is the legal entity operating the brand through Bsale.

> **Note on scope:** The platform was architected from day one to support multiple brands under MISPA (BlueFishing + EpicBike). EpicBike was descoped during the project due to a business decision, not a technical limitation. The multi-tenant data isolation, brand-level filtering, and `dim_productos` design remain in place — onboarding a second brand requires configuration, not re-architecture.

---

## Modules

### 1. ETL Pipeline (Staging → BI)
- **5 Supabase Edge Functions** handling extraction, transformation, and loading
- Extracts from 10+ Bsale API endpoints: variants, clients, documents, details, stocks, offices, payments, document types, returns, price lists
- Shared transform layer (`_shared/transform.ts`) with deduplication, ID extraction, and normalization
- Two-schema architecture: `staging` (raw landing) → `bi` (analytical serving)
- Post-load triggers automatically refresh materialized views, generate predictions, run alerts, and sync the financial module
- Incremental sync designed for 4-hour intervals
- 19 sequential SQL migrations managing the full schema evolution

### 2. Analytics Dashboard (20 pages)
- **Sales analytics** (`/ventas`): Revenue by category, product, and period with drill-down + YoY comparatives via `mv_comparativo_yoy`
- **Inventory health** (`/inventario`): Stock per warehouse, ABC classification, rotation analysis, web availability tracking via `mv_disponibilidad_web`
- **Categories** (`/categorias`): Product distribution, sales performance per category
- **Regional analysis** (`/regiones`): Geographic sales heatmaps with Leaflet maps, per-region breakdowns of categories, clients, and products across Chilean regions
- **Predictions** (`/predicciones`): Sales forecast visualization, stock coverage projections, predictive alerts
- **Alerts** (`/alertas`): System-generated alerts for stockouts, anomalies, and overdue thresholds
- **Sellers** (`/vendedores`): Per-rep performance metrics, client portfolio tracking, and follow-up accountability
- **Cash flow** (`/flujo-caja`): Expected vs. actual cash flow projection

### 3. Financial Module — Invoice Tracking & Conciliation
- **Dedicated schema** (`fin_clientes`, `fin_facturas`, `fin_pagos`, `fin_conciliaciones`) with automatic sync from core BI tables
- **FIFO conciliation engine:** `fn_conciliar_pago_fifo()` matches payments to oldest invoices first, with validation (`fn_validar_conciliacion`) and reversal (`fn_reversar_conciliacion`) support via database triggers
- **4 financial pages:**
  - `/finanzas` — Financial overview and KPIs (`v_kpi_cobranza`)
  - `/finanzas/facturas` — Invoice listing with status and aging
  - `/finanzas/pagos` — Payment tracking with period views (`v_pagos_periodo`)
  - `/finanzas/conciliacion` — Invoice↔payment matching interface
  - `/finanzas/clientes` — Per-client financial health and credit status
- **Aging analysis** via `v_aging_cartera` + `mv_aging_cartera`: current, 1–30, 31–60, 61–90, 90+ day buckets
- **Automated overdue flagging:** `fn_actualizar_facturas_vencidas()` updates invoice status automatically
- **Credit control:** `fn_puede_comprar()` blocks purchases for clients exceeding debt/mora thresholds

### 4. CRM — Client Intelligence, Seller Performance & Follow-up
- **Triple segmentation system:**
  - **RFM** (8 segments): Champions, Loyal, Big Spenders, Promising, At Risk, Can't Lose, Lost, Regular — scored via NTILE(5) on Recency, Frequency, Monetary
  - **Commercial tiers** (5 levels): VIP, PREMIUM, FRECUENTE, REGULAR, RETAIL — based on purchase volume
  - **Client type**: MAYORISTA / MINORISTA — for B2B vs. B2C analytics
- **Seller performance tracking** (`/vendedores`):
  - Per-seller sales metrics: revenue, number of transactions, average ticket, conversion
  - Client portfolio per seller — which accounts are assigned and their current status
  - **Follow-up accountability**: visibility into whether reps are contacting their clients, tracking call/contact activity against at-risk or declining accounts
  - Managers can see which sellers are letting accounts go cold vs. actively maintaining relationships
- **Client follow-up intelligence:**
  - At-risk and declining clients are surfaced automatically via RFM segmentation — the CRM flags when a Champions or Loyal client starts showing lower recency or frequency
  - Sellers get actionable lists: "These 5 clients haven't purchased in 60+ days — call them"
  - Credit health status per client means sellers know before calling if a client has overdue invoices
- **Credit health scoring** via `v_client_credit_health` with statuses: OK, MOROSO, SOBREGIRADO, BLOQUEADO
- **Mora risk model** (`riesgo_mora`) with `score_riesgo` and `categoria_riesgo`
- **Client financial summary** via `fn_resumen_financiero_cliente()`: total debt, overdue amount, payment history
- **Regional client intelligence**: `v_clientes_por_region`, `v_top_mayoristas_region`, `v_mapa_ventas_segmento`
- **Automated classification**: `actualizar_clasificacion_clientes()` re-scores the entire client base

### 5. Internal BI Agent (Chat)
- **Available on two channels:**
  - **Dashboard** (`/agente`): Built-in chat interface — team members query the business in natural language
  - **WhatsApp** (`whatsapp-webhook/index.ts`): Owner receives answers via Meta Cloud API (WhatsApp Business) — no need to open the dashboard
- **Powered by LangChain + Claude API**: Interprets natural language queries, generates SQL against the analytical views, and returns structured answers in conversational Spanish
- **Full coverage across all modules:**
  - **Sales**: "¿Cuánto vendimos en señuelos este mes?", "Top 10 productos por revenue"
  - **Inventory**: "¿Qué productos están en quiebre de stock?", "Muéstrame el ABC de inventario"
  - **Finance**: "¿Cuántas facturas están vencidas a más de 60 días?", "¿Cuál es el flujo de caja proyectado?"
  - **Clients**: "¿Quiénes son mis clientes Champions?", "¿Qué clientes están en riesgo de pérdida?"
- **Supporting AI infrastructure in the database:**
  - `knowledge_base` table with vector embeddings (`vector(1536)`) for semantic search via `buscar_conocimiento()`
  - `text_to_sql()` function and `text_to_sql_catalog` for natural language → SQL translation
- **Designed for non-technical users:** The business owner and team get answers from the entire data warehouse without writing SQL or waiting for someone to build a report

### 6. Wholesale / B2B Analytics
- **Dedicated page** (`/wholesale`): B2B client analytics
- **Regional wholesale views**: `v_resumen_mayorista_zona`, `v_top_mayoristas_region`
- **Warehouse-level analysis**: `v_bodega_tipo_cliente`, `v_stock_bodega_detalle`, `v_matriz_ventas_bodega_marca`
- **Segment-based maps**: `v_mapa_ventas_segmento` combining geography with client type

### 7. Predictive Analytics
- **SQL-based forecasting engine**: `generar_prediccion_ventas()`, `generar_predicciones()`
- **Stock coverage projections**: `calcular_dias_cobertura()`, `calcular_venta_promedio_diaria()`
- **Stockout detection**: `detectar_quiebres_stock()`, `detectar_quiebres_inminentes()`
- **Seasonal factors**: `factores_estacionalidad` table for demand adjustment
- **Mora risk projection**: `calcular_riesgo_mora()` for payment behavior prediction
- **Cash flow projection**: `proyectar_flujo_caja()` for liquidity forecasting
- **Alerting system**: `generar_alertas_sistema()` creates actionable alerts across all modules

---

## Database at a Glance

| Component | Count |
|-----------|-------|
| Tables | 35 |
| Views | 53 |
| Materialized Views | 8 |
| SQL Functions (RPCs) | 51 |
| Triggers | 5 |
| Migrations | 19 |
| Schemas | 2 (`staging`, `bi`) |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14.0.4, React 18, TypeScript 5.3, Tailwind CSS, Tremor, Recharts, Leaflet |
| Backend | Supabase Edge Functions (Deno), PostgreSQL RPCs |
| Database | PostgreSQL via Supabase (2 schemas: `staging` + `bi`) |
| ETL | Supabase Edge Functions, Bsale API V1 (10+ endpoints) |
| Financial Engine | PostgreSQL functions with trigger-based FIFO conciliation |
| Predictive | SQL-based forecasting, seasonal adjustment, stock coverage modeling |
| AI Infrastructure | LangChain, Claude API, knowledge base with vector embeddings, text-to-SQL catalog |
| Messaging | WhatsApp Business API (Meta Cloud API v18.0) |
| Maps | Leaflet + React-Leaflet for Chilean regional heatmaps |
| Deployment | Vercel (frontend), Supabase (DB + Edge Functions + Auth) |
| Data Source | Bsale API — Chile's leading POS/ERP |

---

## Key Metrics

- **15,000+ SKUs** managed for BlueFishing.cl
- **~500 daily transactions** processed through Bsale
- **~$2M USD annual revenue** flowing through the system
- **35 tables, 53 views, 8 materialized views** in the analytical warehouse
- **51 SQL functions** powering ETL, predictions, alerts, conciliation, and CRM scoring
- **19 migrations** tracking full schema evolution
- **20 dashboard pages** covering sales, inventory, finance, CRM, regions, wholesale, and predictions
- **5 Supabase Edge Functions** handling ETL, cobranza, view refresh, WhatsApp, and data maintenance
- **Triple client segmentation**: RFM (8 segments) + commercial tiers (5 levels) + client type (2 categories)
- **FIFO conciliation** with validation, application, and reversal — fully trigger-based
- **5 aging buckets** tracking receivables exposure from current to 90+ days
- **99% reduction** in reporting time (48h → <5 min)

---

## Current Status & Roadmap

### Fully implemented and operational
- ETL pipeline with Bsale API extraction and incremental sync
- Complete financial module with FIFO conciliation and credit control
- CRM with triple segmentation and automated classification
- Regional analytics with Leaflet heatmaps
- SQL-based predictive engine with stock coverage and seasonal adjustments
- Dashboard with 20 pages across all modules
- BI Agent (LangChain + Claude) on dashboard and WhatsApp — covers sales, inventory, finance, and CRM queries
- WhatsApp webhook infrastructure

### In progress / Next milestones
- MCP server integration for enhanced agent capabilities
- ISR (Incremental Static Regeneration) on Vercel for performance
- Live data connection for wholesale module (currently demo data)
- `dim_vendedores` table for full seller analytics
- Test coverage

---

## Project Context

This is a production system built for a real business — not a tutorial project. It processes live transactional data from BlueFishing.cl, a Chilean e-commerce operation specializing in fishing gear with a catalog of 15,000+ SKUs and ~$2M USD in annual revenue. The repository contains a sanitized version with synthetic data preserving the full architecture, ETL logic, and analytical layer.

**Built by:** Cristóbal — Data Engineer & BI Developer, MSc AI for Business (NCI, Dublin)

---

## License

This project is shared for portfolio and demonstration purposes. The underlying business data is proprietary and not included.

