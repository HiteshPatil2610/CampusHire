/* ============================================================
   driveService — TODO(real-data): replace DRIVES / CENTRAL_DRIVES /
   DRIVE_STORE mock arrays with these. See DUMMY_DATA.md.
   ============================================================ */
import { api } from './client';

export const driveService = {
  // GET /api/drives -> DRIVES-shaped array, scoped to the logged-in student's dept + eligibility
  listForStudent: () => api.get('/drives'),

  // GET /api/drives/central -> CENTRAL_DRIVES-shaped array (TPO-posted, cross-department)
  listCentral: () => api.get('/drives/central'),

  // GET /api/drives?dept= -> drives for a given department (dept admin view)
  listForDept: (dept) => api.get(`/drives?dept=${dept}`),

  // POST /api/drives (dept admin "post own drive") -> created drive
  create: (payload) => api.post('/drives', payload),

  // POST /api/drives/central (super admin "post central drive") -> created drive
  createCentral: (payload) => api.post('/drives/central', payload),

  // PATCH /api/drives/:id/admin-config { venue, reportingTime, contactPerson, contactPhone, additionalNotes }
  updateAdminConfig: (driveId, config) => api.patch(`/drives/${driveId}/admin-config`, config),

  // POST /api/drives/:id/apply { formValues } -> { applicationId }
  apply: (driveId, formValues) => api.post(`/drives/${driveId}/apply`, formValues),

  // PUT /api/applications/:applicationId { formValues } -> updated application
  updateApplication: (applicationId, formValues) => api.put(`/applications/${applicationId}`, formValues),

  // DELETE /api/applications/:applicationId -> { success: true }
  withdraw: (applicationId) => api.delete(`/applications/${applicationId}`),

  // GET /api/applications -> [{ driveId, applicationId, status }] for the logged-in student
  myApplications: () => api.get('/applications'),
};
