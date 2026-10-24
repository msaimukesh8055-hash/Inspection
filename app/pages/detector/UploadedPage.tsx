// app/pages/detector/UploadedPage.tsx
// Return step 3: the saved photos, read back from Supabase. Milestone 4 turns "Assess damage" on.
import { Sparkle } from '@phosphor-icons/react';
import { useParams } from 'react-router';

import { useRentalData } from '@/app/hooks/useRentalData';
import { Button, LinkButton } from '@/components/Button';
import { LoadState } from '@/components/LoadState';
import { PhotoViewer } from '@/components/PhotoViewer';
import { ReturnHeader } from '@/components/ReturnHeader';

function assessNotReady() {
  // Enabled in Milestone 4 when the assess-return function exists.
}

export function UploadedPage() {
  const { rentalId = '' } = useParams();
  const { data, error, retry } = useRentalData(rentalId, true);

  if (!data) return <LoadState error={error} onRetry={retry} />;

  return (
    <div className="space-y-10">
      <ReturnHeader
        rental={data.rental}
        step={3}
        title="Return photos saved"
        subtitle="All four photos are stored with this rental and ready for assessment."
      />
      <PhotoViewer pickup={data.photos.pickup} returned={data.photos.return} />
      <div className="flex items-center justify-between border-t border-line pt-8">
        <LinkButton to="/detector" variant="secondary">
          Back to rentals
        </LinkButton>
        <div className="flex items-center gap-5">
          <p className="text-[14px] text-subtle">AI assessment arrives in Milestone 4</p>
          <Button onClick={assessNotReady} disabled icon={<Sparkle size={18} weight="duotone" />}>
            Assess damage
          </Button>
        </div>
      </div>
    </div>
  );
}
