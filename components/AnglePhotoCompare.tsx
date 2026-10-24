// components/AnglePhotoCompare.tsx
// Front / Rear / Left / Right tabs (with a damage count) over the pickup and return photos for that angle.
import { ANGLES, angleLabel } from '@/lib/photos';
import type { Angle } from '@/lib/photos';

type AnglePhotoCompareProps = {
  angle: Angle;
  onSelect: (angle: Angle) => void;
  pickup: Partial<Record<Angle, string>>;
  returned: Partial<Record<Angle, string>>;
  counts?: Partial<Record<Angle, number>>;
};

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

export function AnglePhotoCompare({ angle, onSelect, pickup, returned, counts = {} }: AnglePhotoCompareProps) {
  const frames = [
    { label: 'Pickup', url: pickup[angle] },
    { label: 'Return', url: returned[angle] },
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1">
        {ANGLES.map(function renderTab(a) {
          return <AngleTab key={a} angle={a} count={counts[a] ?? 0} selected={a === angle} onSelect={onSelect} />;
        })}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {frames.map(function renderFrame(frame) {
          return (
            <figure key={frame.label} className="space-y-2">
              <figcaption className="text-[13px] font-medium uppercase tracking-[0.14em] text-subtle">
                {frame.label} · {angleLabel(angle)}
              </figcaption>
              {frame.url && (
                <img key={frame.url} src={frame.url} alt={`${frame.label} ${angle}`} className="aspect-[4/3] w-full rounded-2xl border border-line bg-raised object-cover" />
              )}
            </figure>
          );
        })}
      </div>
    </div>
  );
}
