// app/pages/detector/RentalsPage.tsx
// Detector: active rentals. Pick one to start its return, or record a new pickup. Below them, returns
// the inspector sent back for reassessment.
import { ArrowUUpLeft, CheckCircle, Moped, Plus, UploadSimple } from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';

import { LinkButton } from '@/components/Button';
import { IconTile } from '@/components/IconTile';
import { LoadState } from '@/components/LoadState';
import { PageHeader } from '@/components/PageHeader';
import { DEPOSIT_INR } from '@/lib/constants';
import { formatDateTime, formatInr } from '@/lib/format';
import { fetchSentBackReturns } from '@/lib/reassessments';
import type { SentBackReturn } from '@/lib/reassessments';
import { fetchActiveRentals } from '@/lib/rentals';
import type { RentalSummary } from '@/lib/rentals';

function RentalRow({ rental }: { rental: RentalSummary }) {
  const Icon = Moped;
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

function SentBackRow({ item }: { item: SentBackReturn }) {
  return (
    <Link
      to={`/detector/return/${item.rentalId}`}
      className="group grid grid-cols-[auto_1.3fr_1.6fr_auto] items-center gap-8 rounded-2xl border border-line bg-surface px-6 py-5 transition-colors hover:border-line-strong hover:bg-raised"
    >
      <IconTile>
        <ArrowUUpLeft size={26} weight="duotone" />
      </IconTile>
      <div>
        <p className="text-[18px] font-semibold">{item.model}</p>
        <p className="text-[14px] text-muted">
          {item.regNo} · {item.riderName}
        </p>
      </div>
      <div className="min-w-0">
        <p className="text-[13px] text-subtle">Inspector's reason · {formatDateTime(item.requestedAt)}</p>
        <p className="truncate text-[15px]">
          {item.reasonLabel}
          {item.note ? ` · ${item.note}` : ''}
        </p>
      </div>
      {/* The whole row is the link; this is styled as its button. */}
      <span className="inline-flex h-11 items-center gap-2 rounded-xl border border-line-strong px-5 text-[14px] font-semibold transition-colors group-hover:bg-hover">
        <UploadSimple size={18} weight="bold" />
        Reassess
      </span>
    </Link>
  );
}

/** The plate just recorded on New pickup, passed in the navigation state. */
function pickedUpPlate(state: unknown): string | null {
  if (typeof state !== 'object' || state === null || !('pickedUp' in state)) return null;
  return typeof state.pickedUp === 'string' ? state.pickedUp : null;
}

export function RentalsPage() {
  const location = useLocation();
  const justPickedUp = pickedUpPlate(location.state);
  const [rentals, setRentals] = useState<RentalSummary[] | null>(null);
  const [sentBack, setSentBack] = useState<SentBackReturn[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(function loadRentals() {
    Promise.all([fetchActiveRentals(), fetchSentBackReturns()])
      .then(function handleLoaded([active, returnsSentBack]) {
        setRentals(active);
        setSentBack(returnsSentBack);
      })
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
        actions={
          <LinkButton to="/detector/pickup" variant="secondary" icon={<Plus size={18} weight="bold" />}>
            New pickup
          </LinkButton>
        }
      />
      {justPickedUp && (
        <p className="flex items-center gap-3 rounded-2xl border border-line-strong bg-surface px-5 py-4 text-[15px]">
          <CheckCircle size={22} weight="duotone" className="shrink-0" />
          Pickup saved for {justPickedUp}. It is listed below, ready for its return.
        </p>
      )}
      {rentals === null ? (
        <LoadState error={error} onRetry={handleRetry} />
      ) : rentals.length === 0 ? (
        <div className="flex items-center justify-between gap-6 rounded-2xl border border-dashed border-line-strong px-6 py-5">
          <p className="text-muted">No scooters are out. Record a pickup to start one.</p>
          <LinkButton to="/detector/pickup" icon={<Plus size={18} weight="bold" />}>
            New pickup
          </LinkButton>
        </div>
      ) : (
        <div className="space-y-3">
          {rentals.map(function renderRental(rental) {
            return <RentalRow key={rental.id} rental={rental} />;
          })}
        </div>
      )}
      {sentBack.length > 0 && (
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-[22px] font-semibold tracking-tight">Sent back by the inspector</h2>
            <p className="text-[15px] text-muted">The return photos are kept. Replace any that need it, then assess again.</p>
          </div>
          <div className="space-y-3">
            {sentBack.map(function renderSentBack(item) {
              return <SentBackRow key={item.rentalId} item={item} />;
            })}
          </div>
        </section>
      )}
    </div>
  );
}
