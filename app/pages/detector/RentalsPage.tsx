// app/pages/detector/RentalsPage.tsx
// Detector: active rentals. Pick one to start its return.
import { Moped, Motorcycle, UploadSimple } from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';

import { IconTile } from '@/components/IconTile';
import { LoadState } from '@/components/LoadState';
import { PageHeader } from '@/components/PageHeader';
import { DEPOSIT_INR } from '@/lib/constants';
import { formatDateTime, formatInr } from '@/lib/format';
import { fetchActiveRentals } from '@/lib/rentals';
import type { RentalSummary } from '@/lib/rentals';

function RentalRow({ rental }: { rental: RentalSummary }) {
  const Icon = rental.model === 'TVS Radeon' ? Motorcycle : Moped;
  return (
    <Link
      to={`/detector/return/${rental.id}`}
      className="group grid grid-cols-[auto_1.3fr_1fr_1fr_auto] items-center gap-8 rounded-2xl border border-line bg-surface px-6 py-5 transition-colors hover:border-line-strong hover:bg-raised"
    >
      <IconTile>
        <Icon size={26} weight="duotone" />
      </IconTile>
      <div>
        <p className="text-[18px] font-semibold">{rental.model}</p>
        <p className="text-[14px] text-muted">
          {rental.regNo} · {rental.colour}
        </p>
      </div>
      <div>
        <p className="text-[13px] text-subtle">Rider</p>
        <p className="text-[15px]">{rental.riderName}</p>
      </div>
      <div>
        <p className="text-[13px] text-subtle">Picked up</p>
        <p className="text-[15px]">{formatDateTime(rental.pickedUpAt)}</p>
      </div>
      {/* The whole row is the link; this is styled as its button. */}
      <span className="inline-flex h-11 items-center gap-2 rounded-xl bg-ink px-5 text-[14px] font-semibold text-black transition-colors group-hover:bg-neutral-200">
        <UploadSimple size={18} weight="bold" />
        Upload photos
      </span>
    </Link>
  );
}

export function RentalsPage() {
  const [rentals, setRentals] = useState<RentalSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(function loadRentals() {
    fetchActiveRentals()
      .then(setRentals)
      .catch(function handleError(e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      });
  }, []);

  useEffect(load, [load]);

  function handleRetry() {
    setError(null);
    load();
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Detector"
        title="Active rentals"
        subtitle={
          rentals
            ? `${rentals.length} scooter${rentals.length === 1 ? '' : 's'} out · ${formatInr(DEPOSIT_INR)} deposit each`
            : 'Loading rentals…'
        }
      />
      {rentals === null ? (
        <LoadState error={error} onRetry={handleRetry} />
      ) : rentals.length === 0 ? (
        <p className="text-muted">No active rentals.</p>
      ) : (
        <div className="space-y-3">
          {rentals.map(function renderRental(rental) {
            return <RentalRow key={rental.id} rental={rental} />;
          })}
        </div>
      )}
    </div>
  );
}
