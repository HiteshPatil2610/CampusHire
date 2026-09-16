import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth";
import { getDepartmentDetail } from "@/features/departments/queries/get-department-detail";
import StatusBadge from "@/components/ui/status-badge";
import KpiCard from "@/components/shared/kpi-card";

interface Props {
  params: Promise<{
    id: string;
  }>;
}

export default async function DepartmentDetailPage({ params }: Props) {
  await requireSuperAdmin();
  
  const awaitedParams = await params;
  const department = await getDepartmentDetail({ id: awaitedParams.id });

  if (!department) {
    notFound();
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Link 
          href="/super-admin-dashboard/departments" 
          className="text-muted"
          style={{ fontSize: 13, textDecoration: 'none' }}
        >
          ← Back to Departments
        </Link>
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 className="page-title" style={{ marginBottom: 0 }}>
            {department.name}
          </h1>
          {department.isActive ? (
            <StatusBadge variant="teal">Active</StatusBadge>
          ) : (
            <StatusBadge variant="red">Inactive</StatusBadge>
          )}
        </div>
        <div className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>
          Department Code: <code style={{ fontSize: 12 }}>{department.code}</code>
        </div>
      </div>

      {/* Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
          marginBottom: 28,
        }}
      >
        <KpiCard value={department.studentCount} label="Total Students" />
        <KpiCard value={department.adminCount} label="Department Admins" />
        <KpiCard value={department.driveCount} label="Drives Posted" />
      </div>

      {/* Assigned Admins */}
      <div className="card">
        <h3 className="section-title" style={{ marginBottom: 14 }}>
          Assigned Department Admins
        </h3>
        {department.admins.length === 0 ? (
          <div className="text-muted" style={{ padding: '20px 0', textAlign: 'center' }}>
            No admins assigned to this department
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Admin</th>
                  <th>Assigned Date</th>
                </tr>
              </thead>
              <tbody>
                {department.admins.map((admin) => (
                  <tr key={admin.id}>
                    <td>
                      {admin.user.name ? (
                        <>
                          <div style={{ fontWeight: 600 }}>
                            {admin.user.name}
                          </div>
                          <div className="text-muted" style={{ fontSize: 11 }}>
                            {admin.user.email}
                          </div>
                        </>
                      ) : (
                        admin.user.email
                      )}
                    </td>
                    <td>
                      {new Date(admin.assignedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
