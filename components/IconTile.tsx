// components/IconTile.tsx
// Rounded square that frames a duotone icon. The richer look comes from the soft inner border.
import type { ReactNode } from 'react';

type IconTileProps = {
  children: ReactNode;
  size?: 'md' | 'lg';
};

export function IconTile({ children, size = 'md' }: IconTileProps) {
  const box = size === 'lg' ? 'size-16 rounded-2xl' : 'size-12 rounded-xl';
  return (
    <span
      className={`${box} grid shrink-0 place-items-center border border-line bg-gradient-to-b from-raised to-surface text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]`}
    >
      {children}
    </span>
  );
}
