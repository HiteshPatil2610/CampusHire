/* ============================================================
   adminService — dept-admin + super-admin scoped endpoints.
   TODO(real-data): replace DEPT_MATRIX, STUDENTS_LIST filtering,
   admin/super-admin dashboards' KPI + activity-feed mock content.
   See DUMMY_DATA.md.
   ============================================================ */
import { api } from './client';

export const adminService = {
  // GET /api/admin/overview -> KPIs + attention items + activity feed for the dept admin's own department
  getDeptOverview: () => api.get('/admin/overview'),

  // GET /api/admin/reports -> CTC summary, placement status chart data, company table
  getReports: () => api.get('/admin/reports'),

  // POST /api/admin/announcements { title, body, audience } -> created announcement
  postAnnouncement: (payload) => api.post('/admin/announcements', payload),
};

export const superAdminService = {
  // GET /api/super-admin/overview -> institution-wide KPIs + charts + alerts
  getOverview: () => api.get('/super-admin/overview'),

  // GET /api/super-admin/departments -> DEPT_MATRIX-shaped array
  getDeptMatrix: () => api.get('/super-admin/departments'),

  // POST /api/super-admin/departments { name } / PATCH .../:id / DELETE .../:id (archive)
  createDepartment: (payload) => api.post('/super-admin/departments', payload),
  updateDepartment: (id, payload) => api.patch(`/super-admin/departments/${id}`, payload),
  archiveDepartment: (id) => api.delete(`/super-admin/departments/${id}`),

  // GET /api/super-admin/admin-accounts -> staff accounts list
  listAdminAccounts: () => api.get('/super-admin/admin-accounts'),
  // POST /api/super-admin/admin-accounts { name, email, department, role } -> created account
  createAdminAccount: (payload) => api.post('/super-admin/admin-accounts', payload),

  // GET /api/super-admin/audit-log?from=&to=&actor= -> audit trail entries
  getAuditLog: (params) => api.get(`/super-admin/audit-log?${new URLSearchParams(params)}`),

  // GET /api/super-admin/settings -> platform config (placement season dates, email templates, etc.)
  getSystemSettings: () => api.get('/super-admin/settings'),
  updateSystemSettings: (payload) => api.put('/super-admin/settings', payload),
};
