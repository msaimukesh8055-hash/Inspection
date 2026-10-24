// components/LineItemsTable.tsx
// Parts and labour per repair, priced from parts_catalog, with the total underneath.
import type { LineItem } from '@/lib/assessments';
import { formatInr } from '@/lib/format';

type LineItemsTableProps = {
  lines: LineItem[];
  totalLabel: string;
  totalInr: number;
};

export function LineItemsTable({ lines, totalLabel, totalInr }: LineItemsTableProps) {
  return (
    <div className="rounded-2xl border border-line bg-surface">
      <div className="grid grid-cols-[1fr_90px_90px_100px] gap-4 border-b border-line px-6 py-3 text-[13px] text-subtle">
        <span>Repair</span>
        <span className="text-right">Parts</span>
        <span className="text-right">Labour</span>
        <span className="text-right">Total</span>
      </div>
      {lines.length === 0 ? (
        <p className="px-6 py-5 text-[15px] text-muted">No repairs needed.</p>
      ) : (
        lines.map(function renderLine(line) {
          return (
            <div key={line.id} className="grid grid-cols-[1fr_90px_90px_100px] gap-4 border-b border-line px-6 py-4 text-[15px]">
              <div className="min-w-0 space-y-1">
                <p className="font-medium">{line.description}</p>
                <p className="text-[13px] text-subtle">{line.partCode}</p>
                {line.reasoning && <p className="text-[13px] text-muted">{line.reasoning}</p>}
              </div>
              <span className="text-right text-muted">{formatInr(line.partsInr)}</span>
              <span className="text-right text-muted">{formatInr(line.labourInr)}</span>
              <span className="text-right font-medium">{formatInr(line.finalInr ?? line.totalInr)}</span>
            </div>
          );
        })
      )}
      <div className="flex items-center justify-between px-6 py-4">
        <span className="text-[15px] text-muted">{totalLabel}</span>
        <span className="text-[22px] font-semibold">{formatInr(totalInr)}</span>
      </div>
    </div>
  );
}
