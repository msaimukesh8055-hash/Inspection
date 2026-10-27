// app/pages/detector/ChoosePhotosPage.tsx
// Return step 1: add the four return photos, from files or (for the demo) this scooter's sample set.
// The page never says what damage the samples show: finding it is the AI's job.
// For a return the inspector sent back, the saved return photos are loaded first and any can be replaced.
import { ArrowUUpLeft, Images } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { useRentalData } from '@/app/hooks/useRentalData';
import { useReturnDraft } from '@/app/state/returnDraft';
import { Button } from '@/components/Button';
import { LoadState } from '@/components/LoadState';
import { PhotoSlot } from '@/components/PhotoSlot';
import { ReturnHeader } from '@/components/ReturnHeader';
import { allAnglesFilled, ANGLES, DEMO_RETURN_SET, sampleVehicleFor } from '@/lib/photos';
import type { Angle } from '@/lib/photos';
import { fetchOpenReassessment } from '@/lib/reassessments';
import type { SentBackReturn } from '@/lib/reassessments';
import { prepareFile, samplePhotos } from '@/lib/returnPhotos';
import type { ChosenPhoto } from '@/lib/returnPhotos';

export function ChoosePhotosPage() {
  const { rentalId = '' } = useParams();
  const navigate = useNavigate();
  const { data, error, retry } = useRentalData(rentalId, true);
  const [draft, setDraft] = useReturnDraft(rentalId);
  const [fileError, setFileError] = useState<string | null>(null);
  const [sentBack, setSentBack] = useState<SentBackReturn | null>(null);

  useEffect(
    function loadSentBack() {
      fetchOpenReassessment(rentalId)
        .then(setSentBack)
        .catch(function handleError(e: unknown) {
          setFileError(e instanceof Error ? e.message : String(e));
        });
    },
    [rentalId],
  );

  const savedReturn = data?.photos.return;
  const draftIsEmpty = ANGLES.every((a) => draft.photos[a] === undefined);
  useEffect(
    function preloadSavedPhotos() {
      if (!sentBack || !savedReturn || !draftIsEmpty) return;
      const saved: Partial<Record<Angle, ChosenPhoto>> = {};
      for (const angle of ANGLES) {
        const url = savedReturn[angle];
        if (url) saved[angle] = { url, source: 'saved' };
      }
      setDraft({ photos: saved });
    },
    // setDraft changes identity on every render; the draft itself is read through draftIsEmpty.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sentBack, savedReturn, draftIsEmpty],
  );

  if (!data) return <LoadState error={error} onRetry={retry} />;

  const vehicle = sampleVehicleFor(data.rental.regNo);
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
    setDraft({ photos: samplePhotos(vehicle, DEMO_RETURN_SET[vehicle]) });
  }

  function goToReview() {
    navigate(`/detector/return/${rentalId}/review`);
  }

  return (
    <div className="space-y-10">
      <ReturnHeader
        rental={data.rental}
        step={1}
        title={sentBack ? 'Check the return photos again' : 'Upload the four return photos'}
        subtitle={
          sentBack
            ? 'These are the photos already saved. Replace any that need it, then assess again.'
            : 'One photo per angle. The AI compares them with the pickup photos to find new damage.'
        }
      />

      {sentBack && (
        <div className="flex items-start gap-4 rounded-2xl border border-line-strong bg-surface px-6 py-4">
          <ArrowUUpLeft size={24} weight="duotone" className="mt-0.5 shrink-0" />
          <div>
            <p className="text-[15px] font-medium">Sent back by the inspector: {sentBack.reasonLabel}</p>
            {sentBack.note && <p className="text-[15px] text-muted">{sentBack.note}</p>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-5">
        {ANGLES.map(function renderSlot(angle) {
          return <PhotoSlot key={angle} angle={angle} stage="return" url={draft.photos[angle]?.url} onFile={handleFile} />;
        })}
      </div>
      {fileError && <p className="text-danger">{fileError}</p>}

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

      <div className="flex items-center justify-between border-t border-line pt-8">
        <p className="text-muted">{chosenCount} of 4 photos added</p>
        <Button onClick={goToReview} disabled={!allAnglesFilled(draft.photos)}>
          Continue to review
        </Button>
      </div>
    </div>
  );
}
