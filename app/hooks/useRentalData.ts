// app/hooks/useRentalData.ts
// Loads a rental with its photo URLs for the return pages.
import { useCallback, useEffect, useState } from 'react';

import type { Angle, Stage } from '@/lib/photos';
import { fetchPhotoUrls, fetchRental } from '@/lib/rentals';
import type { RentalSummary } from '@/lib/rentals';

export type RentalData = {
  rental: RentalSummary;
  photos: Record<Stage, Partial<Record<Angle, string>>>;
};

type RentalDataState = {
  data: RentalData | null;
  error: string | null;
  retry: () => void;
};

export function useRentalData(rentalId: string, withReturnPhotos: boolean): RentalDataState {
  const [data, setData] = useState<RentalData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    function loadRentalData() {
      Promise.all([
        fetchRental(rentalId),
        fetchPhotoUrls(rentalId, 'pickup'),
        withReturnPhotos ? fetchPhotoUrls(rentalId, 'return') : Promise.resolve({}),
      ])
        .then(function handleLoaded([rental, pickup, returned]) {
          setData({ rental, photos: { pickup, return: returned } });
        })
        .catch(function handleError(e: unknown) {
          setError(e instanceof Error ? e.message : String(e));
        });
    },
    [rentalId, withReturnPhotos],
  );

  useEffect(load, [load]);

  function retry() {
    setError(null);
    load();
  }

  return { data, error, retry };
}
