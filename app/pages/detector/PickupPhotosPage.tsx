// app/pages/detector/PickupPhotosPage.tsx
// New pickup step 2: the four pickup photos, the "before" set every return is compared with.
// Saving uploads the files first, then start-rental records the rental and the photos together.
import { CircleNotch, FloppyDisk, Images } from '@phosphor-icons/react';
import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';

import { Button, LinkButton } from '@/components/Button';
import { PageHeader } from '@/components/PageHeader';
import { PhotoSlot } from '@/components/PhotoSlot';
import { ANGLES, completeSet, sampleVehicleFor } from '@/lib/photos';
import type { Angle } from '@/lib/photos';
import { pickupFromSearch, pickupSearch, startRental } from '@/lib/pickup';
import { prepareFile, samplePhotos, uploadPickupPhotos } from '@/lib/returnPhotos';
import type { ChosenPhoto } from '@/lib/returnPhotos';

function saveProgress(savedCount: number | null, chosenCount: number): string {
  if (savedCount === null) return `${chosenCount} of 4 photos added`;
  return savedCount < 4 ? `Uploading photo ${savedCount + 1} of 4…` : 'Recording the pickup…';
}

export function PickupPhotosPage() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const details = pickupFromSearch(search);
  const [photos, setPhotos] = useState<Partial<Record<Angle, ChosenPhoto>>>({});
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!details) return <Navigate to="/detector/pickup" replace />;

  const complete = completeSet(photos);
  const chosenCount = ANGLES.filter((angle) => photos[angle] !== undefined).length;
  const saving = savedCount !== null;

  function handleFile(angle: Angle, file: File) {
    setError(null);
    prepareFile(file)
      .then(function handlePrepared(photo) {
        setPhotos(function addPhoto(current) {
          return { ...current, [angle]: photo };
        });
      })
      .catch(function handleError(e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      });
  }

  function fillWithSamplePhotos() {
    if (details) setPhotos(samplePhotos(sampleVehicleFor(details.regNo), 'pickup'));
  }

  async function save(set: Record<Angle, ChosenPhoto>, pickup: NonNullable<typeof details>) {
    setError(null);
    setSavedCount(0);
    try {
      const rentalId = crypto.randomUUID();
      await uploadPickupPhotos(rentalId, set, setSavedCount);
      await startRental(rentalId, pickup);
      navigate('/detector', { state: { pickedUp: pickup.regNo } });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSavedCount(null);
    }
  }

  function handleSave() {
    if (complete && details) void save(complete, details);
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="New pickup · Step 2 of 2"
        title="Add the four pickup photos"
        subtitle={`${details.model} · ${details.regNo}. One photo per angle, taken before the rider leaves.`}
      />

      <div className="grid grid-cols-4 gap-5">
        {ANGLES.map(function renderSlot(angle) {
          return <PhotoSlot key={angle} angle={angle} stage="pickup" url={photos[angle]?.url} onFile={handleFile} />;
        })}
      </div>

      <div className="flex items-center justify-between gap-6 rounded-2xl border border-dashed border-line-strong px-6 py-4">
        <div className="flex items-center gap-4">
          <Images size={26} weight="duotone" className="shrink-0 text-muted" />
          <div>
            <p className="text-[15px] font-medium">Demo shortcut</p>
            <p className="text-[14px] text-muted">Fill all four angles with clean sample pickup photos in one click.</p>
          </div>
        </div>
        <Button variant="secondary" icon={<Images size={18} weight="duotone" />} onClick={fillWithSamplePhotos} disabled={saving}>
          Use sample photos
        </Button>
      </div>

      {error && <p className="text-danger">{error}</p>}

      <div className="flex items-center justify-between border-t border-line pt-8">
        <LinkButton to={`/detector/pickup?${pickupSearch(details)}`} variant="secondary">
          Back to details
        </LinkButton>
        <div className="flex items-center gap-6">
          <p className="text-muted">{saveProgress(savedCount, chosenCount)}</p>
          <Button
            onClick={handleSave}
            disabled={!complete || saving}
            icon={saving ? <CircleNotch size={18} className="animate-spin" /> : <FloppyDisk size={18} weight="duotone" />}
          >
            {saving ? 'Saving…' : 'Save pickup'}
          </Button>
        </div>
      </div>
    </div>
  );
}
