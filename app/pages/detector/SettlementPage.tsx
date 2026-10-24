// app/pages/detector/SettlementPage.tsx
// Path B settlement after the inspector confirms: estimate vs final, what the inspector changed,
// and the deposit maths ("Collect ₹X more" above ₹2,000). "Mark settled" closes the return.
import { CheckCircle, CircleNotch, NotePencil, PencilSimpleLine, PlusCircle } from '@phosphor-icons/react';
import { useState } from 'react';
import { Navigate, useParams } from 'react-router';

import { useAssessment } from '@/app/hooks/useAssessment';
import { useRentalData } from '@/app/hooks/useRentalData';
import { Button, LinkButton } from '@/components/Button';
import { DepositCard } from '@/components/DepositCard';
import { LoadState } from '@/components/LoadState';
import { ReturnHeader } from '@/components/ReturnHeader';
import { settleReturn } from '@/lib/assessments';
import type { LineItem } from '@/lib/assessments';
import { formatInr } from '@/lib/format';
import { settle } from '@/lib/settlement';

function ChangeRow({ line }: { line: LineItem }) {
  const final = line.finalInr ?? line.totalInr;
  const added = line.source === 'inspector_added';
  return (
    <li className="flex items-center gap-3 text-[15px]">
      {added ? (
        <PlusCircle size={20} weight="duotone" className="shrink-0 text-path-b" />
      ) : (
        <PencilSimpleLine size={20} weight="duotone" className="shrink-0 text-path-b" />
      )}
      <span className="flex-1">
        {added ? 'Added' : 'Adjusted'}: {line.description}
      </span>
      <span className="text-muted">{added ? formatInr(final) : `${formatInr(line.totalInr)} → ${formatInr(final)}`}</span>
    </li>
  );
}

export function SettlementPage() {
  const { rentalId = '' } = useParams();
  const rentalData = useRentalData(rentalId, false);
  const { assessment, error, reload } = useAssessment(rentalId);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function handleRetry() {
    rentalData.retry();
    reload();
  }

  const data = rentalData.data;
  if (!data || assessment === undefined) return <LoadState error={rentalData.error ?? error} onRetry={handleRetry} />;
  const order = assessment?.order;
  if (!assessment || assessment.path !== 'B' || !order || order.finalTotalInr === null) {
    return <Navigate to={`/detector/return/${rentalId}/assessment`} replace />;
  }

  const current = assessment;
  const finalInr = order.finalTotalInr;
  const difference = finalInr - order.provisionalTotalInr;
  const settlement = settle(finalInr);
  const settled = current.status === 'settled';
  const changes = current.lines.filter((l) => l.source === 'inspector_added' || (l.finalInr !== null && l.finalInr !== l.totalInr));

  async function markSettled() {
    setSaving(true);
    setSaveError(null);
    try {
      await settleReturn(current.id, 'settle_order');
      reload();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function handleSettle() {
    void markSettled();
  }

  const differenceText = difference === 0 ? 'Same as the estimate' : `${difference > 0 ? '+' : '−'}${formatInr(Math.abs(difference))} vs estimate`;

  return (
    <div className="space-y-8">
      <ReturnHeader
        rental={data.rental}
        step={5}
        title={`Settle · ${formatInr(finalInr)}`}
        subtitle={settled ? 'Settled. The return is closed.' : 'The inspector confirmed the final amount. Settle the deposit with the rider.'}
      />

      <div className="grid grid-cols-[1fr_380px] gap-8">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1 rounded-2xl border border-line bg-surface p-5">
              <p className="text-[14px] text-muted">AI estimate</p>
              <p className="text-[26px] font-semibold tracking-tight">{formatInr(order.provisionalTotalInr)}</p>
            </div>
            <div className="space-y-1 rounded-2xl border border-line bg-surface p-5">
              <p className="text-[14px] text-muted">Inspector final</p>
              <p className="text-[26px] font-semibold tracking-tight">{formatInr(finalInr)}</p>
            </div>
            <div className="space-y-1 rounded-2xl border border-line bg-surface p-5">
              <p className="text-[14px] text-muted">Difference</p>
              <p className={`text-[20px] font-semibold leading-[39px] ${difference === 0 ? '' : 'text-path-b'}`}>{differenceText}</p>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-line bg-surface p-6">
            <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-subtle">What the inspector changed</p>
            {changes.length === 0 ? (
              <p className="text-[15px] text-muted">Approved every AI line as estimated.</p>
            ) : (
              <ul className="space-y-3">
                {changes.map(function renderChange(line) {
                  return <ChangeRow key={line.id} line={line} />;
                })}
              </ul>
            )}
            {order.inspectorNotes && (
              <div className="flex gap-3 border-t border-line pt-4 text-[15px]">
                <NotePencil size={20} weight="duotone" className="shrink-0 text-subtle" />
                <p className="text-muted">{order.inspectorNotes}</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <DepositCard chargedInr={finalInr} settlement={settlement} title="Settlement" />
          {settled && (
            <div className="flex items-center gap-3 rounded-2xl border border-path-a/40 bg-path-a/5 p-5">
              <CheckCircle size={26} weight="duotone" className="text-path-a" />
              <p className="text-[16px] font-medium">Settled · return closed</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-line pt-6">
        <LinkButton to={`/detector/return/${rentalId}/order`} variant="secondary">
          Back to order
        </LinkButton>
        <div className="flex items-center gap-4">
          {saveError && <p className="max-w-md text-[14px] text-danger">{saveError}</p>}
          {settled ? (
            <LinkButton to="/detector">Back to rentals</LinkButton>
          ) : (
            <Button
              onClick={handleSettle}
              disabled={saving}
              icon={saving ? <CircleNotch size={18} className="animate-spin" /> : <CheckCircle size={18} weight="bold" />}
            >
              Mark settled
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
