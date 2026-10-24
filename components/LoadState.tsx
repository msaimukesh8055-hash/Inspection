// components/LoadState.tsx
// Shared loading spinner and error message for pages that fetch from Supabase.
import { CircleNotch, Warning } from '@phosphor-icons/react';

import { Button } from '@/components/Button';

type LoadStateProps = {
  error: string | null;
  onRetry: () => void;
};

export function LoadState({ error, onRetry }: LoadStateProps) {
  if (!error) {
    return (
      <div className="grid place-items-center py-32 text-muted">
        <CircleNotch size={32} className="animate-spin" />
      </div>
    );
  }
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-5 py-24 text-center">
      <Warning size={40} weight="duotone" className="text-danger" />
      <p className="text-muted">Could not load: {error}</p>
      <Button variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
