// components/RouteBadge.tsx
// Path A (green, bill at the counter) or Path B (amber, inspector), with the router's reasons.
import { Storefront, UserFocus } from '@phosphor-icons/react';

import { ROUTE_REASON_LABELS } from '@/lib/assessments';

type RouteBadgeProps = {
  path: 'A' | 'B';
  reasons: string[];
};

export function RouteBadge({ path, reasons }: RouteBadgeProps) {
  const isA = path === 'A';
  return (
    <div className={`space-y-3 rounded-2xl border p-5 ${isA ? 'border-path-a/40 bg-path-a/5' : 'border-path-b/40 bg-path-b/5'}`}>
      <div className="flex items-center gap-3">
        <span className={isA ? 'text-path-a' : 'text-path-b'}>
          {isA ? <Storefront size={28} weight="duotone" /> : <UserFocus size={28} weight="duotone" />}
        </span>
        <div>
          <p className={`text-[13px] font-semibold uppercase tracking-[0.14em] ${isA ? 'text-path-a' : 'text-path-b'}`}>Path {path}</p>
          <p className="text-[17px] font-semibold">{isA ? 'Bill at the counter' : 'Send to the inspector'}</p>
        </div>
      </div>
      {reasons.length > 0 ? (
        <ul className="space-y-1 text-[14px] text-muted">
          {reasons.map(function renderReason(reason) {
            return <li key={reason}>• {ROUTE_REASON_LABELS[reason] ?? reason}</li>;
          })}
        </ul>
      ) : (
        <p className="text-[14px] text-muted">No routing rule fired: small, clear and confident.</p>
      )}
    </div>
  );
}
