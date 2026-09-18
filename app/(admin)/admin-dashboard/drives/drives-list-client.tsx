"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getDriveStatus } from "@/features/drives/utils/drive-status";
import type { Drive } from "@prisma/client";

import { formatPackage } from "@/features/drives/utils/format-package";
import type { WithSerializedPackage } from "@/features/drives/utils/serialize-drive";
// Not currently rendered by any page as of this writing — no live caller
// imports DrivesListClient. Typed for the same Server → Client boundary rule
// as every other drive view (see serialize-drive.ts) so it isn't a landmine
// if it's wired up later.
type DriveWithStatus = WithSerializedPackage<Drive> & {
  _count: { applications: number };
  status: "open" | "closed";
  isCentralDrive: boolean;
};

interface DrivesListClientProps {
  drives: DriveWithStatus[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  currentStatus: string;
  currentSearch: string;
}

export function DrivesListClient({
  drives,
  totalCount,
  currentPage,
  pageSize,
  currentStatus,
  currentSearch,
}: DrivesListClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(currentSearch);

  const totalPages = Math.ceil(totalCount / pageSize);

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page"); // Reset to page 1 on filter change
    router.push(`/admin-dashboard/drives?${params.toString()}`);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    updateFilter("search", search);
  }

  return (
    <div>
      {/* Filters and Actions Bar */}
      <div className="card" style={{ marginBottom: 20, padding: "14px 18px" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <form onSubmit={handleSearch} style={{ flex: "1 1 300px", display: "flex", gap: 8 }}>
            <input
              type="text"
              placeholder="Search by company or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                flex: 1,
                padding: "6px 12px",
                fontSize: 13,
                borderRadius: 6,
                border: "0.5px solid var(--border-strong)",
              }}
            />
            <button type="submit" className="btn btn-primary btn-sm">
              Search
            </button>
          </form>

          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => updateFilter("status", "all")}
              className={`btn btn-sm ${currentStatus === "all" ? "btn-primary" : "btn-ghost"}`}
              style={{ fontSize: 12 }}
            >
              All
            </button>
            <button
              onClick={() => updateFilter("status", "open")}
              className={`btn btn-sm ${currentStatus === "open" ? "btn-primary" : "btn-ghost"}`}
              style={{ fontSize: 12 }}
            >
              Open
            </button>
            <button
              onClick={() => updateFilter("status", "closed")}
              className={`btn btn-sm ${currentStatus === "closed" ? "btn-primary" : "btn-ghost"}`}
              style={{ fontSize: 12 }}
            >
              Closed
            </button>
          </div>

          <Link href="/admin-dashboard/drives/new" className="btn btn-primary btn-sm">
            ➕ Post New Drive
          </Link>
        </div>
      </div>

      {/* Drives Table */}
      {drives.length === 0 ? (
        <div className="card" style={{ padding: "40px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
          <div style={{ fontWeight: 600, marginBottom: 4, color: "var(--text-primary)" }}>
            No drives posted yet
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
            Post your first campus placement drive to get started.
          </div>
          <Link href="/admin-dashboard/drives/new" className="btn btn-primary btn-sm">
            Post New Drive →
          </Link>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Company & Role</th>
                  <th>Package</th>
                  <th>Eligibility</th>
                  <th>Drive Date</th>
                  <th>Deadline</th>
                  <th>Status</th>
                  <th>Applications</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {drives.map((drive) => {
                  const packageDisplay = formatPackage(drive);
                  const deadline = new Date(drive.applicationDeadline);
                  const driveDate = new Date(drive.driveDate);

                  return (
                    <tr key={drive.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>
                            {drive.companyName}
                          </span>
                          {drive.isCentralDrive && (
                            <span className="badge badge-purple" style={{ fontSize: 10 }}>
                              Central
                            </span>
                          )}
                        </div>
                        <div className="text-muted" style={{ fontSize: 11 }}>
                          {drive.roleName}
                        </div>
                      </td>
                      <td>
                        <strong>{packageDisplay}</strong>
                      </td>
                      <td>
                        <div style={{ fontSize: 12 }}>
                          CGPA ≥ {drive.minCGPA}
                        </div>
                        <div className="text-muted" style={{ fontSize: 11 }}>
                          Backlogs ≤ {drive.maxActiveBacklogs}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: 12 }}>
                          {driveDate.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: 12 }}>
                          {deadline.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            drive.status === "open" ? "badge-green" : "badge-amber"
                          }`}
                          style={{ fontSize: 11 }}
                        >
                          {drive.status === "open" ? "Open" : "Closed"}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>
                          {drive._count.applications}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <Link
                            href={`/admin-dashboard/drives/${drive.id}/applications`}
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: 11 }}
                          >
                            View Applicants →
                          </Link>
                          {drive.isCentralDrive ? (
                            <span
                              className="text-muted"
                              style={{ fontSize: 11, alignSelf: "center" }}
                            >
                              Posted by Super Admin
                            </span>
                          ) : (
                            <Link
                              href={`/admin-dashboard/drives/${drive.id}/edit`}
                              className="btn btn-outline btn-sm"
                              style={{ fontSize: 11 }}
                            >
                              Edit →
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 8,
                marginTop: 20,
              }}
            >
              <button
                onClick={() => {
                  const params = new URLSearchParams(searchParams.toString());
                  params.set("page", String(currentPage - 1));
                  router.push(`/admin-dashboard/drives?${params.toString()}`);
                }}
                disabled={currentPage === 1}
                className="btn btn-outline btn-sm"
              >
                ← Previous
              </button>
              <span className="text-secondary" style={{ fontSize: 13 }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => {
                  const params = new URLSearchParams(searchParams.toString());
                  params.set("page", String(currentPage + 1));
                  router.push(`/admin-dashboard/drives?${params.toString()}`);
                }}
                disabled={currentPage === totalPages}
                className="btn btn-outline btn-sm"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
