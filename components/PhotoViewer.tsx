// components/PhotoViewer.tsx
// Angle list on the left; the selected angle's pickup and return photos large, side by side.
import { ImageSquare } from '@phosphor-icons/react';
import { useState } from 'react';

import { ANGLES, angleLabel } from '@/lib/photos';
import type { Angle } from '@/lib/photos';

type PhotoViewerProps = {
  pickup: Partial<Record<Angle, string>>;
  returned: Partial<Record<Angle, string>>;
};

function Frame({ label, url }: { label: string; url: string | undefined }) {
  return (
    <figure className="space-y-3">
      <figcaption className="text-[13px] font-medium uppercase tracking-[0.14em] text-subtle">{label}</figcaption>
      {url ? (
        <img key={url} src={url} alt={label} className="aspect-[4/3] w-full rounded-2xl border border-line bg-raised object-cover" />
      ) : (
        <div className="grid aspect-[4/3] w-full place-items-center rounded-2xl border border-dashed border-line text-subtle">
          <ImageSquare size={36} weight="duotone" />
        </div>
      )}
    </figure>
  );
}

function AngleButton({
  angle,
  thumbnail,
  selected,
  onSelect,
}: {
  angle: Angle;
  thumbnail: string | undefined;
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
      className={`flex w-full items-center gap-4 rounded-xl border p-2 pr-4 text-left transition-colors ${
        selected ? 'border-ink bg-raised' : 'border-line hover:border-line-strong hover:bg-raised'
      }`}
    >
      {thumbnail ? (
        <img src={thumbnail} alt="" className="h-12 w-16 rounded-lg object-cover" />
      ) : (
        <span className="h-12 w-16 rounded-lg bg-raised" />
      )}
      <span className={`text-[15px] font-medium ${selected ? 'text-ink' : 'text-muted'}`}>{angleLabel(angle)}</span>
    </button>
  );
}

export function PhotoViewer({ pickup, returned }: PhotoViewerProps) {
  const [selected, setSelected] = useState<Angle>('front');

  return (
    <div className="grid grid-cols-[200px_1fr] gap-8">
      <div className="space-y-2">
        {ANGLES.map(function renderAngle(angle) {
          return (
            <AngleButton
              key={angle}
              angle={angle}
              thumbnail={returned[angle]}
              selected={selected === angle}
              onSelect={setSelected}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-6">
        <Frame label={`Pickup · ${angleLabel(selected)}`} url={pickup[selected]} />
        <Frame label={`Return · ${angleLabel(selected)}`} url={returned[selected]} />
      </div>
    </div>
  );
}
