// app/state/returnDraft.tsx
// The return photos chosen so far, per rental, kept while the Detector moves between steps.
import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

import type { Angle } from '@/lib/photos';
import type { ChosenPhoto } from '@/lib/returnPhotos';

export type Draft = {
  photos: Partial<Record<Angle, ChosenPhoto>>;
};

const EMPTY_DRAFT: Draft = { photos: {} };

/** A new draft, or a function of the latest draft (safe when several photos finish at once). */
type DraftUpdate = Draft | ((current: Draft) => Draft);

type ReturnDrafts = {
  drafts: Record<string, Draft>;
  setDraft: (rentalId: string, update: DraftUpdate) => void;
};

const ReturnDraftContext = createContext<ReturnDrafts | null>(null);

export function ReturnDraftProvider({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  function setDraft(rentalId: string, update: DraftUpdate) {
    setDrafts(function apply(prev) {
      const current = prev[rentalId] ?? EMPTY_DRAFT;
      return { ...prev, [rentalId]: typeof update === 'function' ? update(current) : update };
    });
  }

  return <ReturnDraftContext.Provider value={{ drafts, setDraft }}>{children}</ReturnDraftContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useReturnDraft(rentalId: string): [Draft, (update: DraftUpdate) => void] {
  const value = useContext(ReturnDraftContext);
  if (!value) throw new Error('useReturnDraft must be used inside ReturnDraftProvider');
  const { drafts, setDraft } = value;

  function setThisDraft(update: DraftUpdate) {
    setDraft(rentalId, update);
  }

  return [drafts[rentalId] ?? EMPTY_DRAFT, setThisDraft];
}
