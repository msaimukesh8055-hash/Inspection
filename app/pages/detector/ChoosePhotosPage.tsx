// app/pages/detector/ChoosePhotosPage.tsx
// Return step 1: add the four return photos, from files or (for the demo) this scooter's sample set.
// The page never says what damage the samples show: finding it is the AI's job.
import { ImageSquare, Images } from '@phosphor-icons/react';
import type { ChangeEvent } from 'react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { useRentalData } from '@/app/hooks/useRentalData';
import { useReturnDraft } from '@/app/state/returnDraft';
import { Button } from '@/components/Button';
import { LoadState } from '@/components/LoadState';
import { ReturnHeader } from '@/components/ReturnHeader';
import { allAnglesFilled, ANGLES, angleLabel, DEMO_RETURN_SET, sampleKeyForRegNo } from '@/lib/photos';
import type { Angle } from '@/lib/photos';
import { prepareFile, samplePhotos } from '@/lib/returnPhotos';

function UploadSlot({
  angle,
  url,
  onFile,
}: {
  angle: Angle;
  url: string | undefined;
  onFile: (angle: Angle, file: File) => void;
}) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onFile(angle, file);
    event.target.value = '';
  }

  return (
    <label className="group relative block cursor-pointer overflow-hidden rounded-2xl border border-dashed border-line-strong bg-surface transition-colors hover:border-ink">
      <input type="file" accept="image/*" className="sr-only" onChange={handleChange} />
      {url ? (
        <>
          <img src={url} alt={`${angleLabel(angle)} return`} className="aspect-[4/3] w-full object-cover" />
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/90 to-transparent px-4 pb-3 pt-10">
            <span className="text-[15px] font-semibold">{angleLabel(angle)}</span>
            <span className="text-[13px] text-muted group-hover:text-ink">Replace</span>
          </span>
        </>
      ) : (
        <span className="flex aspect-[4/3] flex-col items-center justify-center gap-4 text-muted group-hover:text-ink">
          <ImageSquare size={34} weight="duotone" />
          <span className="text-center">
            <span className="block text-[17px] font-semibold text-ink">{angleLabel(angle)}</span>
            <span className="text-[14px]">Click to choose a photo</span>
          </span>
        </span>
      )}
    </label>
  );
}

export function ChoosePhotosPage() {
  const { rentalId = '' } = useParams();
  const navigate = useNavigate();
  const { data, error, retry } = useRentalData(rentalId, false);
  const [draft, setDraft] = useReturnDraft(rentalId);
  const [fileError, setFileError] = useState<string | null>(null);

  if (!data) return <LoadState error={error} onRetry={retry} />;

  const vehicle = sampleKeyForRegNo(data.rental.regNo);
  const chosenCount = ANGLES.filter((a) => draft.photos[a] !== undefined).length;

  function handleFile(angle: Angle, file: File) {
    setFileError(null);
    prepareFile(file)
      .then(function handlePrepared(photo) {
        setDraft(function addPhoto(current) {
          return { photos: { ...current.photos, [angle]: photo } };
        });
      })
      .catch(function handleError(e: unknown) {
        setFileError(e instanceof Error ? e.message : String(e));
      });
  }

  function fillWithSamplePhotos() {
    if (vehicle) setDraft({ photos: samplePhotos(vehicle, DEMO_RETURN_SET[vehicle]) });
  }

  function goToReview() {
    navigate(`/detector/return/${rentalId}/review`);
  }

  return (
    <div className="space-y-10">
      <ReturnHeader
        rental={data.rental}
        step={1}
        title="Upload the four return photos"
        subtitle="One photo per angle. The AI compares them with the pickup photos to find new damage."
      />

      <div className="grid grid-cols-4 gap-5">
        {ANGLES.map(function renderSlot(angle) {
          return <UploadSlot key={angle} angle={angle} url={draft.photos[angle]?.url} onFile={handleFile} />;
        })}
      </div>
      {fileError && <p className="text-danger">{fileError}</p>}

      {vehicle && (
        <div className="flex items-center justify-between gap-6 rounded-2xl border border-dashed border-line-strong px-6 py-4">
          <div className="flex items-center gap-4">
            <Images size={26} weight="duotone" className="shrink-0 text-muted" />
            <div>
              <p className="text-[15px] font-medium">Demo shortcut</p>
              <p className="text-[14px] text-muted">Fill all four angles with this scooter's sample return photos in one click.</p>
            </div>
          </div>
          <Button variant="secondary" icon={<Images size={18} weight="duotone" />} onClick={fillWithSamplePhotos}>
            Use sample photos
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-line pt-8">
        <p className="text-muted">{chosenCount} of 4 photos added</p>
        <Button onClick={goToReview} disabled={!allAnglesFilled(draft.photos)}>
          Continue to review
        </Button>
      </div>
    </div>
  );
}
