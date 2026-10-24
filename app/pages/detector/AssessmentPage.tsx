// app/pages/detector/AssessmentPage.tsx
// Return step 4: what the damage agent found. Prices and the A/B route arrive in Milestone 5.
import { ArrowClockwise, CircleNotch, Hammer, Lightning, LinkBreak, Scribble, SealCheck, UserFocus } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';

import { useRentalData } from '@/app/hooks/useRentalData';
import { Button, LinkButton } from '@/components/Button';
import { IconTile } from '@/components/IconTile';
import { LoadState } from '@/components/LoadState';
import { ReturnHeader } from '@/components/ReturnHeader';
import { fetchAssessment, runAssessment } from '@/lib/assessments';
import type { Assessment, DamageFinding, DamageType } from '@/lib/assessments';
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

function AngleTab({
  angle,
  count,
  selected,
  onSelect,
}: {
  angle: Angle;
  count: number;
  selected: boolean;
  onSelect: (angle: Angle) => void;
}) {
  function handleClick() {
    onSelect(angle);
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex h-10 items-center gap-2 rounded-full px-4 text-[14px] font-medium transition-colors ${
        selected ? 'bg-ink text-black' : 'text-muted hover:bg-hover hover:text-ink'
      }`}
    >
      {angleLabel(angle)}
      {count > 0 && (
        <span className={`grid size-5 place-items-center rounded-full text-[11px] ${selected ? 'bg-black text-ink' : 'bg-path-b text-black'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function headline(assessment: Assessment): { title: string; subtitle: string } {
  if (assessment.needsHuman) {
    return { title: 'Needs a human inspector', subtitle: 'The AI could not give a usable answer, so this return goes to the inspector.' };
  }
  const count = assessment.items.length;
  const photos = assessment.photoQualityOk === false ? 'Some photos are unclear.' : 'Photos are clear.';
  if (count === 0) return { title: 'No new damage found', subtitle: `${photos} Nothing changed since pickup.` };
  return { title: `${count} new damage item${count === 1 ? '' : 's'} found`, subtitle: `${photos} Pricing and routing arrive in Milestone 5.` };
}

export function AssessmentPage() {
  const { rentalId = '' } = useParams();
  const rentalData = useRentalData(rentalId, true);
  const [assessment, setAssessment] = useState<Assessment | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [chosenAngle, setChosenAngle] = useState<Angle | null>(null);
  const [rerunning, setRerunning] = useState(false);

  const load = useCallback(
    function loadAssessment() {
      fetchAssessment(rentalId)
        .then(setAssessment)
        .catch(function handleError(e: unknown) {
          setError(e instanceof Error ? e.message : String(e));
        });
    },
    [rentalId],
  );

  useEffect(load, [load]);

  function handleRetry() {
    setError(null);
    rentalData.retry();
    load();
  }

  async function rerun() {
    setRerunning(true);
    setError(null);
    try {
      await runAssessment(rentalId);
      setChosenAngle(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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
  const pickupUrl = data.photos.pickup[angle];
  const returnUrl = data.photos.return[angle];

  return (
    <div className="space-y-10">
      <ReturnHeader rental={data.rental} step={4} title={title} subtitle={subtitle} />

      <div className="grid grid-cols-[380px_1fr] gap-8">
        <div className="space-y-3">
          {assessment.needsHuman ? (
            <StatusCard
              icon={<UserFocus size={30} weight="duotone" />}
              title="Sent to inspection"
              detail="Marked needs human. The inspector will review all photos."
              tone="text-path-b"
            />
          ) : assessment.items.length === 0 ? (
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

        <div className="space-y-4">
          <div className="flex items-center gap-1">
            {ANGLES.map(function renderTab(a) {
              return <AngleTab key={a} angle={a} count={counts[a]} selected={a === angle} onSelect={setChosenAngle} />;
            })}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Pickup', url: pickupUrl },
              { label: 'Return', url: returnUrl },
            ].map(function renderFrame(frame) {
              return (
                <figure key={frame.label} className="space-y-2">
                  <figcaption className="text-[13px] font-medium uppercase tracking-[0.14em] text-subtle">
                    {frame.label} · {angleLabel(angle)}
                  </figcaption>
                  {frame.url && (
                    <img src={frame.url} alt={`${frame.label} ${angle}`} className="aspect-[4/3] w-full rounded-2xl border border-line object-cover" />
                  )}
                </figure>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-line pt-8">
        <LinkButton to="/detector" variant="secondary">
          Back to rentals
        </LinkButton>
        <div className="flex items-center gap-5">
          {error && <p className="max-w-md text-[14px] text-danger">{error}</p>}
          <Button
            variant="secondary"
            onClick={handleRerun}
            disabled={rerunning}
            icon={rerunning ? <CircleNotch size={18} className="animate-spin" /> : <ArrowClockwise size={18} />}
          >
            {rerunning ? 'Assessing…' : 'Run again'}
          </Button>
        </div>
      </div>
    </div>
  );
}
