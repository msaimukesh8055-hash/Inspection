// app/pages/DashboardPage.tsx
// Fleet dashboard: one box of insights (summary figures and returns by branch), then one box with each
// scooter's damage history. Eval test returns are left out.
import { Moped } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';

import { IconTile } from '@/components/IconTile';
import { LoadState } from '@/components/LoadState';
import { PageHeader } from '@/components/PageHeader';
import { fetchDashboard } from '@/lib/dashboard';
import type { DashboardSummary, ReturnRecord, ScooterHistory } from '@/lib/dashboard';
import { formatDateTime, formatInr } from '@/lib/format';
import { angleLabel } from '@/lib/photos';

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="space-y-2 rounded-2xl border border-line bg-canvas p-6">
      <p className="text-[13px] font-medium uppercase tracking-[0.12em] text-subtle">{label}</p>
      <p className="text-[32px] font-semibold leading-none tracking-tight tabular-nums">{value}</p>
      <p className="text-[14px] text-muted">{detail}</p>
    </div>
  );
}

function PathSplit({ paths }: { paths: DashboardSummary['paths'] }) {
  const total = paths.A + paths.B;
  const shareA = total === 0 ? 0 : Math.round((paths.A / total) * 100);
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-canvas p-6">
      <p className="text-[13px] font-medium uppercase tracking-[0.12em] text-subtle">Path A / Path B</p>
      <p className="text-[32px] font-semibold leading-none tracking-tight tabular-nums">
        <span className="text-path-a">{paths.A}</span>
        <span className="text-subtle"> / </span>
        <span className="text-path-b">{paths.B}</span>
      </p>
      <div className="flex h-2 overflow-hidden rounded-full bg-raised" aria-hidden="true">
        <div className="bg-path-a" style={{ width: `${shareA}%` }} />
        <div className="flex-1 bg-path-b" style={{ opacity: total === 0 ? 0 : 1 }} />
      </div>
      <p className="text-[14px] text-muted">{total === 0 ? 'No returns yet' : `${shareA}% billed at the counter`}</p>
    </div>
  );
}

function BranchChart({ byBranch }: { byBranch: DashboardSummary['byBranch'] }) {
  const max = Math.max(1, ...byBranch.map((b) => b.returns));
  // Whole-number gridlines: about four steps up to the busiest branch.
  const step = Math.max(1, Math.ceil(max / 4));
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step).reverse();
  return (
    <div className="space-y-4 rounded-2xl border border-line bg-canvas p-6">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[16px] font-semibold">Returns by branch</h3>
        <p className="text-[13px] text-subtle">Bangalore · assessed returns</p>
      </div>
      <div className="grid grid-cols-[32px_1fr] gap-3">
        <div className="relative h-[240px]" aria-hidden="true">
          {ticks.map(function renderTick(tick) {
            return (
              <span key={tick} className="absolute right-0 -translate-y-1/2 text-[12px] text-subtle tabular-nums" style={{ top: `${100 - (tick / top) * 100}%` }}>
                {tick}
              </span>
            );
          })}
        </div>
        <div className="relative h-[240px]">
          {ticks.map(function renderGridline(tick) {
            return <div key={tick} className={`absolute inset-x-0 border-t ${tick === 0 ? 'border-line-strong' : 'border-line'}`} style={{ top: `${100 - (tick / top) * 100}%` }} aria-hidden="true" />;
          })}
          <div className="absolute inset-0 grid grid-cols-6 gap-6 px-4">
            {byBranch.map(function renderBar(entry) {
              return (
                <div key={entry.branch} className="group relative flex h-full items-end justify-center" title={`${entry.branch}: ${entry.returns} return${entry.returns === 1 ? '' : 's'}`}>
                  <span
                    className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 -translate-y-2 whitespace-nowrap rounded-lg border border-line-strong bg-raised px-3 py-1.5 text-[13px] opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ bottom: `${(entry.returns / top) * 100}%` }}
                  >
                    {entry.branch} · {entry.returns} return{entry.returns === 1 ? '' : 's'}
                  </span>
                  <span className="absolute text-[13px] font-medium tabular-nums text-muted" style={{ bottom: `calc(${(entry.returns / top) * 100}% + 6px)` }}>
                    {entry.returns}
                  </span>
                  <div className="w-full max-w-[56px] rounded-t-[4px] bg-ink transition-colors group-hover:bg-neutral-300" style={{ height: `${(entry.returns / top) * 100}%` }} />
                </div>
              );
            })}
          </div>
        </div>
        <div />
        <div className="grid grid-cols-6 gap-6 px-4">
          {byBranch.map(function renderLabel(entry) {
            return (
              <p key={entry.branch} className="text-center text-[13px] text-muted">
                {entry.branch}
              </p>
            );
          })}
        </div>
      </div>
      <table className="sr-only">
        <caption>Returns by branch</caption>
        <tbody>
          {byBranch.map(function renderRow(entry) {
            return (
              <tr key={entry.branch}>
                <th scope="row">{entry.branch}</th>
                <td>{entry.returns}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PathBadge({ path }: { path: ReturnRecord['path'] }) {
  if (!path) return <span className="text-[13px] text-subtle">—</span>;
  const colour = path === 'A' ? 'border-path-a/50 text-path-a' : 'border-path-b/50 text-path-b';
  return <span className={`inline-flex h-6 items-center rounded-full border px-2.5 text-[12px] font-semibold ${colour}`}>Path {path}</span>;
}

function ScooterCard({ scooter }: { scooter: ScooterHistory }) {
  return (
    <div className="rounded-2xl border border-line bg-canvas">
      <div className="flex items-center justify-between gap-6 border-b border-line px-6 py-5">
        <div className="flex items-center gap-4">
          <IconTile>
            <Moped size={26} weight="duotone" />
          </IconTile>
          <div>
            <p className="text-[18px] font-semibold">{scooter.regNo}</p>
            <p className="text-[14px] text-muted">
              {scooter.model} · {scooter.colour} · {scooter.returns.length} return{scooter.returns.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[13px] text-subtle">Damage total</p>
          <p className="text-[20px] font-semibold tabular-nums">{formatInr(scooter.totalInr)}</p>
        </div>
      </div>
      <table className="w-full text-left text-[14px]">
        <thead>
          <tr className="text-[12px] uppercase tracking-[0.1em] text-subtle">
            <th className="px-6 py-3 font-medium">Returned</th>
            <th className="px-3 py-3 font-medium">Side</th>
            <th className="px-3 py-3 font-medium">Damage</th>
            <th className="px-3 py-3 font-medium">Path</th>
            <th className="px-6 py-3 text-right font-medium">Final amount</th>
          </tr>
        </thead>
        <tbody>
          {scooter.returns.flatMap(function renderReturn(record) {
            if (record.entries.length === 0) {
              return [
                <tr key={record.rentalId} className="border-t border-line">
                  <td className="px-6 py-3 text-muted">{formatDateTime(record.date)}</td>
                  <td className="px-3 py-3 text-subtle">—</td>
                  <td className="px-3 py-3 text-muted">No new damage</td>
                  <td className="px-3 py-3">
                    <PathBadge path={record.path} />
                  </td>
                  <td className="px-6 py-3 text-right tabular-nums">{formatInr(0)}</td>
                </tr>,
              ];
            }
            return record.entries.map(function renderEntry(entry, index) {
              return (
                <tr key={`${record.rentalId}-${index}`} className="border-t border-line">
                  <td className="px-6 py-3 text-muted">{index === 0 ? formatDateTime(record.date) : ''}</td>
                  <td className="px-3 py-3">{entry.side ? angleLabel(entry.side) : <span className="text-subtle">—</span>}</td>
                  <td className="px-3 py-3">{entry.what}</td>
                  <td className="px-3 py-3">{index === 0 && <PathBadge path={record.path} />}</td>
                  <td className="px-6 py-3 text-right tabular-nums">{formatInr(entry.amountInr)}</td>
                </tr>
              );
            });
          })}
        </tbody>
      </table>
    </div>
  );
}

export function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetchDashboard()
      .then(setSummary)
      .catch(function handleError(e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      });
  }

  useEffect(load, []);

  function handleRetry() {
    setError(null);
    load();
  }

  if (!summary) return <LoadState error={error} onRetry={handleRetry} />;

  const returnsCount = summary.paths.A + summary.paths.B;

  return (
    <div className="space-y-12">
      <PageHeader eyebrow="Dashboard" title="Fleet damage history" subtitle="Every assessed return, by scooter. Eval test returns are left out." />

      <section className="space-y-8 rounded-3xl border border-line-strong bg-surface p-8">
        <h2 className="text-[22px] font-semibold tracking-tight">Insights</h2>
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Returns assessed" value={String(returnsCount)} detail={`${summary.scooters.length} scooters`} />
          <PathSplit paths={summary.paths} />
          <Stat label="Money recovered" value={formatInr(summary.moneyRecoveredInr)} detail="Charged to riders on finished returns" />
        </div>
        <BranchChart byBranch={summary.byBranch} />
      </section>

      <section className="space-y-6 rounded-3xl border border-line-strong bg-surface p-8">
        <h2 className="text-[22px] font-semibold tracking-tight">Scooters</h2>
        {summary.scooters.length === 0 ? (
          <p className="text-muted">No assessed returns yet.</p>
        ) : (
          <div className="space-y-4">
            {summary.scooters.map(function renderScooter(scooter) {
              return <ScooterCard key={scooter.regNo} scooter={scooter} />;
            })}
          </div>
        )}
      </section>
    </div>
  );
}
