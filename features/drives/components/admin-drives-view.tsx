"use client";

import { useState } from "react";
import Link from "next/link";
import { DepartmentCentralDrivesView } from "./department-central-drives-view";
import type { DepartmentCentralDrivesResult } from "../queries/get-department-central-drives";
import type { DepartmentOwnDrivesResult, OwnDriveListItem } from "../queries/get-department-own-drives";
import { getDriveStatus } from "../utils/drive-status";
import { formatNextStageDate, formatDeadline } from "@/lib/drive-date-helpers";
import { formatPackage } from "../utils/format-package";
import StatusBadge from "@/components/ui/status-badge";

type Tab = "central" | "own";

interface AdminDrivesViewProps {
  centralDrivesResult: DepartmentCentralDrivesResult;
  ownDrivesResult: DepartmentOwnDrivesResult;
  departmentCode: string;
  studentCount: number;
}

/** Badge classes for each dept drive status. */
const STATUS_BADGE: Record<string, string> = {
  open: "badge-teal",
  closed: "badge-gray",
};

function OwnDrivesPanel({ drives }: { drives: OwnDriveListItem[] }) {
  if (drives.length === 0) {
    return (
      <div className="card" style={{ padding: "40px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
          No department drives yet
        </div>
        <div className="text-muted" style={{ fontSize: 13, marginBottom: 20 }}>
          Post a drive specific to your department — for companies that are not
          running a central campus drive.
        </div>
        <Link href="/admin-dashboard/drives/new" className="btn btn-primary btn-sm">
          + Post Department Drive
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h2 className="section-title" style={{ margin: 0 }}>Department Drives</h2>
          <p className="text-secondary" style={{ fontSize: 12, margin: "4px 0 0" }}>
            Drives your department posted directly — not assigned by the Central Placement Cell.
          </p>
        </div>
        <Link href="/admin-dashboard/drives/new" className="btn btn-primary btn-sm">
          + Post Drive
        </Link>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Company / Role</th>
              <th>Package</th>
              <th>Next Stage Date</th>
              <th>Deadline</th>
              <th style={{ textAlign: "right" }}>Applications</th>
              <th style={{ textAlign: "right" }}>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {drives.map((drive) => {
              const open = getDriveStatus(drive) === "open";
              return (
                <tr key={drive.id}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{drive.companyName}</div>
                    <div className="text-muted" style={{ fontSize: 11 }}>{drive.roleName}</div>
                  </td>
                  <td style={{ fontSize: 13 }}>{formatPackage(drive)}</td>
                  <td style={{ fontSize: 12 }}>{formatNextStageDate(new Date(drive.nextStageDate))}</td>
                  <td style={{ fontSize: 12 }}>{formatDeadline(new Date(drive.applicationDeadline))}</td>
                  <td style={{ textAlign: "right", fontSize: 13 }}>
                    {drive._count.applications}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <StatusBadge variant={open ? "green" : "gray"}>
                      {open ? "Open" : "Closed"}
                    </StatusBadge>
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <Link
                      href={`/admin-dashboard/drives/${drive.id}?tab=applications`}
                      className="btn btn-outline btn-sm"
                      style={{ fontSize: 11, marginRight: 6 }}
                    >
                      Applications
                    </Link>
                    <Link
                      href={`/admin-dashboard/drives/${drive.id}/edit`}
                      className="btn btn-outline btn-sm"
                      style={{ fontSize: 11 }}
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminDrivesView({
  centralDrivesResult,
  ownDrivesResult,
  departmentCode,
  studentCount,
}: AdminDrivesViewProps) {
  const [tab, setTab] = useState<Tab>("central");

  const centralCount = centralDrivesResult.drives.length;
  const ownCount = ownDrivesResult.drives.length;

  return (
    <div>
      {/* Tab switcher */}
      <nav
        aria-label="Drive type"
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "0.5px solid var(--border)",
          marginBottom: 20,
        }}
      >
        {(
          [
            {
              id: "central" as Tab,
              label: centralCount > 0 ? `Central Placement Drives (${centralCount})` : "Central Placement Drives",
              hint: "Assigned by Super Admin",
            },
            {
              id: "own" as Tab,
              label: ownCount > 0 ? `Department Drives (${ownCount})` : "Department Drives",
              hint: "Posted by your department",
            },
          ] satisfies { id: Tab; label: string; hint: string }[]
        ).map(({ id, label, hint }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-selected={tab === id}
            title={hint}
            style={{
              padding: "10px 16px",
              fontSize: 13,
              fontWeight: tab === id ? 600 : 400,
              background: "transparent",
              border: "none",
              borderBottom: `2px solid ${tab === id ? "var(--accent)" : "transparent"}`,
              color: tab === id ? "var(--accent-dark)" : "var(--text-secondary)",
              cursor: "pointer",
              whiteSpace: "nowrap",
              marginBottom: -1,
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "central" && (
        <DepartmentCentralDrivesView
          drives={centralDrivesResult.drives}
          departmentCodesById={centralDrivesResult.departmentCodesById}
          departmentCode={departmentCode}
          studentCount={studentCount}
          batchYears={centralDrivesResult.batchYears}
        />
      )}

      {tab === "own" && (
        <OwnDrivesPanel drives={ownDrivesResult.drives} />
      )}
    </div>
  );
}
