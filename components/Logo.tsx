// components/Logo.tsx
// Wordmark: a white tile with a scan mark, then the name.
import { Scan } from '@phosphor-icons/react';
import { Link } from 'react-router';

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-3" aria-label="I Inspect home">
      <span className="grid size-9 place-items-center rounded-lg bg-ink text-black">
        <Scan size={22} weight="bold" />
      </span>
      <span className="text-[19px] font-semibold tracking-tight">I Inspect</span>
    </Link>
  );
}
