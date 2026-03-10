'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { 
  LayoutDashboard, 
  Package, 
  TrendingUp, 
  Users, 
  Receipt, 
  Bell, 
  Globe, 
  Sparkles,
  Layers,
  BarChart3,
  Wallet,
  Database,
  Menu,
  X,
  ChevronRight,
  Store,
  Settings,
  HelpCircle,
  LogOut,
  UserCog,
  Phone
} from 'lucide-react';

// ============================================================================
// NAVIGATION CONFIG
// ============================================================================

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: string | number;
  badgeColor?: 'red' | 'green' | 'blue' | 'amber';
  title?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'Main',
    items: [
      { href: '/', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, title: 'KPIs, sales trends, top products overview' },
      { href: '/ventas', label: 'Sales', icon: <TrendingUp className="w-5 h-5" />, title: 'Revenue analysis, daily trends, top products' },
      { href: '/vendedores', label: 'Sales Reps', icon: <UserCog className="w-5 h-5" />, title: 'Sales rep performance metrics' },
      { href: '/wholesale', label: 'Wholesale CRM', icon: <Phone className="w-5 h-5" />, badge: 'New', badgeColor: 'green' as const, title: 'Client tracking, pipeline, call log' },
    ]
  },
  {
    title: 'Analytics',
    items: [
      { href: '/categorias', label: 'Categories', icon: <Layers className="w-5 h-5" />, title: 'Revenue by product category' },
      { href: '/inventario', label: 'Inventory', icon: <Package className="w-5 h-5" />, title: 'ABC analysis, stock levels, turnover rates' },
      { href: '/clientes', label: 'Customers RFM', icon: <Users className="w-5 h-5" />, title: 'RFM segmentation, top clients' },
    ]
  },
  {
    title: 'Finance',
    items: [
      { href: '/finanzas', label: 'Financial Center', icon: <Wallet className="w-5 h-5" />, badge: 'New', badgeColor: 'green', title: 'Financial health, credit status' },
      { href: '/finanzas/facturas', label: 'Invoices', icon: <Receipt className="w-5 h-5" />, title: 'Invoice tracking and status' },
      { href: '/finanzas/pagos', label: 'Payments', icon: <Receipt className="w-5 h-5" />, title: 'Payment history and allocation' },
      { href: '/finanzas/conciliacion', label: 'Reconciliation', icon: <Receipt className="w-5 h-5" />, title: 'Payment-invoice matching' },
    ]
  },
  {
    title: 'Geography',
    items: [
      { href: '/regiones', label: 'Regions', icon: <Globe className="w-5 h-5" />, title: 'Geographic performance analysis' },
    ]
  },
  {
    title: 'Intelligence',
    items: [
      { href: '/predicciones', label: 'ML Forecast', icon: <BarChart3 className="w-5 h-5" />, badge: 'AI', badgeColor: 'blue', title: 'ML forecasts, confidence ranges' },
      { href: '/agente', label: 'BI Agent', icon: <Sparkles className="w-5 h-5" />, title: 'AI-powered business analysis chat' },
      { href: '/alertas', label: 'Alerts', icon: <Bell className="w-5 h-5" />, title: 'Critical alerts, stock breaks, anomalies' },
    ]
  },
  {
    title: 'System',
    items: [
      { href: '/flujo-caja', label: 'Cash Flow', icon: <Wallet className="w-5 h-5" />, title: 'Income vs expenses, daily flow' },
      { href: '/etl', label: 'ETL / Sync', icon: <Database className="w-5 h-5" />, title: 'Data pipeline health and sync status' },
    ]
  }
];

// ============================================================================
// SIDEBAR COMPONENT
// ============================================================================

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile Header Bar */}
      <div className="fixed top-0 left-0 right-0 h-14 z-40 lg:hidden 
                      bg-white/95 dark:bg-slate-900/95 backdrop-blur-md
                      border-b border-slate-200 dark:border-slate-800
                      flex items-center justify-between px-4 safe-area-inset">
        {/* Menu Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 
                     transition-all active:scale-95"
          aria-label="Toggle menu"
        >
          {isOpen ? (
            <X className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          ) : (
            <Menu className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          )}
        </button>

        {/* Logo Center */}
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 
                          flex items-center justify-center shadow-md">
            <Store className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-slate-800 dark:text-white text-sm">Bluefishing BI</span>
        </Link>

        {/* Spacer for symmetry */}
        <div className="w-9" />
      </div>

      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-screen w-64 z-40
          bg-white dark:bg-slate-900 
          border-r border-slate-200 dark:border-slate-800
          transform transition-transform duration-300 ease-out
          lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          flex flex-col
        `}
      >
        {/* Logo Section */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 
                              flex items-center justify-center shadow-lg shadow-indigo-500/25
                              group-hover:scale-110 transition-transform">
                <Store className="w-5 h-5 text-white" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full 
                              border-2 border-white dark:border-slate-900" />
            </div>
            <div>
              <h1 className="font-bold text-slate-800 dark:text-white">Bluefishing</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Business Intelligence</p>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-6">
          {navSections.map((section) => (
            <div key={section.title}>
              <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 px-3">
                {section.title}
              </h3>
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  const hovered = hoveredItem === item.href;
                  
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={item.title}
                        onMouseEnter={() => setHoveredItem(item.href)}
                        onMouseLeave={() => setHoveredItem(null)}
                        className={`
                          flex items-center gap-3 px-3 py-2.5 rounded-xl
                          transition-all duration-200
                          ${active 
                            ? 'bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/50 dark:to-purple-950/50 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          }
                        `}
                      >
                        {/* Icon */}
                        <span className={`
                          transition-all duration-200
                          ${active ? 'text-indigo-600 dark:text-indigo-400' : ''}
                          ${hovered && !active ? 'scale-110' : ''}
                        `}>
                          {item.icon}
                        </span>
                        
                        {/* Label */}
                        <span className={`flex-1 text-sm font-medium ${active ? 'font-semibold' : ''}`}>
                          {item.label}
                        </span>
                        
                        {/* Badge */}
                        {item.badge && (
                          <span className={`
                            px-2 py-0.5 text-[10px] font-bold rounded-full
                            ${item.badgeColor === 'red' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : ''}
                            ${item.badgeColor === 'green' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : ''}
                            ${item.badgeColor === 'blue' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : ''}
                            ${item.badgeColor === 'amber' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' : ''}
                          `}>
                            {item.badge}
                          </span>
                        )}
                        
                        {/* Active indicator */}
                        {active && (
                          <ChevronRight className="w-4 h-4 text-indigo-400" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* User + Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
          {user && (
            <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 
                              flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0">
                {user.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{user.name}</p>
                <p className="text-[10px] text-slate-400 truncate">{user.role.toUpperCase()}</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button className="flex-1 flex items-center justify-center gap-2 p-2 rounded-lg
                               text-slate-500 hover:text-slate-700 hover:bg-slate-50 
                               dark:hover:text-slate-300 dark:hover:bg-slate-800
                               transition-all text-sm"
                    title="Settings">
              <Settings className="w-4 h-4" />
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 p-2 rounded-lg
                               text-slate-500 hover:text-slate-700 hover:bg-slate-50 
                               dark:hover:text-slate-300 dark:hover:bg-slate-800
                               transition-all text-sm"
                    title="Help">
              <HelpCircle className="w-4 h-4" />
            </button>
            <button 
              onClick={() => { logout(); router.replace('/login'); }}
              className="flex-1 flex items-center justify-center gap-2 p-2 rounded-lg
                         text-slate-500 hover:text-red-600 hover:bg-red-50 
                         dark:hover:text-red-400 dark:hover:bg-red-950/30
                         transition-all text-sm"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          <p className="text-center text-[10px] text-slate-400">
            Bluefishing BI v2.0 • © 2026
          </p>
        </div>
      </aside>
    </>
  );
}
