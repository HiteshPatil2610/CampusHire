"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { exportToCsv } from "@/lib/csv-export";
import type { GlobalPlacementsResult } from "@/features/students/queries/get-global-placements";
import { batchLabel, formatBatch } from "@/features/students/utils/batch";

interface Filters {
  dept: string;
  company: string;
  batch: string;
  q: string;
  from: string;
  to: string;
  status: string;
  drive: string;
}

const inputStyle: React.CSSProperties = {
  padding: "6px 8px",
  fontSize: 12,
  borderRadius: 8,
  border: "0.5px solid var(--border-strong)",
  background: "var(--surface-2)",
};

/**
 * The Super Admin's global placement view. Filters live in the URL (so a view
 * can be shared and survives a refresh); the server applies them. Nothing is
 * editable here.
 */
export function GlobalPlacementsClient({ result, filters }: { result: GlobalPlacementsResult; filters: Filters }) {
  const router = useRouter();
  const [draft, setDraft] = useState(filters);
  const totalPages = Math.max(1, Math.ceil(result.totalCount / result.pageSize));
  const filtersActive = Object.entries(filters).some(
    ([key, value]) => value && !(key === "status" && value === "active")
  );

  function go(next: Filters, page = 1) {
    const params = new URLSearchParams();
    (Object.keys(next) as (keyof Filters)[]).forEach((key) => {
      if (next[key] && !(key === "status" && next[key] === "active")) params.set(key, next[key]);
    });
    if (page > 1) params.set("page", String(page));
    router.push(`/super-admin-dashboard/placements${params.toString() ? `?${params.toString()}` : ""}`);
  }

  const update = (key: keyof Filters, value: string, apply = true) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    if (apply) go(next);
  };

  function handleExport() {
    exportToCsv(
      `placements_${new Date().toISOString().split("T")[0]}`,
      result.rows.map((row) => ({
        Student: row.studentName,
        "Roll Number": row.rollNumber ?? "",
        Department: row.departmentCode,
        Batch: row.expectedPassoutYear ? batchLabel(row.expectedPassoutYear) : "",
        Company: row.companyName,
        Role: row.roleName,
        Package: row.packageDisplay ?? "",
        "Placed On": new Date(row.placedAt).toLocaleDateString("en-IN"),
        Source: row.source === "APPLICATION" ? "Campus drive" : "Off-campus",
        Status: row.revokedAt ? "Revoked" : "Placed",
      }))
    );
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div className="dash-stat-card" style={{ minWidth: 140 }}>
          <div className="dash-stat-value">{result.placedStudents}</div>
          <div className="dash-stat-label">Students in this view</div>
        </div>
        <div className="dash-stat-card" style={{ minWidth: 140 }}>
          <div className="dash-stat-value">{result.totalCount}</div>
          <div className="dash-stat-label">Placement records</div>
        </div>
        {result.byDepartment.map((dept) => (
          <div key={dept.code} className="dash-stat-card" style={{ minWidth: 100 }} title={dept.name}>
            <div className="dash-stat-value">{dept.count}</div>
            <div className="dash-stat-label">{dept.code}</div>
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(draft);
        }}
        style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
      >
        <input
          type="search"
          value={draft.q}
          onChange={(e) => update("q", e.target.value, false)}
          placeholder="Search student…"
          aria-label="Search student"
          style={{ ...inputStyle, minWidth: 180 }}
        />
        <select value={draft.dept} onChange={(e) => update("dept", e.target.value)} aria-label="Department" style={inputStyle}>
          <option value="">All departments</option>
          {result.options.departments.map((dept) => (
            <option key={dept.id} value={dept.id}>{dept.code}</option>
          ))}
        </select>
        <select value={draft.company} onChange={(e) => update("company", e.target.value)} aria-label="Company" style={inputStyle}>
          <option value="">All companies</option>
          {result.options.companies.map((company) => (
            <option key={company} value={company}>{company}</option>
          ))}
        </select>
        <select value={draft.batch} onChange={(e) => update("batch", e.target.value)} aria-label="Batch" style={inputStyle}>
          <option value="">All batches</option>
          {result.options.batchYears.map((year) => (
            <option key={year} value={String(year)}>Batch {batchLabel(year)}</option>
          ))}
        </select>
        <label style={{ fontSize: 12, display: "flex", gap: 4, alignItems: "center" }}>
          From
          <input type="date" value={draft.from} onChange={(e) => update("from", e.target.value)} style={inputStyle} />
        </label>
        <label style={{ fontSize: 12, display: "flex", gap: 4, alignItems: "center" }}>
          To
          <input type="date" value={draft.to} onChange={(e) => update("to", e.target.value)} style={inputStyle} />
        </label>
        <select value={draft.status} onChange={(e) => update("status", e.target.value)} aria-label="Status" style={inputStyle}>
          <option value="active">Placed</option>
          <option value="revoked">Revoked</option>
          <option value="all">All records</option>
        </select>
        <button type="submit" className="btn btn-outline btn-sm">Search</button>
        {filtersActive && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              const cleared = { dept: "", company: "", batch: "", q: "", from: "", to: "", status: "active", drive: "" };
              setDraft(cleared);
              go(cleared);
            }}
          >
            Clear filters
          </button>
        )}
        <button
          type="button"
          className="btn btn-outline btn-sm"
          style={{ marginLeft: "auto" }}
          onClick={handleExport}
          disabled={result.rows.length === 0}
        >
          📥 Export this page (CSV)
        </button>
      </form>

      {filters.drive && (
        <div className="text-secondary" style={{ fontSize: 12 }}>
          Showing one drive only.{" "}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => go({ ...filters, drive: "" })}>
            Show all drives
          </button>
        </div>
      )}

      {result.rows.length === 0 ? (
        <div className="card" style={{ padding: "40px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🎓</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            {filtersActive ? "No placements match these filters" : "No placements recorded yet"}
          </div>
          <div className="text-muted" style={{ fontSize: 13 }}>
            {filtersActive
              ? "Try clearing a filter."
              : "Placements appear here once a student is selected or a department records one."}
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Department</th>
                <th>Batch</th>
                <th>Company &amp; role</th>
                <th>Package</th>
                <th>Placed on</th>
                <th>Source</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{row.studentName}</div>
                    <div className="text-muted" style={{ fontSize: 11 }}>{row.rollNumber}</div>
                  </td>
                  <td style={{ fontSize: 13 }}>{row.departmentCode}</td>
                  <td style={{ fontSize: 13 }}>{formatBatch(row.expectedPassoutYear)}</td>
                  <td style={{ fontSize: 13 }}>
                    <strong>{row.companyName}</strong>
                    <div className="text-muted" style={{ fontSize: 11 }}>{row.roleName}</div>
                  </td>
                  <td style={{ fontSize: 12 }}>{row.packageDisplay ?? "—"}</td>
                  <td style={{ fontSize: 12 }}>
                    {new Date(row.placedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td style={{ fontSize: 12 }}>{row.source === "APPLICATION" ? "Campus drive" : "Off-campus"}</td>
                  <td>
                    <span className={`badge ${row.revokedAt ? "badge-red" : "badge-green"}`} style={{ fontSize: 11 }}>
                      {row.revokedAt ? "Revoked" : "Placed"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={result.page === 1}
            onClick={() => go(filters, result.page - 1)}
          >
            ← Previous
          </button>
          <span className="text-secondary" style={{ fontSize: 13 }}>Page {result.page} of {totalPages}</span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={result.page >= totalPages}
            onClick={() => go(filters, result.page + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
