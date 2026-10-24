// app/pages/detector/UploadedPage.tsx
// Return step 3: the saved photos, read back from Supabase, and the button that runs the AI assessment.
import { CircleNotch, Sparkle } from '@phosphor-icons/react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { useRentalData } from '@/app/hooks/useRentalData';
import { Button, LinkButton } from '@/components/Button';
import { LoadState } from '@/components/LoadState';
import { PhotoViewer } from '@/components/PhotoViewer';
import { ReturnHeader } from '@/components/ReturnHeader';
import { runAssessment } from '@/lib/assessments';

export function UploadedPage() {
  const { rentalId = '' } = useParams();
  const navigate = useNavigate();
  const { data, error, retry } = useRentalData(rentalId, true);
  const [assessing, setAssessing] = useState(false);
  const [assessError, setAssessError] = useState<string | null>(null);

  if (!data) return <LoadState error={error} onRetry={retry} />;

  async function assess() {
    setAssessError(null);
    setAssessing(true);
    try {
      await runAssessment(rentalId);
      navigate(`/detector/return/${rentalId}/assessment`);
    } catch (e) {
      setAssessError(e instanceof Error ? e.message : String(e));
      setAssessing(false);
    }
  }

  function handleAssess() {
    void assess();
  }

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
          {assessError ? (
            <p className="max-w-md text-[14px] text-danger">Assessment failed: {assessError}</p>
          ) : (
            assessing && <p className="text-[14px] text-muted">The AI is comparing all eight photos. This takes up to a minute.</p>
          )}
          <Button
            onClick={handleAssess}
            disabled={assessing}
            icon={assessing ? <CircleNotch size={18} className="animate-spin" /> : <Sparkle size={18} weight="duotone" />}
          >
            {assessing ? 'Assessing…' : 'Assess damage'}
          </Button>
        </div>
      </div>
    </div>
  );
}
