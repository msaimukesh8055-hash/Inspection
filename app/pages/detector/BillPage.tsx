// app/pages/detector/BillPage.tsx
// Return step 5, Path A: the bill. "Confirm and bill" saves the deposit maths, "Mark paid" closes the return.
import { CheckCircle, CircleNotch, Quotes, Receipt, UserFocus } from '@phosphor-icons/react';
import { useState } from 'react';
import { Navigate, useParams } from 'react-router';

import { useAssessment } from '@/app/hooks/useAssessment';
import { useRentalData } from '@/app/hooks/useRentalData';
import { Button, LinkButton } from '@/components/Button';
import { DepositCard } from '@/components/DepositCard';
import { LineItemsTable } from '@/components/LineItemsTable';
import { LoadState } from '@/components/LoadState';
import { ReturnHeader } from '@/components/ReturnHeader';
import { settleReturn } from '@/lib/assessments';
import { formatInr } from '@/lib/format';
import { settle } from '@/lib/settlement';

function escalateNotReady() {
  // Escalation with a reason, saved to overrides, arrives in Milestone 6.
}

export function BillPage() {
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
  if (!assessment || assessment.path !== 'A') return <Navigate to={`/detector/return/${rentalId}/assessment`} replace />;

  const current = assessment;
  const settlement = settle(current.totalInr);
  const billed = current.status === 'billed';
  const paid = current.status === 'paid';

  async function act(action: 'confirm_bill' | 'mark_paid') {
    setSaving(true);
    setSaveError(null);
    try {
      await settleReturn(current.id, action);
      reload();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function handleConfirm() {
    void act('confirm_bill');
  }

  function handlePaid() {
    void act('mark_paid');
  }

  const title = current.totalInr === 0 ? 'No charge' : `Bill · ${formatInr(current.totalInr)}`;
  const subtitle = paid
    ? 'Paid. The return is closed.'
    : billed
      ? 'Billed. Take payment or settle from the deposit, then mark paid.'
      : 'Path A: review the bill with the rider, then confirm.';
  const spinner = <CircleNotch size={18} className="animate-spin" />;

  return (
    <div className="space-y-10">
      <ReturnHeader rental={data.rental} step={5} title={title} subtitle={subtitle} />

      <div className="grid grid-cols-[1fr_380px] gap-8">
        <div className="space-y-4">
          <LineItemsTable lines={current.lines} totalLabel="Total charge" totalInr={current.totalInr} />
          {current.riderMessage && (
            <div className="flex gap-4 rounded-2xl border border-line bg-surface p-5">
              <Quotes size={24} weight="duotone" className="shrink-0 text-subtle" />
              <div className="space-y-1">
                <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-subtle">Note for the rider</p>
                <p className="text-[16px] leading-relaxed">{current.riderMessage}</p>
              </div>
            </div>
          )}
        </div>
        <div className="space-y-4">
          <DepositCard chargedInr={current.totalInr} settlement={settlement} />
          {paid && (
            <div className="flex items-center gap-3 rounded-2xl border border-path-a/40 bg-path-a/5 p-5">
              <CheckCircle size={26} weight="duotone" className="text-path-a" />
              <p className="text-[16px] font-medium">Paid · return closed</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-line pt-8">
        <LinkButton to={`/detector/return/${rentalId}/assessment`} variant="secondary">
          Back to assessment
        </LinkButton>
        <div className="flex items-center gap-4">
          {saveError && <p className="max-w-md text-[14px] text-danger">{saveError}</p>}
          {!billed && !paid && (
            <Button variant="ghost" onClick={escalateNotReady} disabled icon={<UserFocus size={18} />}>
              Escalate to inspection (Milestone 6)
            </Button>
          )}
          {paid ? (
            <LinkButton to="/detector">Back to rentals</LinkButton>
          ) : billed ? (
            <Button onClick={handlePaid} disabled={saving} icon={saving ? spinner : <CheckCircle size={18} weight="bold" />}>
              Mark paid
            </Button>
          ) : (
            <Button onClick={handleConfirm} disabled={saving} icon={saving ? spinner : <Receipt size={18} weight="bold" />}>
              Confirm and bill
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
