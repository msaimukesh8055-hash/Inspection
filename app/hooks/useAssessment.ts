// app/hooks/useAssessment.ts
// Loads the assessment for a rental (undefined while loading, null if none yet).
import { useCallback, useEffect, useState } from 'react';

import { fetchAssessment } from '@/lib/assessments';
import type { Assessment } from '@/lib/assessments';

type AssessmentState = {
  assessment: Assessment | null | undefined;
  error: string | null;
  reload: () => void;
};

export function useAssessment(rentalId: string): AssessmentState {
  const [assessment, setAssessment] = useState<Assessment | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

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

  function reload() {
    setError(null);
    load();
  }

  return { assessment, error, reload };
}
