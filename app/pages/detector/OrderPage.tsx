// app/pages/detector/OrderPage.tsx
// Return step 5, Path B: the diagnostic order raised for the inspector, the provisional hold and the rider timeline.
import { ChatText, Check, ClipboardText } from '@phosphor-icons/react';
import { Navigate, useParams } from 'react-router';

import { useAssessment } from '@/app/hooks/useAssessment';
import { useRentalData } from '@/app/hooks/useRentalData';
import { LinkButton } from '@/components/Button';
import { LoadState } from '@/components/LoadState';
import { ReturnHeader } from '@/components/ReturnHeader';
import { ROUTE_REASON_LABELS } from '@/lib/assessments';
import type { StatusEvent } from '@/lib/assessments';
import { DEPOSIT_INR } from '@/lib/constants';
import { formatDateTime, formatInr } from '@/lib/format';

/** Path B timeline the rider sees, in order. */
const PATH_B_STEPS = [
  { status: 'returned', label: 'Returned' },
  { status: 'assessing', label: 'Assessing' },
  { status: 'order_raised', label: 'Order raised' },
  { status: 'at_refurb', label: 'At refurb' },
  { status: 'inspected', label: 'Inspected' },
  { status: 'counter_notified', label: 'Counter notified' },
  { status: 'settled', label: 'Settled' },
] as const;

function Timeline({ events }: { events: StatusEvent[] }) {
  return (
    <ol className="space-y-2">
      {PATH_B_STEPS.map(function renderStep(step) {
        const event = events.find((e) => e.status === step.status);
        return (
          <li key={step.status} className="flex items-center gap-3">
            <span
              className={`grid size-6 place-items-center rounded-full ${event ? 'bg-ink text-black' : 'border border-line-strong'}`}
            >
              {event && <Check size={13} weight="bold" />}
            </span>
            <span className={`flex-1 text-[15px] ${event ? 'text-ink' : 'text-subtle'}`}>{step.label}</span>
            {event && <span className="text-[13px] text-subtle">{formatDateTime(event.at)}</span>}
          </li>
        );
      })}
    </ol>
  );
}

const PRIORITY_LABELS = { low: 'Low', normal: 'Normal', high: 'High' } as const;

export function OrderPage() {
  const { rentalId = '' } = useParams();
  const rentalData = useRentalData(rentalId, false);
  const { assessment, error, reload } = useAssessment(rentalId);

  function handleRetry() {
    rentalData.retry();
    reload();
  }

  const data = rentalData.data;
  if (!data || assessment === undefined) return <LoadState error={rentalData.error ?? error} onRetry={handleRetry} />;
  if (!assessment || assessment.path !== 'B' || !assessment.order) {
    return <Navigate to={`/detector/return/${rentalId}/assessment`} replace />;
  }

  const order = assessment.order;

  return (
    <div className="space-y-8">
      <ReturnHeader
        rental={data.rental}
        step={5}
        title="Sent to the inspector"
        subtitle={`Diagnostic order raised · ${PRIORITY_LABELS[order.priority]} priority. The inspector confirms the final amount.`}
      />

      <div className="grid grid-cols-[1fr_360px] gap-8">
        <div className="space-y-4">
          <div className="space-y-3 rounded-2xl border border-path-b/40 bg-path-b/5 p-5">
            <div className="flex items-center gap-3">
              <ClipboardText size={26} weight="duotone" className="text-path-b" />
              <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-path-b">Diagnostic order</p>
            </div>
            <p className="text-[16px] leading-relaxed">{order.summary}</p>
            <div className="flex flex-wrap gap-2">
              {assessment.routeReasons.map(function renderReason(reason) {
                return (
                  <span key={reason} className="rounded-full border border-line-strong px-3 py-1 text-[13px] text-muted">
                    {ROUTE_REASON_LABELS[reason] ?? reason}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 rounded-2xl border border-line bg-surface p-5">
              <p className="text-[14px] text-muted">Provisional estimate</p>
              <p className="text-[26px] font-semibold tracking-tight">{formatInr(order.provisionalTotalInr)}</p>
            </div>
            <div className="space-y-1 rounded-2xl border border-line bg-surface p-5">
              <p className="text-[14px] text-muted">Held from the {formatInr(DEPOSIT_INR)} deposit</p>
              <p className="text-[26px] font-semibold tracking-tight">{formatInr(order.heldInr)}</p>
            </div>
          </div>

          {assessment.riderMessage && (
            <div className="flex gap-4 rounded-2xl border border-line bg-surface p-5">
              <ChatText size={24} weight="duotone" className="shrink-0 text-subtle" />
              <div className="space-y-1">
                <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-subtle">Message to the rider</p>
                <p className="text-[15px] leading-relaxed">{assessment.riderMessage}</p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-2xl border border-line bg-surface p-5">
          <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-subtle">Rider timeline</p>
          <Timeline events={assessment.events} />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-line pt-6">
        <LinkButton to={`/detector/return/${rentalId}/assessment`} variant="secondary">
          Back to assessment
        </LinkButton>
        <LinkButton to="/detector">Back to rentals</LinkButton>
      </div>
    </div>
  );
}
