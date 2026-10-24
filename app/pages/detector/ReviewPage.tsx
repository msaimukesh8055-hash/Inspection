// app/pages/detector/ReviewPage.tsx
// Return step 2: compare each return photo with its pickup photo, then upload all four.
import { CircleNotch, UploadSimple } from '@phosphor-icons/react';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';

import { useRentalData } from '@/app/hooks/useRentalData';
import { useReturnDraft } from '@/app/state/returnDraft';
import { Button } from '@/components/Button';
import { LoadState } from '@/components/LoadState';
import { PhotoViewer } from '@/components/PhotoViewer';
import { ReturnHeader } from '@/components/ReturnHeader';
import { ANGLES, completeSet } from '@/lib/photos';
import type { Angle } from '@/lib/photos';
import { uploadReturnPhotos } from '@/lib/returnPhotos';

export function ReviewPage() {
  const { rentalId = '' } = useParams();
  const navigate = useNavigate();
  const { data, error, retry } = useRentalData(rentalId, false);
  const [draft] = useReturnDraft(rentalId);
  const [uploadedCount, setUploadedCount] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const photos = completeSet(draft.photos);
  if (!photos) return <Navigate to={`/detector/return/${rentalId}`} replace />;
  if (!data) return <LoadState error={error} onRetry={retry} />;

  const uploading = uploadedCount !== null;
  const returnedUrls: Partial<Record<Angle, string>> = {
    front: photos.front.url,
    rear: photos.rear.url,
    left: photos.left.url,
    right: photos.right.url,
  };

  async function upload(complete: NonNullable<typeof photos>) {
    setUploadError(null);
    setUploadedCount(0);
    try {
      await uploadReturnPhotos(rentalId, complete, setUploadedCount);
      navigate(`/detector/return/${rentalId}/uploaded`);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e));
      setUploadedCount(null);
    }
  }

  function handleUpload() {
    if (photos) void upload(photos);
  }

  function handleBack() {
    navigate(-1);
  }

  return (
    <div className="space-y-10">
      <ReturnHeader
        rental={data.rental}
        step={2}
        title="Review the return"
        subtitle="Check each angle against its pickup photo, then upload."
      />
      <PhotoViewer pickup={data.photos.pickup} returned={returnedUrls} />
      <div className="flex items-center justify-between border-t border-line pt-8">
        <Button variant="secondary" onClick={handleBack} disabled={uploading}>
          Back
        </Button>
        <div className="flex items-center gap-5">
          {uploadError && <p className="text-danger">Upload failed: {uploadError}</p>}
          <Button
            onClick={handleUpload}
            disabled={uploading}
            icon={uploading ? <CircleNotch size={18} className="animate-spin" /> : <UploadSimple size={18} weight="bold" />}
          >
            {uploading ? `Uploading ${uploadedCount} of ${ANGLES.length}` : 'Upload 4 photos'}
          </Button>
        </div>
      </div>
    </div>
  );
}
