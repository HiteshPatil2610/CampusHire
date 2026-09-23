import { notFound } from "next/navigation";
import Link from "next/link";
import { requireDepartmentAdmin, AuthorizationError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDriveStatus } from "@/features/drives/utils/drive-status";
import { formatDeadline } from "@/lib/drive-date-helpers";
import { getDepartmentDrivePreview } from "@/features/drives/queries/get-department-drive-preview";
import { getDriveStudents } from "@/features/drives/queries/get-drive-students";
import { getDriveOperationsActivity } from "@/features/drives/queries/get-drive-operations-activity";
import { getDriveApplications } from "@/features/applications/queries/get-drive-applications";
import { getDriveRecruitment } from "@/features/recruitment/queries/get-drive-recruitment";
import { getDrivePlacements } from "@/features/students/queries/get-drive-placements";
import { RecruitmentPipelinePanel } from "@/features/recruitment/components/recruitment-pipeline-panel";
import { DriveOverviewTab, DriveEligibilityTab } from "@/features/drives/components/drive-workspace-overview";
import { DriveStudentsTable } from "@/features/drives/components/drive-students-table";
import { DriveActivityList } from "@/features/drives/components/drive-activity-list";
import { DriveApplicationsWorkspace } from "@/features/applications/components/drive-applications-workspace";
import { DrivePlacementTab } from "@/features/students/components/drive-placement-tab";
import { PermissionDenied } from "@/components/shared/permission-denied";
import { getDepartmentBatchYears } from "@/features/students/queries/department-batch-years";
import type { ApplicationStatus } from "@prisma/client";
import { ExportMenu } from "@/features/exports/components/export-menu";
import { ReminderButton } from "@/features/notifications/components/reminder-button";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "eligibility", label: "Eligibility" },
  { id: "eligible", label: "Eligible Students" },
  { id: "registered", label: "Registered Students" },
  { id: "applications", label: "Applications" },
  { id: "pipeline", label: "Recruitment Pipeline" },
  { id: "placement", label: "Placement" },
  { id: "activity", label: "Activity" },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tab?: string;
    page?: string;
    q?: string;
    batch?: string;
    stage?: string;
    status?: string;
    placement?: string;
    from?: string;
    to?: string;
  }>;
}

const STATUSES: ApplicationStatus[] = ["IN_PROGRESS", "SELECTED", "REJECTED", "WITHDRAWN"];

/**
 * A department drive's workspace for its department admin: overview,
 * eligibility, the students, the applications and their recruitment stages,
 * placement and activity — one screen per concern, one URL per tab.
 *
 * Only the open tab's data is loaded, so the eligibility evaluation over the
 * whole department runs only where it is needed. Everything here is read
 * through the existing department-scoped queries; each authorizes on its own,
 * and this page adds no data of its own beyond a header.
 */
export default async function DriveWorkspacePage({ params, searchParams }: PageProps) {
  const { id: driveId } = await params;
  const query = await searchParams;
  const tab: TabId = TABS.some((entry) => entry.id === query.tab) ? (query.tab as TabId) : "overview";

  const { department } = await requireDepartmentAdmin();

  const master = await prisma.drive.findUnique({
    where: { id: driveId },
    select: {
      companyName: true,
      roleName: true,
      packageDisplay: true,
      applicationStartDate: true,
      applicationDeadline: true,
      isCentralDrive: true,
      departmentId: true,
      departmentConfigs: {
        where: { departmentId: department.id },
        select: {
          status: true,
          roleName: true,
          applicationDeadline: true,
          cancellationReason: true,
        },
      },
      _count: { select: { applications: { where: { student: { departmentId: department.id } } } } },
    },
  });
  if (!master) notFound();

  const instance = master.departmentConfigs[0] ?? null;
  // Runs this drive: it owns it, or it is an assigned Super Admin drive.
  if (master.departmentId !== department.id && !(master.isCentralDrive && instance)) {
    return (
      <PermissionDenied
        message="This drive is not assigned to your department."
        backHref="/admin-dashboard/drives"
        backLabel="Back to Drives"
      />
    );
  }

  const roleName = instance?.roleName ?? master.roleName;
  const deadline = instance?.applicationDeadline ?? master.applicationDeadline;
  const open =
    getDriveStatus({ applicationStartDate: master.applicationStartDate, applicationDeadline: deadline }) === "open";
  const lifecycle = instance?.status ?? "PUBLISHED";

  // Only the open tab's data.
  let content: React.ReactNode;
  try {
    switch (tab) {
      case "overview": {
        const [preview, recruitment] = await Promise.all([
          getDepartmentDrivePreview(driveId),
          getDriveRecruitment(driveId),
        ]);
        content = <DriveOverviewTab driveId={driveId} preview={preview} counts={recruitment.counts} />;
        break;
      }
      case "eligibility": {
        const [preview, recruitment] = await Promise.all([
          getDepartmentDrivePreview(driveId),
          getDriveRecruitment(driveId),
        ]);
        content = (
          <DriveEligibilityTab
            driveId={driveId}
            preview={preview}
            eligibleCount={recruitment.counts.eligible}
            isCentral={master.isCentralDrive}
            locked={lifecycle !== "ASSIGNED" && lifecycle !== "CONFIGURED"}
          />
        );
        break;
      }
      case "eligible":
      case "registered": {
        const students = await getDriveStudents(driveId);
        content = <DriveStudentsTable mode={tab} data={students} />;
        break;
      }
      case "applications": {
        const page = Number.parseInt(query.page ?? "1", 10);
        const batch = Number.parseInt(query.batch ?? "", 10);
        const status = STATUSES.find((value) => value === query.status);
        const [applications, recruitment, batchYears] = await Promise.all([
          getDriveApplications({
            driveId,
            page: Number.isFinite(page) ? page : 1,
            pageSize: 25,
            search: query.q,
            expectedPassoutYear: Number.isFinite(batch) ? batch : undefined,
            stageId: query.stage || undefined,
            status,
            placement:
              query.placement === "placed" || query.placement === "unplaced"
                ? query.placement
                : undefined,
            appliedFrom: query.from,
            appliedTo: query.to,
          }),
          getDriveRecruitment(driveId),
          getDepartmentBatchYears(department.id),
        ]);
        content = (
          <DriveApplicationsWorkspace
            driveId={driveId}
            stages={recruitment.activeVersion?.stages ?? []}
            applications={applications.data}
            totalCount={applications.totalCount}
            page={applications.page}
            pageSize={applications.pageSize}
            filters={{
              q: query.q ?? "",
              batch: Number.isFinite(batch) ? String(batch) : "",
              stage: query.stage ?? "",
              status: status ?? "",
              placement:
                query.placement === "placed" || query.placement === "unplaced"
                  ? query.placement
                  : "",
              from: query.from ?? "",
              to: query.to ?? "",
            }}
            companyName={master.companyName}
            roleName={roleName}
            packageText={master.packageDisplay}
            batchYears={batchYears.map((entry) => entry.year).sort((a, b) => b - a)}
            cancelled={lifecycle === "CANCELLED"}
          />
        );
        break;
      }
      case "pipeline": {
        const recruitment = await getDriveRecruitment(driveId);
        content = <RecruitmentPipelinePanel driveId={driveId} recruitment={recruitment} />;
        break;
      }
      case "placement": {
        content = <DrivePlacementTab driveId={driveId} data={await getDrivePlacements(driveId)} />;
        break;
      }
      case "activity": {
        content = <DriveActivityList items={await getDriveOperationsActivity(driveId)} />;
        break;
      }
    }
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return (
        <PermissionDenied
          message={error.message}
          backHref="/admin-dashboard/drives"
          backLabel="Back to Drives"
        />
      );
    }
    throw error;
  }

  return (
    <div>
      <Link
        href="/admin-dashboard/drives"
        style={{ fontSize: 13, color: "var(--text-secondary)", textDecoration: "none", display: "inline-block", marginBottom: 16 }}
      >
        ← Back to Drives
      </Link>

      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title" style={{ margin: 0 }}>
          {master.companyName} — {roleName}
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, fontSize: 13, flexWrap: "wrap" }}>
          <span className="text-secondary">
            {master._count.applications} application{master._count.applications === 1 ? "" : "s"}
          </span>
          <span
            className={`badge ${
              lifecycle === "CANCELLED" ? "badge-red" : open ? "badge-green" : "badge-amber"
            }`}
          >
            {lifecycle === "CANCELLED" ? "Cancelled" : open ? "Open" : "Closed"}
          </span>
          <span className="badge badge-gray">{lifecycle.charAt(0) + lifecycle.slice(1).toLowerCase()}</span>
          <span className="text-muted">Deadline: {formatDeadline(deadline)}</span>
          {master.isCentralDrive && (
            <Link href="/admin-dashboard/drives" className="badge badge-purple" style={{ textDecoration: "none" }}>
              Configure →
            </Link>
          )}
        </div>
        {lifecycle === "CANCELLED" && instance?.cancellationReason && (
          <div className="text-secondary" style={{ fontSize: 12, marginTop: 6 }}>
            Cancelled: {instance.cancellationReason}
          </div>
        )}
        {/* The whole dataset, not the page on screen. The server checks the
            drive and the department again. */}
        <div style={{ marginTop: 12, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <ExportMenu driveId={driveId} />
          {lifecycle === "PUBLISHED" && open && <ReminderButton driveId={driveId} />}
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Drive workspace"
        style={{ display: "flex", gap: 4, borderBottom: "0.5px solid var(--border)", marginBottom: 16, overflowX: "auto" }}
      >
        {TABS.map((entry) => (
          <Link
            key={entry.id}
            href={`/admin-dashboard/drives/${driveId}?tab=${entry.id}`}
            role="tab"
            aria-selected={entry.id === tab}
            style={{
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: entry.id === tab ? 600 : 400,
              textDecoration: "none",
              borderBottom: `2px solid ${entry.id === tab ? "var(--accent)" : "transparent"}`,
              color: entry.id === tab ? "var(--accent-dark)" : "var(--text-secondary)",
              whiteSpace: "nowrap",
              marginBottom: -1,
            }}
          >
            {entry.label}
          </Link>
        ))}
      </div>

      <div role="tabpanel">{content}</div>
    </div>
  );
}
