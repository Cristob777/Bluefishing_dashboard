'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import PageHeader from '@/components/PageHeader';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();

  const isLoginPage = pathname === '/login';
  const isHome = pathname === '/';

  if (isLoginPage || !user) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen min-h-[100dvh]">
      <Sidebar />
      <main className="flex-1 ml-0 lg:ml-64 min-h-screen min-h-[100dvh] pt-16 lg:pt-0 overflow-x-hidden">
        {!isHome && <PageHeader />}
        {children}
      </main>
    </div>
  );
}
