import client from './client'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DepartmentOut {
  id: string; department_name: string; department_code: string
  status: boolean; created_at: string; student_count?: number; admin_count?: number
}

export interface AdminOut {
  id: string; email: string; role: string; status: string
  full_name: string; phone_number?: string
  departments: DepartmentOut[]; last_login_at?: string; created_at: string
}

export interface StudentListItem {
  user_id: string; profile_id: string; full_name: string; roll_number: string
  email: string; department_name: string; department_code: string
  current_year: number; current_semester: number
  profile_completion_percentage: number; status: string
}

export interface PaginatedStudents {
  items: StudentListItem[]; total: number
  page: number; page_size: number; pages: number
}

export interface ImportPreviewResponse {
  total_rows: number; valid_rows: number; invalid_rows: number
  preview: { row_number: number; email?: string; roll_number?: string; status: string; error_message?: string }[]
}

// ── Departments ───────────────────────────────────────────────────────────────

export const adminApi = {
  // Departments
  listDepartments: () =>
    client.get<DepartmentOut[]>('/admin/departments'),

  createDepartment: (data: { department_name: string; department_code: string; status?: boolean }) =>
    client.post<DepartmentOut>('/admin/departments', data),

  updateDepartment: (id: string, data: Partial<{ department_name: string; department_code: string; status: boolean }>) =>
    client.patch<DepartmentOut>(`/admin/departments/${id}`, data),

  deleteDepartment: (id: string) =>
    client.delete<{ message: string }>(`/admin/departments/${id}`),

  // Admin accounts
  listAdmins: () =>
    client.get<AdminOut[]>('/admin/accounts'),

  createAdmin: (data: { email: string; full_name: string; phone_number?: string; role?: string; department_ids?: string[] }) =>
    client.post<{ id: string; message: string }>('/admin/accounts', data),

  updateAdmin: (id: string, data: { full_name?: string; phone_number?: string; status?: string; department_ids?: string[] }) =>
    client.patch<{ message: string }>(`/admin/accounts/${id}`, data),

  resetAdminPassword: (id: string) =>
    client.post<{ message: string }>(`/admin/accounts/${id}/reset-password`),

  // Students
  listStudents: (params?: { department_id?: string; year?: number; search?: string; page?: number; page_size?: number }) =>
    client.get<PaginatedStudents>('/admin/students', { params }),

  addStudent: (data: { email: string; full_name: string; roll_number: string; phone_number?: string; department_id: string; current_year: number; current_semester?: number }) =>
    client.post<{ user_id: string; message: string }>('/admin/students', data),

  // Excel import
  previewImport: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return client.post<ImportPreviewResponse>('/admin/students/import/preview', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  confirmImport: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return client.post<{ imported_count: number; failed_count: number; message: string }>(
      '/admin/students/import/confirm', form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
  },
}
