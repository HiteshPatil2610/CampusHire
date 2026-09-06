"use client";

import { useState, useEffect } from "react";
import { getAuditLogsAction } from "@/features/audit/actions/get-audit-logs-action";

interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  userRole: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: any;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

interface AuditLogsTableProps {
  initialData?: {
    data: AuditLog[];
    page: number;
    pageSize: number;
    totalCount: number;
  };
}

export function AuditLogsTable({ initialData }: AuditLogsTableProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState(initialData);

  // Filters
  const [actionFilter, setActionFilter] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Expanded metadata rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    const result = await getAuditLogsAction({
      page,
      pageSize,
      action: actionFilter || undefined,
      entityType: entityTypeFilter || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });

    if (result.success && result.data) {
      setData(result.data);
    } else {
      setError(result.error || "Failed to load audit logs");
    }

    setLoading(false);
  };

  const handleFilterChange = () => {
    setPage(1); // Reset to first page when filters change
    fetchData();
  };

  const handleClearFilters = () => {
    setActionFilter("");
    setEntityTypeFilter("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const toggleMetadata = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Fetch data when pagination changes
  useEffect(() => {
    if (page !== 1 || pageSize !== 25) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  if (!data) {
    return (
      <div className="p-8 text-center text-[var(--text-secondary)]">
        Loading audit logs...
      </div>
    );
  }

  const totalPages = Math.ceil(data.totalCount / data.pageSize);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Action Filter */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
              Action
            </label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface-0)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value="">All Actions</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
              <option value="ACTIVATE">ACTIVATE</option>
              <option value="DEACTIVATE">DEACTIVATE</option>
              <option value="ASSIGN">ASSIGN</option>
              <option value="UNASSIGN">UNASSIGN</option>
              <option value="APPLY">APPLY</option>
              <option value="IMPORT">IMPORT</option>
              <option value="ROLE_CHANGE">ROLE_CHANGE</option>
            </select>
          </div>

          {/* Entity Type Filter */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
              Entity Type
            </label>
            <select
              value={entityTypeFilter}
              onChange={(e) => setEntityTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface-0)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value="">All Types</option>
              <option value="Department">Department</option>
              <option value="DepartmentAdmin">DepartmentAdmin</option>
              <option value="User">User</option>
              <option value="Drive">Drive</option>
              <option value="DriveApplication">DriveApplication</option>
              <option value="Student">Student</option>
              <option value="BulkImport">BulkImport</option>
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface-0)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface-0)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
        </div>

        {/* Filter Actions */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={handleFilterChange}
            disabled={loading}
            className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-dark)] transition-colors disabled:opacity-50"
          >
            {loading ? "Loading..." : "Apply Filters"}
          </button>
          <button
            onClick={handleClearFilters}
            className="px-4 py-2 border border-[var(--border)] rounded-lg hover:bg-[var(--surface-1)] transition-colors text-[var(--text-primary)]"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-[var(--red-light)] border border-[var(--red)] rounded-lg p-4 text-[var(--red)]">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--surface-1)] border-b border-[var(--border)]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                  Actor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                  Entity Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                  Entity ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {data.data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[var(--text-secondary)]">
                    No audit activity found
                  </td>
                </tr>
              ) : (
                data.data.map((log) => (
                  <tr key={log.id} className="hover:bg-[var(--surface-1)] transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-primary)]">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="text-[var(--text-primary)]">{log.userEmail}</div>
                      <div className="text-[var(--text-muted)] text-xs">{log.userRole}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${getActionBadgeColor(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-[var(--purple-light)] text-[var(--purple)]">
                        {log.entityType}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--text-muted)]">
                      {log.entityId ? (
                        <button
                          onClick={() => copyToClipboard(log.entityId!)}
                          className="hover:text-[var(--accent)] transition-colors font-mono text-xs"
                          title="Click to copy"
                        >
                          {log.entityId.substring(0, 8)}...
                        </button>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {log.metadata ? (
                        <button
                          onClick={() => toggleMetadata(log.id)}
                          className="text-[var(--accent)] hover:text-[var(--accent-dark)] transition-colors"
                        >
                          {expandedRows.has(log.id) ? "Hide" : "Show"} Metadata
                        </button>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                      {expandedRows.has(log.id) && log.metadata && (
                        <pre className="mt-2 p-3 bg-[var(--surface-0)] rounded text-xs overflow-x-auto border border-[var(--border)]">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data.data.length > 0 && (
          <div className="px-6 py-4 border-t border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm text-[var(--text-secondary)]">
                Page {data.page} of {totalPages} ({data.totalCount} total)
              </span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="px-3 py-1 border border-[var(--border)] rounded-lg bg-[var(--surface-0)] text-sm text-[var(--text-primary)]"
              >
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1 || loading}
                className="px-4 py-2 border border-[var(--border)] rounded-lg hover:bg-[var(--surface-1)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-[var(--text-primary)]"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages || loading}
                className="px-4 py-2 border border-[var(--border)] rounded-lg hover:bg-[var(--surface-1)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-[var(--text-primary)]"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getActionBadgeColor(action: string): string {
  switch (action) {
    case "CREATE":
      return "bg-[var(--teal-light)] text-[var(--teal)]";
    case "UPDATE":
      return "bg-[var(--amber-light)] text-[var(--amber)]";
    case "DELETE":
      return "bg-[var(--red-light)] text-[var(--red)]";
    case "ACTIVATE":
      return "bg-[var(--teal-light)] text-[var(--teal)]";
    case "DEACTIVATE":
      return "bg-[var(--amber-light)] text-[var(--amber)]";
    case "ASSIGN":
      return "bg-[var(--purple-light)] text-[var(--purple)]";
    case "UNASSIGN":
      return "bg-[var(--amber-light)] text-[var(--amber)]";
    case "APPLY":
      return "bg-[var(--teal-light)] text-[var(--teal)]";
    case "IMPORT":
      return "bg-[var(--purple-light)] text-[var(--purple)]";
    case "ROLE_CHANGE":
      return "bg-[var(--amber-light)] text-[var(--amber)]";
    default:
      return "bg-[var(--surface-1)] text-[var(--text-secondary)]";
  }
}
