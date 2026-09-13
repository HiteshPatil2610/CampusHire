/* ============================================================
   AppStateContext — React port of shared.js `AppState`
   ============================================================
   In the original prototype this was a plain localStorage-backed
   singleton mutated from any page. In React it becomes a context +
   reducer so components re-render correctly when state changes.

   TODO(real-data): This whole context is a stand-in for what a real
   app would get from the backend + a proper client cache (e.g.
   React Query / RTK Query). Once the API exists:
     - resumeScore / readinessScore / profileCompletion should be
       fetched from the student's profile endpoint, not localStorage.
     - appliedDriveIds should come from `GET /api/applications` and
       be mutated via POST/DELETE calls, with localStorage removed.
     - notifReadIds should be server-tracked (`PATCH /api/notifications`).
     - studentOverrides should disappear entirely — student-profile
       edits should PUT/PATCH straight to the backend and refetch.
   See DUMMY_DATA.md for the full inventory.
   ============================================================ */

import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { NOTIFICATIONS, STUDENTS_LIST, CENTRAL_DRIVES } from '../data/mockData';
import { DRIVE_STORE } from '../data/driveStore';

const STATE_KEY = 'ch_state_v1';

const DEFAULTS = {
  resumeScore: 64,
  readinessScore: 78,
  profileCompletion: 72,
  resumeOptimized: false,
  appliedDrives: ['drive_tcs', 'drive_wipro'], // drive IDs already applied (demo seed)
  applicationsMeta: {
    drive_tcs: { appliedAt: '2026-08-02', status: 'interview' },
    drive_wipro: { appliedAt: '2026-07-10', status: 'selected' },
  },
  withdrawHistory: [],
  customDrives: [],
  centralDrives: CENTRAL_DRIVES,
  customStudents: [],
  notifReadIds: [3],
  student: null, // persisted STUDENT field overrides (profile edits)
};

function loadInitial() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULTS,
        ...parsed,
        centralDrives: parsed.centralDrives?.length ? parsed.centralDrives : CENTRAL_DRIVES,
      };
    }
    return { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

function persist(state) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

const AppStateContext = createContext(null);

export function AppStateProvider({ children }) {
  const [state, setState] = useState(loadInitial);

  const update = useCallback((patch) => {
    setState((prev) => {
      const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
      persist(next);
      return next;
    });
  }, []);

  const api = useMemo(
    () => ({
      state,

      // Scores
      setResumeScore: (v) => update({ resumeScore: v }),
      setReadinessScore: (v) => update({ readinessScore: v }),
      setProfileCompletion: (v) => update({ profileCompletion: v }),
      setResumeOptimized: (v) => update({ resumeOptimized: v }),

      // Student roster
      studentsList: [...STUDENTS_LIST, ...(state.customStudents || [])],

      addStudent: (studentData) =>
        update((prev) => {
          const newStudent = {
            id: studentData.roll || `CS${Date.now().toString().slice(-4)}`,
            name: studentData.name,
            roll: studentData.roll || studentData.rollNo || `21CS${Math.floor(100 + Math.random() * 900)}`,
            dept: studentData.dept || studentData.department || 'CSE',
            year: studentData.year || '4th',
            cgpa: parseFloat(studentData.cgpa) || 7.5,
            readiness: Math.round(studentData.cgpa ? parseFloat(studentData.cgpa) * 10 : 70),
            email: studentData.email || `${(studentData.name || 'student').toLowerCase().replace(/\s+/g, '.')}@college.edu`,
            backlogs: parseInt(studentData.backlogs, 10) || 0,
            status: studentData.status || (parseFloat(studentData.cgpa) >= 7.0 ? 'eligible' : 'attention_needed'),
          };
          return {
            ...prev,
            customStudents: [newStudent, ...(prev.customStudents || [])],
          };
        }),

      addStudentsBatch: (batch) =>
        update((prev) => {
          const formatted = batch.map((item, idx) => ({
            id: item.roll || item.rollNo || `STU${Date.now()}_${idx}`,
            name: item.name,
            roll: item.roll || item.rollNo || `21CS${150 + idx}`,
            dept: item.dept || item.department || 'CSE',
            year: item.year || '4th',
            cgpa: parseFloat(item.cgpa) || 7.5,
            readiness: Math.round(item.cgpa ? parseFloat(item.cgpa) * 10 : 70),
            email: item.email,
            backlogs: parseInt(item.backlogs, 10) || 0,
            status: parseFloat(item.cgpa) >= 7.0 ? 'eligible' : 'attention_needed',
          }));
          return {
            ...prev,
            customStudents: [...formatted, ...(prev.customStudents || [])],
          };
        }),

      // Central Drives (Super Admin posted & Dept Admin configured)
      centralDrives: state.centralDrives || CENTRAL_DRIVES,

      updateCentralDrive: (driveId, updates) =>
        update((prev) => {
          const list = prev.centralDrives || CENTRAL_DRIVES;
          return {
            ...prev,
            centralDrives: list.map((d) => (d.id === driveId ? { ...d, ...updates } : d)),
          };
        }),

      saveDriveFullConfig: (driveIdOrCompany, { adminConfig, applicationFields, additionalDetails = {} }) =>
        update((prev) => {
          const targetKey = String(driveIdOrCompany).toLowerCase();
          const matches = (d) =>
            String(d.id).toLowerCase() === targetKey ||
            (d.company && d.company.toLowerCase() === targetKey) ||
            (d.centralId && String(d.centralId).toLowerCase() === targetKey) ||
            (targetKey.includes('tcs') && d.company?.toLowerCase().includes('tcs')) ||
            (targetKey.includes('info') && d.company?.toLowerCase().includes('info')) ||
            (targetKey.includes('wipro') && d.company?.toLowerCase().includes('wipro')) ||
            (targetKey.includes('accen') && d.company?.toLowerCase().includes('accen'));

          const list = prev.centralDrives || CENTRAL_DRIVES;
          const foundInCentral = list.some(matches);

          let updatedCentral = list.map((d) => {
            if (matches(d)) {
              return {
                ...d,
                ...additionalDetails,
                adminConfig: {
                  ...(d.adminConfig || {}),
                  ...adminConfig,
                  configured: true,
                },
                applicationFields: applicationFields !== undefined ? applicationFields : d.applicationFields,
              };
            }
            return d;
          });

          // If not in central drives yet, add it
          if (!foundInCentral && additionalDetails.company) {
            updatedCentral = [
              ...updatedCentral,
              {
                id: `cd_${Date.now()}`,
                postedBy: 'Super Admin',
                postedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                status: 'Open',
                ...additionalDetails,
                adminConfig: {
                  ...adminConfig,
                  configured: true,
                },
                applicationFields: applicationFields || [],
              },
            ];
          }

          const updatedCustom = (prev.customDrives || []).map((d) => {
            if (matches(d)) {
              return {
                ...d,
                ...additionalDetails,
                adminConfig: {
                  ...(d.adminConfig || {}),
                  ...adminConfig,
                  configured: true,
                },
                applicationFields: applicationFields !== undefined ? applicationFields : d.applicationFields,
              };
            }
            return d;
          });

          return {
            ...prev,
            centralDrives: updatedCentral,
            customDrives: updatedCustom,
          };
        }),

      updateDriveAdminConfig: (driveId, adminConfig) =>
        update((prev) => {
          const list = prev.centralDrives || CENTRAL_DRIVES;
          return {
            ...prev,
            centralDrives: list.map((d) =>
              d.id === driveId || d.company?.toLowerCase() === String(driveId).toLowerCase()
                ? {
                    ...d,
                    adminConfig: {
                      ...(d.adminConfig || {}),
                      ...adminConfig,
                      configured: true,
                    },
                  }
                : d
            ),
          };
        }),

      updateDriveApplicationFields: (driveId, applicationFields) =>
        update((prev) => {
          const list = prev.centralDrives || CENTRAL_DRIVES;
          return {
            ...prev,
            centralDrives: list.map((d) =>
              d.id === driveId || d.company?.toLowerCase() === String(driveId).toLowerCase()
                ? { ...d, applicationFields }
                : d
            ),
          };
        }),

      addApplicationFieldToDrive: (driveId, field) =>
        update((prev) => {
          const list = prev.centralDrives || CENTRAL_DRIVES;
          return {
            ...prev,
            centralDrives: list.map((d) => {
              if (d.id !== driveId) return d;
              const currentFields = d.applicationFields || [];
              const existingIdx = currentFields.findIndex((f) => f.key === field.key);
              let updated;
              if (existingIdx >= 0) {
                updated = currentFields.map((f, i) =>
                  i === existingIdx ? { ...f, ...field, enabled: true } : f
                );
              } else {
                updated = [...currentFields, { ...field, enabled: true }];
              }
              return { ...d, applicationFields: updated };
            }),
          };
        }),

      toggleDriveApplicationField: (driveId, fieldKey, prop = 'enabled') =>
        update((prev) => {
          const list = prev.centralDrives || CENTRAL_DRIVES;
          return {
            ...prev,
            centralDrives: list.map((d) => {
              if (d.id !== driveId) return d;
              const currentFields = (d.applicationFields || []).map((f) => {
                if (f.key === fieldKey) {
                  return { ...f, [prop]: !f[prop] };
                }
                return f;
              });
              return { ...d, applicationFields: currentFields };
            }),
          };
        }),

      removeDriveApplicationField: (driveId, fieldKey) =>
        update((prev) => {
          const list = prev.centralDrives || CENTRAL_DRIVES;
          return {
            ...prev,
            centralDrives: list.map((d) => {
              if (d.id !== driveId) return d;
              return {
                ...d,
                applicationFields: (d.applicationFields || []).filter((f) => f.key !== fieldKey),
              };
            }),
          };
        }),

      addCentralDrive: (driveData) =>
        update((prev) => {
          const newDrive = {
            id: `cd_${Date.now()}`,
            postedBy: 'Super Admin',
            postedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            status: 'Open',
            applicants: 0,
            departments: driveData.departments || ['CSE', 'ECE'],
            adminConfig: {
              venue: '',
              reportingTime: '',
              contactPerson: '',
              contactPhone: '',
              additionalNotes: '',
              configured: false,
            },
            applicationFields: [
              { key: 'name', label: 'Full Name', source: 'profile', required: true, enabled: true },
              { key: 'rollNo', label: 'Roll Number', source: 'profile', required: true, enabled: true },
              { key: 'cgpa', label: 'Current CGPA', source: 'profile', required: true, enabled: true },
              { key: 'resume', label: 'Resume (PDF)', source: 'resume', required: true, enabled: true },
              { key: 'backlogs', label: 'Active Backlogs', source: 'profile', required: true, enabled: true },
              { key: 'phone', label: 'Phone Number', source: 'profile', required: true, enabled: true },
              { key: 'skills', label: 'Technical Skills', source: 'profile', required: false, enabled: true },
            ],
            ...driveData,
          };
          return {
            ...prev,
            centralDrives: [newDrive, ...(prev.centralDrives || CENTRAL_DRIVES)],
          };
        }),

      // Drive applications & custom drives (merged with central drives config)
      allDrives: (() => {
        const cdList = state.centralDrives || CENTRAL_DRIVES;
        const storeWithConfig = DRIVE_STORE.map((d) => {
          const match = cdList.find(
            (c) => c.company.toLowerCase() === d.company.toLowerCase() || c.id === d.id
          );
          if (match) {
            return {
              ...d,
              adminConfig: match.adminConfig,
              applicationFields: match.applicationFields,
              postedBy: match.postedBy || 'Super Admin',
            };
          }
          return d;
        });

        const extraCentral = cdList
          .filter(
            (c) => !storeWithConfig.some((d) => d.company.toLowerCase() === c.company.toLowerCase())
          )
          .map((c) => ({
            id: c.id,
            company: c.company,
            logoText: (c.company || 'CO').slice(0, 4).toUpperCase(),
            role: c.role,
            ctc: c.ctc,
            minCgpa: c.minCgpa || 6.5,
            maxBacklogs: c.maxBacklogs || 0,
            departments: c.departments || ['CSE'],
            driveDate: c.date,
            driveDateRaw: c.date,
            deadline: c.deadline,
            driveDeadlineRaw: c.deadline,
            rounds: c.rounds || 'Assessment → Interview',
            stage: 'eligible',
            stageLabel: c.status === 'Open' ? 'Application Open' : c.status,
            statusBadge: {
              text: c.status || 'Open',
              cls: c.status === 'Open' ? 'status-open' : c.status === 'Upcoming' ? 'status-upcoming' : 'status-closed',
            },
            open: c.status === 'Open',
            applicants: c.applicants || 0,
            adminConfig: c.adminConfig,
            applicationFields: c.applicationFields,
            postedBy: c.postedBy || 'Super Admin',
          }));

        return [...storeWithConfig, ...extraCentral, ...(state.customDrives || [])];
      })(),

      addDrive: (driveData) =>
        update((prev) => {
          const newDrive = {
            id: `drive_custom_${Date.now()}`,
            logoText: (driveData.company || 'CO').slice(0, 4).toUpperCase(),
            statusBadge: { text: 'Open', cls: 'status-open' },
            applicants: 0,
            open: true,
            stage: 'eligible',
            stageLabel: 'Application Open',
            stepper: [
              { label: 'Apply', done: false, current: true },
              { label: 'Assessment', done: false, current: false },
              { label: 'Interview', done: false, current: false },
              { label: 'Offer', done: false, current: false },
            ],
            departments: driveData.departments?.length ? driveData.departments : ['CSE', 'ECE', 'Mech', 'Civil'],
            maxBacklogs: driveData.maxBacklogs ?? 0,
            ...driveData,
          };
          return {
            ...prev,
            customDrives: [newDrive, ...(prev.customDrives || [])],
          };
        }),

      isApplied: (driveId) =>
        (state.appliedDrives || []).includes(driveId) ||
        (state.appliedDrives || []).includes(Number(driveId)) ||
        (state.appliedDrives || []).includes(String(driveId)),

      applyDrive: (driveId, customValues = {}) =>
        update((prev) => {
          const strId = String(driveId);
          const currentList = prev.appliedDrives || [];
          const exists = currentList.some((id) => String(id) === strId);
          return {
            ...prev,
            appliedDrives: exists ? currentList : [...currentList, driveId],
            applicationsMeta: {
              ...(prev.applicationsMeta || {}),
              [driveId]: {
                appliedAt: new Date().toISOString().split('T')[0],
                status: 'applied',
                ...customValues,
              },
            },
          };
        }),

      withdrawDrive: (driveId, reason = 'Not specified') =>
        update((prev) => {
          const strId = String(driveId);
          return {
            ...prev,
            appliedDrives: (prev.appliedDrives || []).filter((id) => String(id) !== strId),
            withdrawHistory: [
              ...(prev.withdrawHistory || []),
              {
                driveId,
                withdrawnAt: new Date().toISOString(),
                reason,
              },
            ],
          };
        }),

      // Notifications
      isNotifRead: (id) => (state.notifReadIds || []).includes(id),
      markNotifRead: (id) =>
        update((prev) => ({
          ...prev,
          notifReadIds: [...(prev.notifReadIds || []), id],
        })),
      markAllNotifsRead: () =>
        update({ notifReadIds: NOTIFICATIONS.map((n) => n.id) }),

      // Persisted student profile edit overrides
      getStudentOverrides: () => state.student,
      saveStudentOverrides: (student) => update({ student }),
      saveStudent: (student) => update({ student }),

      reset: () => {
        setState({ ...DEFAULTS });
        persist({ ...DEFAULTS });
      },
      resetState: () => {
        setState({ ...DEFAULTS });
        persist({ ...DEFAULTS });
      },
    }),
    [state, update]
  );

  return <AppStateContext.Provider value={api}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}

