import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth";
import { getGlobalPlacements } from "@/features/students/queries/get-global-placements";
import { GlobalPlacementsClient } from "./global-placements-client";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    page?: string;
    dept?: string;
    company?: string;
    batch?: string;
    q?: string;
    from?: string;
    to?: string;
    status?: string;
    drive?: string;
  }>;
}

/**
 * Every placement across the institution, read-only, filterable by
 * department, company, batch, placement date, drive and student. The data is
 * the same `StudentPlacement` record that excludes a placed student from new
 * drives, so this view and that rule cannot disagree.
 */
export default async function GlobalPlacementsPage({ searchParams }: PageProps) {
  await requireSuperAdmin();
  const query = await searchParams;

  const page = Number.parseInt(query.page ?? "1", 10);
  const batch = Number.parseInt(query.batch ?? "", 10);
  const status = query.status === "revoked" || query.status === "all" ? query.status : "active";

  const result = await getGlobalPlacements({
    page: Number.isFinite(page) ? page : 1,
    pageSize: 25,
    departmentId: query.dept || undefined,
    company: query.company || undefined,
    expectedPassoutYear: Number.isFinite(batch) ? batch : undefined,
    search: query.q || undefined,
    from: query.from || undefined,
    to: query.to || undefined,
    driveId: query.drive || undefined,
    status,
  });

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Placements</h1>
        <p className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>
          Every placement across all departments. Read-only — placements are recorded and revoked by department admins.{" "}
          <Link href="/super-admin-dashboard/reports" style={{ color: "var(--accent)" }}>Global reports →</Link>
        </p>
      </div>

      <GlobalPlacementsClient
        result={result}
        filters={{
          dept: query.dept ?? "",
          company: query.company ?? "",
          batch: Number.isFinite(batch) ? String(batch) : "",
          q: query.q ?? "",
          from: query.from ?? "",
          to: query.to ?? "",
          status,
          drive: query.drive ?? "",
        }}
      />
    </div>
  );
}
