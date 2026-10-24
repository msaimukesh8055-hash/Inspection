// components/AppShell.tsx
// Top bar (wordmark, current role) above a centred page column.
import { MagnifyingGlass, Wrench } from '@phosphor-icons/react';
import { Link, Outlet, useLocation } from 'react-router';

import { Logo } from '@/components/Logo';

function RolePill({ role }: { role: 'detector' | 'inspector' }) {
  const Icon = role === 'detector' ? MagnifyingGlass : Wrench;
  return (
    <span className="flex h-10 items-center gap-2 rounded-full border border-line bg-surface pl-3 pr-4 text-[14px] font-medium">
      <Icon size={18} weight="duotone" />
      {role === 'detector' ? 'Detector' : 'Inspector'}
    </span>
  );
}

export function AppShell() {
  const { pathname } = useLocation();
  const role = pathname.startsWith('/detector') ? 'detector' : pathname.startsWith('/inspector') ? 'inspector' : null;

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-10 border-b border-line bg-black/85 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between px-10">
          <Logo />
          {role && (
            <div className="flex items-center gap-2">
              <RolePill role={role} />
              <Link
                to="/"
                className="flex h-10 items-center rounded-full px-4 text-[14px] text-muted transition-colors hover:bg-hover hover:text-ink"
              >
                Switch role
              </Link>
            </div>
          )}
        </div>
      </nav>
      <main className="mx-auto max-w-[1200px] px-10 pb-16 pt-10">
        <Outlet />
      </main>
    </div>
  );
}
