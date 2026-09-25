import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth";
import { getSuperAdminDriveApplications } from "@/features/applications/queries/get-super-admin-drive-applications";
import { formatDeadline } from "@/lib/drive-date-helpers";
import { SuperAdminApplicationsClient } from "./super-admin-applications-client";
import { ExportMenu } from "@/features/exports/components/export-menu";
import { EXPORT_DATASETS } from "@/features/exports/domain/export-datasets";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    page?: string;
    dept?: string;
    q?: string;
    batch?: string;
    status?: string;
    placement?: string;
    from?: string;
    to?: string;
  }>;
}

export default async function SuperAdminDriveApplicationsPage({
  params,
  searchParams,
}: PageProps) {
  await requireSuperAdmin();

  const { id: driveId } = await params;
  const filters = await searchParams;
  const { page: pageParam, dept } = filters;
  const batch = Number.parseInt(filters.batch ?? "", 10);
  const status = ["IN_PROGRESS", "SELECTED", "REJECTED", "WITHDRAWN"].find(
    (value) => value === filters.status
  ) as "IN_PROGRESS" | "SELECTED" | "REJECTED" | "WITHDRAWN" | undefined;
  const placement =
    filters.placement === "placed" || filters.placement === "unplaced" ? filters.placement : undefined;
  const parsedPage = Number.parseInt(pageParam ?? "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1;

  let result;
  try {
    result = await getSuperAdminDriveApplications(driveId, {
      page,
      pageSize: 50,
      departmentCode: dept || undefined,
      search: filters.q,
      expectedPassoutYear: Number.isFinite(batch) ? batch : undefined,
      status,
      placement,
      appliedFrom: filters.from,
      appliedTo: filters.to,
    });
  } catch {
    notFound();
  }

  return (
    <div>
      {/* Back link */}
      <Link
        href="/super-admin-dashboard/drives"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          color: "var(--text-secondary)",
          textDecoration: "none",
          marginBottom: 20,
        }}
      >
        ← Back to Central Drives
      </Link>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title" style={{ margin: 0 }}>
          {result.companyName} — {result.roleName}
        </h1>
        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "center",
            marginTop: 6,
            fontSize: 13,
            color: "var(--text-secondary)",
            flexWrap: "wrap",
          }}
        >
          <span>
            {result.totalCount} application{result.totalCount !== 1 ? "s" : ""}
          </span>
          <span>
            Deadline: {formatDeadline(result.applicationDeadline)}
          </span>
          {result.isCentralDrive && (
            <span
              className="badge badge-purple"
              style={{ fontSize: 11 }}
            >
              Central Drive
            </span>
          )}
        </div>
        {/* Every department's rows for the chosen dataset. "Eligible
            students" is a per-department judgement, so it is not offered. */}
        <div style={{ marginTop: 12 }}>
          <ExportMenu
            driveId={driveId}
            datasets={EXPORT_DATASETS.filter((dataset) => dataset !== "eligible")}
          />
        </div>
      </div>

      {/* Filters: a plain GET form, so a filtered view is a shareable link.
          Every value is validated again by the query. */}
      <form
        method="get"
        style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}
      >
        {dept && <input type="hidden" name="dept" value={dept} />}
        <input
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Search name, roll no or email"
          aria-label="Search"
          className="input"
          style={{ maxWidth: 260 }}
        />
        <select name="status" defaultValue={status ?? ""} aria-label="Status" className="input" style={{ maxWidth: 150 }}>
          <option value="">Any status</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="SELECTED">Selected</option>
          <option value="REJECTED">Rejected</option>
          <option value="WITHDRAWN">Withdrawn</option>
        </select>
        <input
          name="batch"
          type="number"
          min={1900}
          max={2999}
          defaultValue={Number.isFinite(batch) ? batch : ""}
          placeholder="Batch"
          aria-label="Batch year"
          className="input"
          style={{ maxWidth: 100 }}
        />
        <select name="placement" defaultValue={placement ?? ""} aria-label="Placement" className="input" style={{ maxWidth: 150 }}>
          <option value="">Any placement</option>
          <option value="unplaced">Not placed</option>
          <option value="placed">Placed</option>
        </select>
        <label className="text-secondary" style={{ fontSize: 12, display: "flex", gap: 4, alignItems: "center" }}>
          Applied
          <input name="from" type="date" defaultValue={filters.from ?? ""} aria-label="Applied from" className="input" />
          –
          <input name="to" type="date" defaultValue={filters.to ?? ""} aria-label="Applied to" className="input" />
        </label>
        <button type="submit" className="btn btn-outline btn-sm">
          Filter
        </button>
        <Link href={`/super-admin-dashboard/drives/${driveId}/applications`} className="btn btn-ghost btn-sm">
          Clear
        </Link>
      </form>

      {/* Per-department summary tiles */}
      {result.byDepartment.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: 10,
            marginBottom: 24,
          }}
        >
          {result.byDepartment.map((dept) => (
            <Link
              key={dept.departmentCode}
              href={`/super-admin-dashboard/drives/${driveId}/applications?dept=${encodeURIComponent(dept.departmentCode)}`}
              style={{ textDecoration: "none" }}
            >
              <div
                className="card"
                style={{
                  padding: "12px 16px",
                  cursor: "pointer",
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}
                >
                  {dept.departmentCode}
                </div>
                <div className="text-muted" style={{ fontSize: 11 }}>
                  {dept.departmentName}
                </div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    marginTop: 4,
                  }}
                >
                  {dept.count}
                </div>
                <div className="text-muted" style={{ fontSize: 10 }}>
                  applicant{dept.count !== 1 ? "s" : ""}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <SuperAdminApplicationsClient
        driveId={driveId}
        applications={result.applications}
        totalCount={result.totalCount}
        currentPage={page}
        pageSize={50}
        activeDeptFilter={dept || null}
        byDepartment={result.byDepartment}
      />
    </div>
  );
}
