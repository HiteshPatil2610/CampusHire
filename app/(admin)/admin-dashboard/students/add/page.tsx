import { requireDepartmentAdmin } from '@/lib/auth';
import { AddStudentForm } from '@/components/admin/students/add-student-form';
import { getDepartmentSettings } from '@/features/settings/queries/get-settings';

export const dynamic = 'force-dynamic';

/**
 * Add Student Page
 * 
 * Manual single-student enrollment form.
 * Department is locked to admin's department (derived server-side).
 */
export default async function AddStudentPage() {
  // Auth: department admin only
  const { department } = await requireDepartmentAdmin();
  const settings = await getDepartmentSettings(department.id);

  return (
    <div style={{ padding: '24px 32px', maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1
          className="page-title"
          style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}
        >
          Add Student
        </h1>
        <p
          className="text-secondary"
          style={{ fontSize: 13, color: 'var(--text-secondary)' }}
        >
          Enroll an individual student manually into the {department.code}{' '}
          placement roster.
        </p>
      </div>

      <AddStudentForm
        departmentCode={department.code}
        defaultPassoutYear={settings.defaultPassoutYear}
      />
    </div>
  );
}
