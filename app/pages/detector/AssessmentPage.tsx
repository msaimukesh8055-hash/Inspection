// app/pages/detector/AssessmentPage.tsx
// Return step 4: what the damage agent found, the estimate and the route (A or B).
import { ArrowClockwise, ArrowRight, CircleNotch, Hammer, Lightning, LinkBreak, Scribble, SealCheck } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useParams } from 'react-router';

import { useAssessment } from '@/app/hooks/useAssessment';
import { useRentalData } from '@/app/hooks/useRentalData';
import { AnglePhotoCompare } from '@/components/AnglePhotoCompare';
import { Button, LinkButton } from '@/components/Button';
import { IconTile } from '@/components/IconTile';
import { LoadState } from '@/components/LoadState';
import { ReturnHeader } from '@/components/ReturnHeader';
import { RouteBadge } from '@/components/RouteBadge';
import { runAssessment } from '@/lib/assessments';
import type { Assessment, DamageFinding, DamageType } from '@/lib/assessments';
import { formatInr } from '@/lib/format';
import { rerunBlocker } from '@/lib/inspection';
import { ANGLES, angleLabel } from '@/lib/photos';
import type { Angle } from '@/lib/photos';

const TYPE_ICONS: Record<DamageType, ReactNode> = {
  scratch: <Scribble size={24} weight="duotone" />,
  dent: <Hammer size={24} weight="duotone" />,
  crack: <Lightning size={24} weight="duotone" />,
  'broken part': <LinkBreak size={24} weight="duotone" />,
};

const SEVERITY_LABELS = { 1: 'Minor', 2: 'Moderate', 3: 'Major' } as const;

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function FindingCard({
  finding,
  selected,
  onSelect,
}: {
  finding: DamageFinding;
  selected: boolean;
  onSelect: (angle: Angle) => void;
}) {
  function handleClick() {
    onSelect(finding.angle);
  }
  const percent = Math.round(finding.confidence * 100);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`w-full space-y-4 rounded-2xl border p-5 text-left transition-colors ${
        selected ? 'border-ink bg-raised' : 'border-line bg-surface hover:border-line-strong hover:bg-raised'
      }`}
    >
      <div className="flex items-center gap-4">
        <IconTile>{TYPE_ICONS[finding.type]}</IconTile>
        <div className="min-w-0">
          <p className="truncate text-[17px] font-semibold">{capitalise(finding.panel)}</p>
          <p className="text-[14px] text-muted">
            {capitalise(finding.type)} · {SEVERITY_LABELS[finding.severity]} · seen in {angleLabel(finding.angle)}
          </p>
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between text-[13px] text-subtle">
          <span>AI confidence</span>
          <span className="text-ink">{percent}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-line">
          <div className="h-1.5 rounded-full bg-ink" style={{ width: `${percent}%` }} />
        </div>
      </div>
    </button>
  );
}

function StatusCard({ icon, title, detail, tone }: { icon: ReactNode; title: string; detail: string; tone: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-5">
      <span className={tone}>{icon}</span>
      <div>
        <p className="text-[17px] font-semibold">{title}</p>
        <p className="text-[14px] text-muted">{detail}</p>
      </div>
    </div>
  );
}

function headline(assessment: Assessment): { title: string; subtitle: string } {
  const count = assessment.items.length;
  const photos = assessment.photoQualityOk === false ? 'Some photos are unclear.' : 'Photos are clear.';
  const estimate = `Estimate ${formatInr(assessment.totalInr)}.`;
  if (assessment.needsHuman && count === 0) {
    return { title: 'Needs a human inspector', subtitle: 'The AI could not give a usable answer, so this return goes to the inspector.' };
  }
  if (count === 0) return { title: 'No new damage found', subtitle: `${photos} Nothing changed since pickup.` };
  return { title: `${count} new damage item${count === 1 ? '' : 's'} found`, subtitle: `${photos} ${estimate}` };
}

export function AssessmentPage() {
  const { rentalId = '' } = useParams();
  const rentalData = useRentalData(rentalId, true);
  const { assessment, error, reload } = useAssessment(rentalId);
  const [chosenAngle, setChosenAngle] = useState<Angle | null>(null);
  const [rerunning, setRerunning] = useState(false);
  const [rerunError, setRerunError] = useState<string | null>(null);

  function handleRetry() {
    rentalData.retry();
    reload();
  }

  async function rerun() {
    setRerunning(true);
    setRerunError(null);
    try {
      await runAssessment(rentalId);
      setChosenAngle(null);
      reload();
    } catch (e) {
      setRerunError(e instanceof Error ? e.message : String(e));
    } finally {
      setRerunning(false);
    }
  }

  function handleRerun() {
    void rerun();
  }

  const data = rentalData.data;
  if (!data || assessment === undefined) return <LoadState error={rentalData.error ?? error} onRetry={handleRetry} />;

  if (assessment === null) {
    return (
      <div className="space-y-8">
        <ReturnHeader rental={data.rental} step={4} title="Not assessed yet" subtitle="Upload the return photos, then run Assess damage." />
        <LinkButton to={`/detector/return/${rentalId}`}>Add return photos</LinkButton>
      </div>
    );
  }

  const { title, subtitle } = headline(assessment);
  const firstDamaged = assessment.items[0]?.angle ?? 'front';
  const angle = chosenAngle ?? firstDamaged;
  const counts = Object.fromEntries(ANGLES.map((a) => [a, assessment.items.filter((i) => i.angle === a).length])) as Record<Angle, number>;
  const outcome = assessment.path === 'A' ? 'bill' : assessment.path === 'B' ? 'order' : null;
  const canRerun = rerunBlocker({ ...assessment, orderStatus: assessment.order?.status ?? null }) === null;

  return (
    <div className="space-y-10">
      <ReturnHeader rental={data.rental} step={4} title={title} subtitle={subtitle} />

      <div className="grid grid-cols-[380px_1fr] gap-8">
        <div className="space-y-3">
          {assessment.path && <RouteBadge path={assessment.path} reasons={assessment.routeReasons} />}
          {assessment.items.length === 0 && !assessment.needsHuman ? (
            <StatusCard
              icon={<SealCheck size={30} weight="duotone" />}
              title="Clean return"
              detail="Every angle matches its pickup photo."
              tone="text-path-a"
            />
          ) : (
            assessment.items.map(function renderFinding(finding) {
              return <FindingCard key={finding.id} finding={finding} selected={finding.angle === angle} onSelect={setChosenAngle} />;
            })
          )}
        </div>

        <AnglePhotoCompare angle={angle} onSelect={setChosenAngle} pickup={data.photos.pickup} returned={data.photos.return} counts={counts} />
      </div>

      <div className="flex items-center justify-between border-t border-line pt-8">
        <LinkButton to="/detector" variant="secondary">
          Back to rentals
        </LinkButton>
        <div className="flex items-center gap-4">
          {rerunError && <p className="max-w-md text-[14px] text-danger">{rerunError}</p>}
          {canRerun && (
            <Button
              variant="ghost"
              onClick={handleRerun}
              disabled={rerunning}
              icon={rerunning ? <CircleNotch size={18} className="animate-spin" /> : <ArrowClockwise size={18} />}
            >
              {rerunning ? 'Assessing…' : 'Run again'}
            </Button>
          )}
          {outcome && (
            <LinkButton to={`/detector/return/${rentalId}/${outcome}`} icon={<ArrowRight size={18} weight="bold" />}>
              {outcome === 'bill' ? 'View bill' : 'View order'}
            </LinkButton>
          )}
        </div>
      </div>
    </div>
  );
}
