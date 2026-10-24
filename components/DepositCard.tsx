// components/DepositCard.tsx
// The ₹2,000 deposit and what happens to it: deducted, refunded, or "Collect ₹X more".
import { DEPOSIT_INR } from '@/lib/constants';
import { formatInr } from '@/lib/format';
import type { Settlement } from '@/lib/settlement';

type DepositCardProps = {
  chargedInr: number;
  settlement: Settlement;
  title?: string;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[15px]">
      <span className="text-muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function DepositCard({ chargedInr, settlement, title = 'Deposit' }: DepositCardProps) {
  const collect = settlement.collect_extra_inr > 0;
  return (
    <div className="space-y-4 rounded-2xl border border-line bg-surface p-6">
      <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-subtle">{title}</p>
      <div className="space-y-2">
        <Row label="Deposit held" value={formatInr(DEPOSIT_INR)} />
        <Row label="Charged" value={formatInr(chargedInr)} />
        <Row label="Deducted from deposit" value={formatInr(settlement.deducted_inr)} />
      </div>
      <div className="border-t border-line pt-4">
        {collect ? (
          <>
            <p className="text-[14px] text-path-b">Collect from the rider</p>
            <p className="text-[34px] font-semibold tracking-tight text-path-b">{formatInr(settlement.collect_extra_inr)} more</p>
          </>
        ) : (
          <>
            <p className="text-[14px] text-muted">Refund to the rider</p>
            <p className="text-[34px] font-semibold tracking-tight">{formatInr(settlement.refund_inr)}</p>
          </>
        )}
      </div>
    </div>
  );
}
