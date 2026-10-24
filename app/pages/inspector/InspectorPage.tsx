// app/pages/inspector/InspectorPage.tsx
// Inspector: open diagnostic orders, newest first. Refreshes live when a new order is raised.
import { CaretRight, ClipboardText, Moped, Motorcycle } from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';

import { IconTile } from '@/components/IconTile';
import { LoadState } from '@/components/LoadState';
import { PageHeader } from '@/components/PageHeader';
import { ROUTE_REASON_LABELS } from '@/lib/assessments';
import { formatDateTime, formatInr } from '@/lib/format';
import { subscribeToNotifications } from '@/lib/notifications';
import { fetchOpenOrders } from '@/lib/orders';
import type { QueuedOrder } from '@/lib/orders';

const PRIORITY_STYLES = {
  high: 'border-path-b/60 text-path-b',
  normal: 'border-line-strong text-muted',
  low: 'border-line text-subtle',
} as const;

function OrderRow({ order }: { order: QueuedOrder }) {
  const Icon = order.model === 'TVS Radeon' ? Motorcycle : Moped;
  return (
    <Link
      to={`/inspector/orders/${order.id}`}
      className="group grid grid-cols-[auto_1.2fr_1.6fr_auto_auto] items-center gap-8 rounded-2xl border border-line bg-surface px-6 py-5 transition-colors hover:border-line-strong hover:bg-raised"
    >
      <IconTile>
        <Icon size={26} weight="duotone" />
      </IconTile>
      <div>
        <p className="text-[18px] font-semibold">{order.model}</p>
        <p className="text-[14px] text-muted">
          {order.regNo} · {order.riderName} · {formatDateTime(order.createdAt)}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {order.reasons.map(function renderReason(reason) {
          return (
            <span key={reason} className="rounded-full border border-line-strong px-3 py-1 text-[13px] text-muted">
              {ROUTE_REASON_LABELS[reason] ?? reason}
            </span>
          );
        })}
      </div>
      <div className="text-right">
        <p className="text-[13px] text-subtle">AI estimate</p>
        <p className="text-[18px] font-semibold">{formatInr(order.provisionalTotalInr)}</p>
      </div>
      <div className="flex items-center gap-4">
        <span className={`rounded-full border px-3 py-1 text-[13px] capitalize ${PRIORITY_STYLES[order.priority]}`}>{order.priority}</span>
        <CaretRight size={22} className="text-subtle transition-transform group-hover:translate-x-1 group-hover:text-ink" />
      </div>
    </Link>
  );
}

export function InspectorPage() {
  const [orders, setOrders] = useState<QueuedOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(function loadOrders() {
    fetchOpenOrders()
      .then(setOrders)
      .catch(function handleError(e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      });
  }, []);

  useEffect(
    function watch() {
      load();
      return subscribeToNotifications('inspector', load);
    },
    [load],
  );

  function handleRetry() {
    setError(null);
    load();
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Inspector"
        title="Diagnostic orders"
        subtitle={orders ? `${orders.length} open order${orders.length === 1 ? '' : 's'} waiting for inspection` : 'Loading orders…'}
      />
      {orders === null ? (
        <LoadState error={error} onRetry={handleRetry} />
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center gap-5 rounded-3xl border border-dashed border-line px-10 py-24 text-center">
          <IconTile size="lg">
            <ClipboardText size={32} weight="duotone" />
          </IconTile>
          <div className="space-y-2">
            <p className="text-[20px] font-semibold">No open orders</p>
            <p className="text-muted">Returns routed to Path B appear here as soon as they are raised.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(function renderOrder(order) {
            return <OrderRow key={order.id} order={order} />;
          })}
        </div>
      )}
    </div>
  );
}
