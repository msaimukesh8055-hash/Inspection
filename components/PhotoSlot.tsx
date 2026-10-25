// components/PhotoSlot.tsx
// One angle's photo picker: an empty dashed tile, or the chosen photo with a Replace hint.
import { ImageSquare } from '@phosphor-icons/react';
import type { ChangeEvent } from 'react';

import { angleLabel } from '@/lib/photos';
import type { Angle, Stage } from '@/lib/photos';

type PhotoSlotProps = {
  angle: Angle;
  stage: Stage;
  url: string | undefined;
  onFile: (angle: Angle, file: File) => void;
};

export function PhotoSlot({ angle, stage, url, onFile }: PhotoSlotProps) {
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
          <img src={url} alt={`${angleLabel(angle)} ${stage}`} className="aspect-[4/3] w-full object-cover" />
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
