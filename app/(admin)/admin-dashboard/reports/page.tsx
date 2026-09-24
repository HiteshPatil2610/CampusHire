import { requireDepartmentAdmin } from "@/lib/auth";
import { getDepartmentInsights } from "@/features/students/queries/get-department-insights";
import { InsightsFilters } from "@/features/students/components/insights-filters";
import BarChart from "@/components/shared/bar-chart";
import DonutChart from "@/components/shared/donut-chart";
import KpiCard from "@/components/shared/kpi-card";

// Every query here is scoped to the signed-in admin's department, so this
// page can never be prerendered - it has no meaning without a session.
export const dynamic = 'force-dynamic';

interface ReportsPageProps {
  searchParams: Promise<{ batch?: string; semester?: string }>;
}

/**
 * Department Insights (Phase 9, Item 20) — the same "Reports & Analytics"
 * tab, redesigned rather than replaced. Eligible/Applied/Placed is a funnel:
 * each rate is a fraction of the eligible pool, not of the whole roster, so a
 * student who never registered or opted out doesn't silently drag a rate
 * down. Batch and semester filter every metric together (one query, so
 * nothing can disagree). No line chart: there is no stored history to plot,
 * and the tracker is explicit that history is never invented for one.
 */
export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const { department } = await requireDepartmentAdmin();
  const params = await searchParams;
  const batchYear = params.batch ? Number.parseInt(params.batch, 10) : null;
  const semester = params.semester ? Number.parseInt(params.semester, 10) : null;

  const insights = await getDepartmentInsights({
    batchYear: Number.isFinite(batchYear) ? batchYear : null,
    semester: Number.isFinite(semester) ? semester : null,
  });

  const notYetEligible = insights.totalStudents - insights.eligibleStudents;
  const notPlaced = insights.eligibleStudents - insights.placedStudents;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Department Insights</h1>
        <p className="text-secondary" style={{ fontSize: 13, margin: "4px 0 0" }}>
          Placement funnel for {department.name} department.
        </p>
      </div>

      <InsightsFilters
        availableBatches={insights.availableBatches}
        availableSemesters={insights.availableSemesters}
      />

      {/* Priority metrics */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <KpiCard value={insights.eligibleStudents} label="Eligible Students" />
        <KpiCard value={insights.appliedStudents} label="Applied Students" />
        <KpiCard value={insights.placedStudents} label="Placed Students" />
        <KpiCard value={`${insights.placementRate}%`} label="Placement Rate" />
        <KpiCard value={`${insights.participationRate}%`} label="Participation Rate" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div className="card">
          <h3 className="section-title">Eligible vs. Applied vs. Placed</h3>
          <div style={{ marginTop: 16 }}>
            <BarChart
              data={[
                { label: "Eligible", value: insights.eligibleStudents, color: "var(--purple)" },
                { label: "Applied", value: insights.appliedStudents, color: "var(--accent)" },
                { label: "Placed", value: insights.placedStudents, color: "var(--teal)" },
              ]}
            />
          </div>
        </div>

        <div className="card">
          <h3 className="section-title">Roster Breakdown</h3>
          <div style={{ marginTop: 16 }}>
            <DonutChart
              data={[
                { label: "Placed", value: insights.placedStudents, color: "var(--teal)" },
                { label: "Not placed", value: notPlaced, color: "var(--amber)" },
                { label: "Not yet eligible", value: notYetEligible, color: "var(--text-muted)" },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Secondary metric */}
      <div className="card" style={{ padding: "16px 20px", maxWidth: 260 }}>
        <div className="text-muted" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>
          Active Drives
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: "var(--accent)", marginTop: 4 }}>
          {insights.activeDrivesCount}
        </div>
        <div className="text-secondary" style={{ fontSize: 11 }}>
          Currently taking applications for {department.code}
        </div>
      </div>
    </div>
  );
}
