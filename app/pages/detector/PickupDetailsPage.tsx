// app/pages/detector/PickupDetailsPage.tsx
// New pickup step 1: the branch, the scooter and the rider. Renting it out happens elsewhere; this records the
// pickup so its return can be inspected later. Coming back from step 2 keeps what was typed.
import { ArrowRight } from '@phosphor-icons/react';
import type { ChangeEvent } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { Button, LinkButton } from '@/components/Button';
import { LoadState } from '@/components/LoadState';
import { PageHeader } from '@/components/PageHeader';
import { BRANCHES, fetchPricedModels, fetchRiders, pickupFromSearch, pickupSearch } from '@/lib/pickup';
import type { Branch, RiderOption } from '@/lib/pickup';

const FIELD =
  'h-12 w-full rounded-xl border border-line-strong bg-black px-4 text-[15px] text-ink outline-none placeholder:text-subtle focus:border-ink';
const LABEL = 'block space-y-2';
const LABEL_TEXT = 'text-[14px] font-medium';

/** Same rule as the start-rental function: 4 to 12 letters and digits once spaces are dropped. */
function plateIsValid(regNo: string): boolean {
  return /^[A-Z0-9]{4,12}$/.test(regNo.replace(/\s+/g, '').toUpperCase());
}

export function PickupDetailsPage() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const previous = pickupFromSearch(search);

  const [riders, setRiders] = useState<RiderOption[] | null>(null);
  const [models, setModels] = useState<string[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [regNo, setRegNo] = useState(previous?.regNo ?? '');
  const [model, setModel] = useState(previous?.model ?? '');
  const [colour, setColour] = useState(previous?.colour ?? '');
  const [riderId, setRiderId] = useState(previous?.riderId ?? '');
  const [branch, setBranch] = useState<Branch | ''>(previous?.branch ?? '');

  function load() {
    Promise.all([fetchRiders(), fetchPricedModels()])
      .then(function handleLoaded([riderRows, modelNames]) {
        setRiders(riderRows);
        setModels(modelNames);
      })
      .catch(function handleError(e: unknown) {
        setLoadError(e instanceof Error ? e.message : String(e));
      });
  }

  useEffect(load, []);

  function handleRetry() {
    setLoadError(null);
    load();
  }

  function handleRegNo(event: ChangeEvent<HTMLInputElement>) {
    setRegNo(event.target.value.toUpperCase());
  }

  function handleModel(event: ChangeEvent<HTMLSelectElement>) {
    setModel(event.target.value);
  }

  function handleColour(event: ChangeEvent<HTMLInputElement>) {
    setColour(event.target.value);
  }

  function handleRider(event: ChangeEvent<HTMLSelectElement>) {
    setRiderId(event.target.value);
  }

  function handleBranch(event: ChangeEvent<HTMLSelectElement>) {
    setBranch(BRANCHES.find((b) => b === event.target.value) ?? '');
  }

  if (!riders || !models) return <LoadState error={loadError} onRetry={handleRetry} />;

  const chosenModel = model || (models[0] ?? '');
  const ready = plateIsValid(regNo) && chosenModel !== '' && riderId !== '' && branch !== '';

  function goToPhotos() {
    if (branch === '') return;
    const details = { regNo: regNo.replace(/\s+/g, ''), model: chosenModel, colour: colour.trim(), riderId, branch };
    navigate(`/detector/pickup/photos?${pickupSearch(details)}`);
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="New pickup · Step 1 of 2"
        title="Record a pickup"
        subtitle="Enter the branch, the scooter and the rider. Next, you add the four pickup photos the AI compares each return with."
      />

      <div className="grid max-w-[880px] grid-cols-2 gap-x-6 gap-y-7 rounded-2xl border border-line bg-surface p-8">
        <label className={LABEL}>
          <span className={LABEL_TEXT}>Registration number</span>
          <input
            id="pickup-reg-no"
            value={regNo}
            onChange={handleRegNo}
            placeholder="GA07M2214"
            autoComplete="off"
            className={`${FIELD} font-mono tracking-wide`}
          />
          <span className="block text-[13px] text-subtle">4 to 12 letters and digits. Spaces are ignored.</span>
        </label>
        <label className={LABEL}>
          <span className={LABEL_TEXT}>Model</span>
          <select id="pickup-model" value={chosenModel} onChange={handleModel} className={FIELD}>
            {models.map(function renderModel(name) {
              return (
                <option key={name} value={name}>
                  {name}
                </option>
              );
            })}
          </select>
          <span className="block text-[13px] text-subtle">Only models with parts prices, so returns can be estimated.</span>
        </label>
        <label className={LABEL}>
          <span className={LABEL_TEXT}>
            Colour <span className="font-normal text-subtle">(optional)</span>
          </span>
          <input id="pickup-colour" value={colour} onChange={handleColour} placeholder="Matte Grey" className={FIELD} />
        </label>
        <label className={LABEL}>
          <span className={LABEL_TEXT}>Rider</span>
          <select id="pickup-rider" value={riderId} onChange={handleRider} className={FIELD}>
            <option value="">Choose a rider…</option>
            {riders.map(function renderRider(rider) {
              return (
                <option key={rider.id} value={rider.id}>
                  {rider.name}
                </option>
              );
            })}
          </select>
          <span className="block text-[13px] text-subtle">Demo riders only; the app never stores real rider data.</span>
        </label>
        <label className={LABEL}>
          <span className={LABEL_TEXT}>Branch</span>
          <select id="pickup-branch" value={branch} onChange={handleBranch} className={FIELD}>
            <option value="">Choose a branch…</option>
            {BRANCHES.map(function renderBranch(name) {
              return (
                <option key={name} value={name}>
                  {name}
                </option>
              );
            })}
          </select>
          <span className="block text-[13px] text-subtle">The Goa branch the scooter is picked up from.</span>
        </label>
      </div>

      <div className="flex items-center justify-between border-t border-line pt-8">
        <LinkButton to="/detector" variant="secondary">
          Back to rentals
        </LinkButton>
        <Button onClick={goToPhotos} disabled={!ready} icon={<ArrowRight size={18} weight="bold" />}>
          Continue to photos
        </Button>
      </div>
    </div>
  );
}
