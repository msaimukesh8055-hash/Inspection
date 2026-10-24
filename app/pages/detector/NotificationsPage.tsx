// app/pages/detector/NotificationsPage.tsx
// Detector: notices from the inspector, newest first and live. Opening one marks it read and goes to settlement.
import { Bell, CaretRight } from '@phosphor-icons/react';
import { useNavigate } from 'react-router';

import { useNotifications } from '@/app/hooks/useNotifications';
import { IconTile } from '@/components/IconTile';
import { LoadState } from '@/components/LoadState';
import { PageHeader } from '@/components/PageHeader';
import { formatDateTime } from '@/lib/format';
import { markRead } from '@/lib/notifications';
import type { AppNotification } from '@/lib/notifications';

function NotificationRow({ notification, onOpen }: { notification: AppNotification; onOpen: (n: AppNotification) => void }) {
  function handleClick() {
    onOpen(notification);
  }
  const unread = notification.readAt === null;
  return (
    <button
      type="button"
      onClick={handleClick}
      className="group grid w-full grid-cols-[12px_1fr_auto_auto] items-center gap-5 rounded-2xl border border-line bg-surface px-6 py-5 text-left transition-colors hover:border-line-strong hover:bg-raised"
    >
      <span className={`size-2.5 rounded-full ${unread ? 'bg-ink' : 'bg-transparent'}`} />
      <p className={`text-[16px] ${unread ? 'font-medium text-ink' : 'text-muted'}`}>{notification.message}</p>
      <span className="text-[13px] text-subtle">{formatDateTime(notification.createdAt)}</span>
      <CaretRight size={20} className="text-subtle transition-transform group-hover:translate-x-1 group-hover:text-ink" />
    </button>
  );
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const { notifications, unread, error, reload } = useNotifications('counter');

  function handleOpen(notification: AppNotification) {
    if (notification.readAt === null) void markRead(notification.id);
    if (notification.rentalId) navigate(`/detector/return/${notification.rentalId}/settle`);
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Detector"
        title="Notifications"
        subtitle={notifications ? (unread ? `${unread} unread from the inspector` : 'All caught up') : 'Loading…'}
      />
      {notifications === null ? (
        <LoadState error={error} onRetry={reload} />
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center gap-5 rounded-3xl border border-dashed border-line px-10 py-24 text-center">
          <IconTile size="lg">
            <Bell size={32} weight="duotone" />
          </IconTile>
          <div className="space-y-2">
            <p className="text-[20px] font-semibold">No notifications</p>
            <p className="text-muted">When the inspector confirms an order, it appears here straight away.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map(function renderNotification(notification) {
            return <NotificationRow key={notification.id} notification={notification} onOpen={handleOpen} />;
          })}
        </div>
      )}
    </div>
  );
}
