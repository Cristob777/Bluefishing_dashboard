/**
 * Central config for page breadcrumbs and quick links.
 * Makes every view easy to navigate: breadcrumb + sibling links.
 */

export interface BreadcrumbItem {
  label: string;
  href: string;
}

export interface QuickLinkItem {
  label: string;
  href: string;
}

export interface PageNav {
  breadcrumbs: BreadcrumbItem[];
  title: string;
  subtitle?: string;
  quickLinks?: QuickLinkItem[];
}

const PATH_CONFIG: Record<string, PageNav> = {
  '/': { breadcrumbs: [], title: 'Dashboard', subtitle: 'Bluefishing BI' },

  '/ventas': {
    breadcrumbs: [{ label: 'Main', href: '/' }, { label: 'Sales', href: '/ventas' }],
    title: 'Sales Analysis',
    subtitle: 'Performance & trends',
    quickLinks: [
      { label: 'Categories', href: '/categorias' },
      { label: 'Inventory', href: '/inventario' },
      { label: 'Top products', href: '/' },
    ],
  },
  '/vendedores': {
    breadcrumbs: [{ label: 'Main', href: '/' }, { label: 'Sales Reps', href: '/vendedores' }],
    title: 'Sales Reps',
    subtitle: 'Performance & quotas',
    quickLinks: [{ label: 'Sales', href: '/ventas' }, { label: 'Customers', href: '/clientes' }],
  },
  '/wholesale': {
    breadcrumbs: [{ label: 'Main', href: '/' }, { label: 'Wholesale CRM', href: '/wholesale' }],
    title: 'Wholesale CRM',
    subtitle: 'Pipeline, contacts & calendar',
    quickLinks: [{ label: 'Customers RFM', href: '/clientes' }, { label: 'Collections', href: '/cobranza' }],
  },

  '/categorias': {
    breadcrumbs: [{ label: 'Analytics', href: '/categorias' }, { label: 'Categories', href: '/categorias' }],
    title: 'Categories',
    subtitle: 'Revenue by category',
    quickLinks: [
      { label: 'Sales', href: '/ventas' },
      { label: 'Inventory', href: '/inventario' },
      { label: 'Customers', href: '/clientes' },
    ],
  },
  '/inventario': {
    breadcrumbs: [{ label: 'Analytics', href: '/inventario' }, { label: 'Inventory', href: '/inventario' }],
    title: 'Inventory',
    subtitle: 'ABC analysis & turnover',
    quickLinks: [
      { label: 'Sales', href: '/ventas' },
      { label: 'Categories', href: '/categorias' },
      { label: 'Alerts', href: '/alertas' },
    ],
  },
  '/clientes': {
    breadcrumbs: [{ label: 'Analytics', href: '/clientes' }, { label: 'Customers RFM', href: '/clientes' }],
    title: 'Customers',
    subtitle: 'RFM segmentation',
    quickLinks: [
      { label: 'Sales', href: '/ventas' },
      { label: 'Wholesale CRM', href: '/wholesale' },
      { label: 'Collections', href: '/cobranza' },
    ],
  },

  '/finanzas': {
    breadcrumbs: [{ label: 'Finance', href: '/finanzas' }, { label: 'Overview', href: '/finanzas' }],
    title: 'Financial Center',
    subtitle: 'Credit & aging',
    quickLinks: [
      { label: 'Invoices', href: '/finanzas/facturas' },
      { label: 'Payments', href: '/finanzas/pagos' },
      { label: 'Reconciliation', href: '/finanzas/conciliacion' },
    ],
  },
  '/finanzas/facturas': {
    breadcrumbs: [{ label: 'Finance', href: '/finanzas' }, { label: 'Invoices', href: '/finanzas/facturas' }],
    title: 'Invoices',
    subtitle: 'Tracking & status',
    quickLinks: [
      { label: 'Overview', href: '/finanzas' },
      { label: 'Payments', href: '/finanzas/pagos' },
      { label: 'Reconciliation', href: '/finanzas/conciliacion' },
    ],
  },
  '/finanzas/pagos': {
    breadcrumbs: [{ label: 'Finance', href: '/finanzas' }, { label: 'Payments', href: '/finanzas/pagos' }],
    title: 'Payments',
    subtitle: 'History & allocation',
    quickLinks: [
      { label: 'Overview', href: '/finanzas' },
      { label: 'Invoices', href: '/finanzas/facturas' },
      { label: 'Reconciliation', href: '/finanzas/conciliacion' },
    ],
  },
  '/finanzas/conciliacion': {
    breadcrumbs: [{ label: 'Finance', href: '/finanzas' }, { label: 'Reconciliation', href: '/finanzas/conciliacion' }],
    title: 'Reconciliation',
    subtitle: 'Payment-invoice matching',
    quickLinks: [
      { label: 'Overview', href: '/finanzas' },
      { label: 'Invoices', href: '/finanzas/facturas' },
      { label: 'Payments', href: '/finanzas/pagos' },
    ],
  },
  '/finanzas/clientes': {
    breadcrumbs: [{ label: 'Finance', href: '/finanzas' }, { label: 'Clients', href: '/finanzas/clientes' }],
    title: 'Finance — Clients',
    subtitle: 'Credit by client',
    quickLinks: [{ label: 'Overview', href: '/finanzas' }, { label: 'Invoices', href: '/finanzas/facturas' }],
  },

  '/regiones': {
    breadcrumbs: [{ label: 'Geography', href: '/regiones' }, { label: 'Regions', href: '/regiones' }],
    title: 'Regions',
    subtitle: 'Geographic performance',
    quickLinks: [{ label: 'Customers', href: '/clientes' }, { label: 'Wholesale CRM', href: '/wholesale' }],
  },

  '/predicciones': {
    breadcrumbs: [{ label: 'Intelligence', href: '/predicciones' }, { label: 'ML Forecast', href: '/predicciones' }],
    title: 'Forecast',
    subtitle: '30/60/90 day projections',
    quickLinks: [
      { label: 'Sales', href: '/ventas' },
      { label: 'Inventory', href: '/inventario' },
      { label: 'Alerts', href: '/alertas' },
    ],
  },
  '/agente': {
    breadcrumbs: [{ label: 'Intelligence', href: '/agente' }, { label: 'BI Agent', href: '/agente' }],
    title: 'BI Agent',
    subtitle: 'Ask in natural language',
    quickLinks: [{ label: 'Forecast', href: '/predicciones' }, { label: 'Alerts', href: '/alertas' }],
  },
  '/alertas': {
    breadcrumbs: [{ label: 'Intelligence', href: '/alertas' }, { label: 'Alerts', href: '/alertas' }],
    title: 'Alerts',
    subtitle: 'Stock, sales & risk',
    quickLinks: [
      { label: 'Inventory', href: '/inventario' },
      { label: 'Collections', href: '/cobranza' },
      { label: 'Forecast', href: '/predicciones' },
    ],
  },

  '/flujo-caja': {
    breadcrumbs: [{ label: 'System', href: '/flujo-caja' }, { label: 'Cash Flow', href: '/flujo-caja' }],
    title: 'Cash Flow',
    subtitle: 'Inflows vs outflows',
    quickLinks: [{ label: 'Finance', href: '/finanzas' }, { label: 'Collections', href: '/cobranza' }],
  },
  '/etl': {
    breadcrumbs: [{ label: 'System', href: '/etl' }, { label: 'ETL / Sync', href: '/etl' }],
    title: 'ETL & Sync',
    subtitle: 'Data pipeline health',
    quickLinks: [{ label: 'Dashboard', href: '/' }, { label: 'Alerts', href: '/alertas' }],
  },

  '/cobranza': {
    breadcrumbs: [{ label: 'Finance', href: '/finanzas' }, { label: 'Collections', href: '/cobranza' }],
    title: 'Collections',
    subtitle: 'Aging & recovery',
    quickLinks: [
      { label: 'Financial Center', href: '/finanzas' },
      { label: 'Cash Flow', href: '/flujo-caja' },
      { label: 'Customers', href: '/clientes' },
    ],
  },
};

export function getPageNav(pathname: string): PageNav | null {
  if (pathname === '/login') return null;
  const exact = PATH_CONFIG[pathname];
  if (exact) return exact;
  return PATH_CONFIG[pathname.replace(/\/$/, '')] ?? null;
}
