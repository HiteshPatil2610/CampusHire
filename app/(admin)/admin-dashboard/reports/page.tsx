import { requireDepartmentAdmin } from "@/lib/auth";
import { getAdminDashboardStats } from "@/features/students/queries/get-admin-dashboard-stats";
import { prisma } from "@/lib/prisma";

// Every query here is scoped to the signed-in admin's department, so this
// page can never be prerendered - it has no meaning without a session.
export const dynamic = 'force-dynamic';


export default async function ReportsPage() {
  const { department } = await requireDepartmentAdmin();

  // Get dashboard stats
  const stats = await getAdminDashboardStats();

  // Derived stats. "Unplaced" is everyone registered and still seeking:
  // total, minus those with an offer, minus those not yet registered, minus
  // those who opted out of placement entirely.
  const optedOutStudents = stats.optedOutStudents;
  const unplacedStudents =
    stats.totalStudents -
    stats.placedStudents -
    stats.pendingStudents -
    optedOutStudents;

  // Get total drives
  const totalDrives = await prisma.drive.count({
    where: { departmentId: department.id },
  });

  const placementRate = stats.placementRate;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Reports & Analytics</h1>
        <p className="text-secondary" style={{ fontSize: 13, margin: "4px 0 0" }}>
          Placement statistics for {department.name} department
        </p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: "16px 20px" }}>
          <div className="text-muted" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>
            Total Students
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginTop: 4 }}>
            {stats.totalStudents}
          </div>
          <div className="text-secondary" style={{ fontSize: 11 }}>Registered in {department.code}</div>
        </div>

        <div className="card" style={{ padding: "16px 20px" }}>
          <div className="text-muted" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>
            Placed
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--teal)", marginTop: 4 }}>
            {stats.placedStudents}
          </div>
          <div className="text-secondary" style={{ fontSize: 11 }}>Students with offers</div>
        </div>

        <div className="card" style={{ padding: "16px 20px" }}>
          <div className="text-muted" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>
            Unplaced
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--amber)", marginTop: 4 }}>
            {unplacedStudents}
          </div>
          <div className="text-secondary" style={{ fontSize: 11 }}>Seeking placement</div>
        </div>

        <div className="card" style={{ padding: "16px 20px" }}>
          <div className="text-muted" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>
            Placement Rate
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--purple)", marginTop: 4 }}>
            {placementRate}%
          </div>
          <div className="text-secondary" style={{ fontSize: 11 }}>
            {stats.placedStudents}/{stats.totalStudents} placed
          </div>
        </div>

        <div className="card" style={{ padding: "16px 20px" }}>
          <div className="text-muted" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>
            Posted Drives
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--accent)", marginTop: 4 }}>
            {totalDrives}
          </div>
          <div className="text-secondary" style={{ fontSize: 11 }}>Active & past drives</div>
        </div>

        <div className="card" style={{ padding: "16px 20px" }}>
          <div className="text-muted" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>
            Opted Out
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-muted)", marginTop: 4 }}>
            {optedOutStudents}
          </div>
          <div className="text-secondary" style={{ fontSize: 11 }}>Not seeking placement</div>
        </div>
      </div>

      {/* Placement Breakdown */}
      <div className="card">
        <h3 className="section-title">Placement Summary</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16, marginTop: 16 }}>
          <div
            style={{
              padding: "14px 16px",
              background: "var(--teal-light)",
              border: "1px solid var(--teal)",
              borderRadius: 8,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--teal)", marginBottom: 4 }}>
              ✓ Placed Students
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--teal)" }}>
              {stats.placedStudents}
            </div>
          </div>

          <div
            style={{
              padding: "14px 16px",
              background: "var(--amber-light)",
              border: "1px solid var(--amber)",
              borderRadius: 8,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--amber)", marginBottom: 4 }}>
              ⏳ Unplaced & Seeking
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--amber)" }}>
              {unplacedStudents}
            </div>
          </div>

          <div
            style={{
              padding: "14px 16px",
              background: "var(--surface-1)",
              border: "1px solid var(--border)",
              borderRadius: 8,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
              ○ Opted Out
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-muted)" }}>
              {optedOutStudents}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
