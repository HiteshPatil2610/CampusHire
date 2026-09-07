/* ============================================================
   useStudent — React port of the `hydrateStudent()` IIFE in shared.js
   ============================================================
   TODO(real-data): Replace the `STUDENT` import with a fetch from
   `GET /api/students/me` (see api/studentService.js). Once that's
   wired up, delete this merge-with-mock logic entirely — the API
   response becomes the single source of truth and AppState's
   `student` override field goes away.
   ============================================================ */

import { useMemo } from 'react';
import { STUDENT } from '../data/mockData';
import { useAppState } from '../context/AppStateContext';

export function useStudent() {
  const { state } = useAppState();

  return useMemo(() => {
    const overrides = state.student || {};
    return {
      ...STUDENT,
      ...overrides,
      resumeScore: state.resumeScore,
      readinessScore: state.readinessScore,
      profileCompletion: state.profileCompletion,
    };
  }, [state]);
}
