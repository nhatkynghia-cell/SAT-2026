'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';

/** Route chạy full-bleed, KHÔNG sidebar / KHÔNG padding khung (vd trang đăng nhập). */
const FULL_BLEED_ROUTES = ['/login'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (FULL_BLEED_ROUTES.includes(pathname)) {
    return <>{children}</>;
  }

  return (
    <>
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1200px] mx-auto p-8">{children}</div>
      </main>
    </>
  );
}
