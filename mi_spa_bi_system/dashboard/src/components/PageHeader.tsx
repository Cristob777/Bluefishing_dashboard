'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, LayoutDashboard, ExternalLink } from 'lucide-react';
import { getPageNav } from '@/lib/page-nav';

export default function PageHeader() {
  const pathname = usePathname();
  const nav = getPageNav(pathname || '');

  if (!nav || nav.breadcrumbs.length === 0) return null;

  return (
    <header className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-4 pb-3 mb-4 sm:mb-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mb-2 flex-wrap">
        <Link href="/" className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-300 transition-colors" title="Dashboard">
          <LayoutDashboard className="w-3.5 h-3.5" />
          <span>Home</span>
        </Link>
        {nav.breadcrumbs.map((item, i) => (
          <span key={item.href} className="flex items-center gap-1">
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 flex-shrink-0" />
            {i === nav.breadcrumbs.length - 1 ? (
              <span className="font-medium text-slate-700 dark:text-slate-300">{item.label}</span>
            ) : (
              <Link href={item.href} className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                {item.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            {nav.title}
          </h1>
          {nav.subtitle && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{nav.subtitle}</p>
          )}
        </div>

        {/* Quick links — jump to related views */}
        {nav.quickLinks && nav.quickLinks.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider hidden sm:inline">
              Go to
            </span>
            {nav.quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                {link.label}
                <ExternalLink className="w-3 h-3 opacity-60" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
