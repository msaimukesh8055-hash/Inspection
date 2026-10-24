// app/hooks/useNotifications.ts
// Notifications for one role, refreshed live whenever one is added or read.
import { useCallback, useEffect, useState } from 'react';

import { fetchNotifications, subscribeToNotifications } from '@/lib/notifications';
import type { AppNotification, Role } from '@/lib/notifications';

type NotificationsState = {
  notifications: AppNotification[] | null;
  unread: number;
  error: string | null;
  reload: () => void;
};

export function useNotifications(role: Role | null): NotificationsState {
  const [notifications, setNotifications] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    function loadNotifications() {
      if (!role) return;
      fetchNotifications(role)
        .then(setNotifications)
        .catch(function handleError(e: unknown) {
          setError(e instanceof Error ? e.message : String(e));
        });
    },
    [role],
  );

  useEffect(
    function watch() {
      if (!role) return undefined;
      load();
      return subscribeToNotifications(role, load);
    },
    [role, load],
  );

  function reload() {
    setError(null);
    load();
  }

  const unread = notifications?.filter((n) => n.readAt === null).length ?? 0;
  return { notifications, unread, error, reload };
}
