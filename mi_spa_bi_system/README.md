# Bluefishing BI — Business Intelligence for Wholesale Distribution

**Live Demo:** [mi-spa-bi.vercel.app](https://mi-spa-bi.vercel.app)

**Tech:** Next.js 14 · Supabase (PostgreSQL) · Deno Edge Functions · Bsale REST API · Tremor · Vercel · Claude Sonnet (BI Agent)

**Scale:** 15,000 SKUs · 500 daily transactions · ~$2M USD annual revenue

---

## The Problem

Wholesale distributors like Bluefishing.cl face a set of recurring, painful problems that spreadsheets and intuition alone cannot solve:

### 1. Blind Spots in Sales Performance
| Problem | Impact |
|---------|--------|
| Sales data lives in Bsale POS, but there's no easy way to see trends, seasonality, or which products are declining | The owner reacts late — by the time a product stops selling, it has already accumulated dead stock |
| No comparison between periods (this month vs last month, this quarter vs last year) | Impossible to tell if the business is growing or shrinking without manual calculations |
| Revenue concentration — a few wholesale clients generate most of the income, but nobody tracks this | Losing one key client could be catastrophic and the team wouldn't see it coming |

**Solution built:** Real-time sales dashboard with trend charts, period-over-period deltas on every KPI, top product rankings, and an anomaly detection panel that flags contradictions (e.g., "sales up but margin down").

---

### 2. Inventory That Eats Cash
| Problem | Impact |
|---------|--------|
| No visibility into how many days of stock coverage remain | The business either over-stocks (cash trapped in shelves) or under-stocks (lost sales) |
| ABC classification doesn't exist — all 1,183 SKUs are treated equally | The warehouse team spends the same effort on a $50K/year product and a $200/year product |
| No turnover analysis — slow movers hide among fast movers | Dead inventory grows silently, tying up working capital |

**Solution built:** Inventory module with ABC Pareto analysis, turnover velocity by category, stock coverage days, and cross-links to sales data so the team can see cause and effect.

---

### 3. Collections & Cash Flow Gaps
| Problem | Impact |
|---------|--------|
| Wholesale clients pay on 30/60/90-day terms, but nobody tracks who's overdue systematically | The owner finds out a client owes $5M CLP only when cash runs short |
| No aging analysis — a 15-day overdue invoice looks the same as a 90-day one | Collection priority is based on gut feeling, not data |
| Cash flow is managed day by day via WhatsApp messages from the accountant | No forward-looking view — the owner can't plan 2–3 weeks ahead |

**Solution built:** Collections dashboard with aging buckets, recovery rate tracking, overdue risk indicators. Cash flow page with projected inflows/outflows. Insight boxes that flag "recovery rate dropping — tighten credit terms."

---

### 4. Wholesale CRM Chaos
| Problem | Impact |
|---------|--------|
| Client visit notes, call logs, and order status live in Trello boards | Data is scattered — the owner needs to check 3 tools to understand one client |
| No "who to call today" system — sales reps decide ad-hoc who to contact | Hot clients get neglected, cold clients get called too often |
| No pipeline visibility — nobody knows how many orders are in transit vs preparing vs delivered | Fulfillment bottlenecks are invisible until a client complains |

**Solution built:** Wholesale CRM module with contact gap charts, revenue-by-client rankings, purchase recency analysis, outstanding debt tracking, zone distribution, full pipeline view (New → Preparing → Ready → In Transit → Delivered → Complaint), client profiles with files and notes, and a calendar for scheduled calls/visits.

---

### 5. No Forecasting or Early Warnings
| Problem | Impact |
|---------|--------|
| The business operates reactively — problems are discovered when they've already happened | Stockouts, cash shortages, and client churn are always surprises |
| Seasonality is understood intuitively ("fishing season is October–March") but never quantified | Purchasing and staffing decisions are based on memory, not models |
| No alert system — critical events (stock about to run out, client about to churn, payment overdue) don't trigger notifications | The owner has to manually check everything, every day |

**Solution built:** AI forecasting with confidence ranges (lower bound, forecast, upper bound). Alert center grouped by type (Stock, Sales, Clients) with priority levels. Anomaly detection on the homepage that cross-references KPIs to flag contradictions automatically.

---

### 6. Decision Paralysis — Too Much Text, Not Enough Visuals
| Problem | Impact |
|---------|--------|
| Traditional reports are walls of numbers in spreadsheets | The owner says: "I don't read — reading is slow. I need charts where I can see the highs and lows and attack immediately" |
| No contextual explanation of what the numbers mean | Even when data exists, the team doesn't know what action to take |

**Solution built:** Every chart has an insight commentary box below it explaining the "so what" — patterns, risks, and recommended actions. Cross-links between related pages ("sales down → check inventory levels →"). KPIs are clickable and navigate to their detail page.

---

## Solution Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│  Bsale POS  │────▶│  Supabase    │────▶│  Next.js + Tremor│
│  (source)   │ ETL │  (PostgreSQL)│ API │  (Dashboard)     │
└─────────────┘     └──────────────┘     └──────────────────┘
                           │                      │
                    ┌──────┴──────┐         ┌─────┴─────┐
                    │ Edge Funcs  │         │  Vercel   │
                    │ (ETL, AI)   │         │  (Deploy) │
                    └─────────────┘         └───────────┘
```

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Data Source** | Bsale API | POS, invoicing, inventory, payments |
| **Database** | Supabase (PostgreSQL) | Star schema: dims + facts + materialized views |
| **ETL** | Supabase Edge Functions (Deno) | Incremental sync every 4h — products, sales, payments, returns |
| **Frontend** | Next.js 14 + Tremor + Tailwind | 20 pages, responsive, dark mode |
| **Hosting** | Vercel | Production deployment with instant rollbacks |
| **Auth** | Supabase Auth | Email/password, demo mode via env flag |
| **Analytics** | Vercel Analytics | Page views, top routes, traffic (enable in Vercel project → Analytics) |

---

## Modules

| Module | Pages | Key Features |
|--------|-------|-------------|
| **Homepage** | `/` | 4 clickable KPIs, sales trend, top products, alerts, anomaly detection, quick actions |
| **Sales** | `/ventas` | Daily/weekly/monthly trends, peak analysis, category breakdown |
| **Inventory** | `/inventario` | ABC analysis, turnover velocity, stock coverage, reorder suggestions |
| **Collections** | `/cobranza` | Aging buckets, recovery rates, overdue tracking |
| **Finance** | `/finanzas/*` | P&L overview, invoices, payments, bank reconciliation |
| **Cash Flow** | `/flujo-caja` | Projected inflows vs outflows, runway estimation |
| **Customers** | `/clientes` | RFM segmentation, lifetime value, churn risk |
| **Categories** | `/categorias` | Revenue by category, concentration analysis |
| **Sellers** | `/vendedores` | Rep performance, quota tracking, commission estimates |
| **Regions** | `/regiones` | Geographic revenue distribution |
| **Alerts** | `/alertas` | Grouped by type, priority-sorted, actionable |
| **Forecasts** | `/predicciones` | 30/60/90 day projections, confidence ranges |
| **Wholesale CRM** | `/wholesale` | Client board, pipeline, calendar, files, call log |
| **BI Agent** | `/agente` | Natural language → SQL via Claude Sonnet, real-time queries against Supabase PostgreSQL |

---

## BI Best Practices Implemented (22 of 26)

Based on the **2026 Dashboard Design Best Practices** checklist:

| # | Practice | Status | Implementation |
|---|----------|--------|---------------|
| 1 | Adaptive drill-down | ✅ | KPIs link to detail pages, charts have "View details →" |
| 3 | Refresh indicators | ✅ | Timestamp + green status dot in header |
| 4 | Cognitive load pacing | ✅ | 5-level hierarchy: KPIs → Trends → Rankings → Alerts → Actions |
| 5 | Progressive disclosure | ✅ | Expandable client cards, tabbed views |
| 6 | Benchmarks | ✅ | "vs prev" deltas on all KPIs |
| 7 | Connected metrics | ✅ | Cross-links between pages in insight boxes |
| 8 | Commentary blocks | ✅ | Insight boxes under every chart on every page |
| 10 | Prediction confidence | ✅ | Stacked bar chart with lower/forecast/upper bounds |
| 12 | Hide empty visuals | ✅ | Conditional rendering for zero-data states |
| 13 | Group anomalies | ✅ | Alerts grouped by type with counts |
| 14 | Time comparisons | ✅ | Period-over-period deltas on KPIs |
| 15 | Snapshot/live indicator | ✅ | DEMO badge when in demo mode |
| 16 | Consistent color | ✅ | Semantic colors: green=good, red=bad, amber=warning |
| 18 | Flag contradictions | ✅ | Anomaly Detection panel on homepage |
| 20 | Functional zones | ✅ | F-pattern layout: header → KPIs → charts → details → actions |
| 21 | Subtle animations | ✅ | Staggered slide-in animations, hover transitions |
| 22 | Hover previews | ✅ | Tooltips on all sidebar navigation items |
| 24 | Data lineage | ✅ | "Source: Bsale API" footer on every page |
| 26 | Prune unused visuals | ✅ | Removed break-even monitor per owner feedback |

---

## Quick Start

```bash
cd mi_spa_bi_system/dashboard
npm install
cp .env.example .env.local   # Add Supabase credentials
npm run dev                   # http://localhost:3000
```

### Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_DEMO_MODE=true
```

### Deploy
```bash
npx vercel --prod
```

---

## Roadmap

| Phase | Features | Status |
|-------|----------|--------|
| **v1** | Core dashboard, ETL, all analysis pages | ✅ Done |
| **v2** | Wholesale CRM, pipeline, calendar, best practices | ✅ Done |
| **v3** | Trello API sync (replace Trello entirely) | 🔜 Planned |
| **v4** | Role-based access (owner, seller, warehouse) | 🔜 Planned |
| **v5** | WhatsApp bot for field reps | 🔜 Planned |
| **v6** | Mobile-first PWA for warehouse scanning | 🔜 Planned |

---

*Built for Bluefishing.cl — wholesale fishing & outdoor equipment distribution.*
