// components/AppShell.tsx
// Top bar (wordmark, live notification bell, current role, dashboard link) above a centred page column.
import { Bell, ChartBar, MagnifyingGlass, Wrench } from '@phosphor-icons/react';
import { Link, Outlet, useLocation } from 'react-router';

import { useNotifications } from '@/app/hooks/useNotifications';
import { Logo } from '@/components/Logo';

type ShellRole = 'detector' | 'inspector';

function RolePill({ role }: { role: ShellRole }) {
  const Icon = role === 'detector' ? MagnifyingGlass : Wrench;
  return (
    <span className="flex h-10 items-center gap-2 rounded-full border border-line bg-surface pl-3 pr-4 text-[14px] font-medium">
      <Icon size={18} weight="duotone" />
      {role === 'detector' ? 'Detector' : 'Inspector'}
    </span>
  );
}

/** Detector notices come from the inspector; inspector notices are new orders, so the bell opens the queue. */
function NotificationBell({ role }: { role: ShellRole }) {
  const { unread } = useNotifications(role === 'detector' ? 'counter' : 'inspector');
  const to = role === 'detector' ? '/detector/notifications' : '/inspector';
  return (
    <Link
      to={to}
      aria-label={`${unread} unread notifications`}
      className="relative grid size-10 place-items-center rounded-full text-muted transition-colors hover:bg-hover hover:text-ink"
    >
      <Bell size={22} weight="duotone" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[11px] font-bold text-black">
          {unread}
        </span>
      )}
    </Link>
  );
}

export function AppShell() {
  const { pathname } = useLocation();
  const role: ShellRole | null = pathname.startsWith('/detector') ? 'detector' : pathname.startsWith('/inspector') ? 'inspector' : null;
  const onDashboard = pathname.startsWith('/dashboard');

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-10 border-b border-line bg-black/85 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between px-10">
          <Logo />
          <div className="flex items-center gap-2">
            {role && <NotificationBell key={role} role={role} />}
            {role && <RolePill role={role} />}
            <Link
              to="/dashboard"
              aria-current={onDashboard ? 'page' : undefined}
              className={`flex h-10 items-center gap-2 rounded-full px-4 text-[14px] transition-colors hover:bg-hover hover:text-ink ${
                onDashboard ? 'border border-line bg-surface font-medium text-ink' : 'text-muted'
              }`}
            >
              <ChartBar size={18} weight="duotone" />
              Dashboard
            </Link>
            {(role || onDashboard) && (
              <Link
                to="/"
                className="flex h-10 items-center rounded-full px-4 text-[14px] text-muted transition-colors hover:bg-hover hover:text-ink"
              >
                Switch role
              </Link>
            )}
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-[1200px] px-10 pb-10 pt-10">
        <Outlet />
      </main>
    </div>
  );
}
