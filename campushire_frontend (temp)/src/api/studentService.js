/* ============================================================
   studentService — TODO(real-data): replace mockData.STUDENT and
   AppState's student-score fields with these. See DUMMY_DATA.md.
   ============================================================ */
import { api } from './client';

export const studentService = {
  // GET /api/students/me -> full STUDENT-shaped object (see data/mockData.js STUDENT for the field list)
  getMe: () => api.get('/students/me'),

  // PUT /api/students/me { ...profile fields } -> updated STUDENT object
  updateProfile: (profile) => api.put('/students/me', profile),

  // POST /api/students/me/resume (multipart) -> { resumeScore, url }
  uploadResume: (formData) => api.post('/students/me/resume', formData, {
    headers: {}, // let the browser set multipart boundary
  }),

  // POST /api/students/me/resume/optimize -> { resumeScore, recommendations[] }
  optimizeResume: () => api.post('/students/me/resume/optimize'),

  // POST /api/students/me/assessment { answers: [...] } -> { readinessScore }
  submitAssessment: (answers) => api.post('/students/me/assessment', { answers }),

  // GET /api/students?dept=&search=&status= -> STUDENTS_LIST-shaped array (admin/super-admin directory views)
  list: (params) => api.get(`/students?${new URLSearchParams(params)}`),

  // POST /api/students (single manual add, dept admin) -> created student
  create: (payload) => api.post('/students', payload),

  // POST /api/students/import (multipart Excel/CSV) -> { rows: EXCEL_ROWS-shaped preview }
  bulkImport: (formData) => api.post('/students/import', formData, { headers: {} }),
};
