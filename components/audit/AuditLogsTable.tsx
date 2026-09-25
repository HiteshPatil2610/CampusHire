"use client";

import { useState, useEffect } from "react";
import { getAuditLogsAction } from "@/features/audit/actions/get-audit-logs-action";
import DatePicker from "@/components/ui/date-picker";
import StatusBadge from "@/components/ui/status-badge";
import Pagination from "@/components/ui/pagination";
import type { StatusVariant } from "@/components/ui/status-badge";

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
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
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
      startDate: startDate ? startDate.toISOString() : undefined,
      endDate: endDate ? endDate.toISOString() : undefined,
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
    setStartDate(null);
    setEndDate(null);
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
      <div style={{ padding: 40, textAlign: 'center' }} className="text-muted">
        Loading audit logs...
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="field-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {/* Action Filter */}
          <div className="field">
            <label>Action</label>
            <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
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
              <option value="DROP">DROP</option>
              <option value="UNDO">UNDO</option>
              <option value="CUTOVER">CUTOVER</option>
            </select>
          </div>

          {/* Entity Type Filter */}
          <div className="field">
            <label>Entity Type</label>
            <select value={entityTypeFilter} onChange={(e) => setEntityTypeFilter(e.target.value)}>
              <option value="">All Types</option>
              <option value="Department">Department</option>
              <option value="DepartmentAdmin">DepartmentAdmin</option>
              <option value="User">User</option>
              <option value="Drive">Drive</option>
              <option value="DriveApplication">DriveApplication</option>
              <option value="Student">Student</option>
              <option value="BulkImport">BulkImport</option>
              <option value="StudentDrop">StudentDrop</option>
              <option value="AcademicCycleCutover">AcademicCycleCutover</option>
            </select>
          </div>

          {/* Start Date */}
          <div className="field">
            <label>From Date</label>
            <DatePicker
              value={startDate}
              onChange={(date) => setStartDate(date)}
              placeholder="Select start date"
            />
          </div>

          {/* End Date */}
          <div className="field">
            <label>To Date</label>
            <DatePicker
              value={endDate}
              onChange={(date) => setEndDate(date)}
              placeholder="Select end date"
            />
          </div>
        </div>

        {/* Filter Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button className="btn btn-primary" onClick={handleFilterChange} disabled={loading}>
            {loading ? 'Loading…' : 'Apply Filters'}
          </button>
          <button className="btn btn-outline" onClick={handleClearFilters}>
            Clear Filters
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div
          style={{
            padding: 12,
            marginBottom: 20,
            background: 'var(--red-light)',
            border: '1px solid var(--red)',
            borderRadius: 'var(--radius)',
            color: 'var(--red)',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {/* Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity Type</th>
              <th>Entity ID</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {data.data.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 40 }}>
                  <div className="text-muted">No audit activity found</div>
                </td>
              </tr>
            ) : (
              data.data.map((log) => (
                <tr key={log.id}>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(log.createdAt).toLocaleString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td>
                    <div style={{ fontSize: 13 }}>{log.userEmail}</div>
                    <div className="text-muted" style={{ fontSize: 11 }}>
                      {log.userRole}
                    </div>
                  </td>
                  <td>
                    <StatusBadge variant={getActionBadgeVariant(log.action)}>
                      {log.action}
                    </StatusBadge>
                  </td>
                  <td>
                    <StatusBadge variant="purple">{log.entityType}</StatusBadge>
                  </td>
                  <td className="text-muted" style={{ fontSize: 12 }}>
                    {log.entityId ? (
                      <button
                        onClick={() => copyToClipboard(log.entityId!)}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontFamily: 'monospace',
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                        }}
                        className="hover-accent"
                        title="Click to copy"
                      >
                        {log.entityId.substring(0, 8)}...
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {log.metadata ? (
                      <div>
                        <button
                          onClick={() => toggleMetadata(log.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent)',
                            cursor: 'pointer',
                            fontSize: 12,
                            padding: 0,
                          }}
                        >
                          {expandedRows.has(log.id) ? 'Hide' : 'Show'} Metadata
                        </button>
                        {expandedRows.has(log.id) && (
                          <pre
                            style={{
                              marginTop: 8,
                              padding: '10px 12px',
                              background: 'var(--surface-1)',
                              borderRadius: 'var(--radius)',
                              border: '1px solid var(--border)',
                              fontSize: 11,
                              overflowX: 'auto',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted">—</span>
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
        <div style={{ marginTop: 20 }}>
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            totalCount={data.totalCount}
            onPageChange={(newPage) => setPage(newPage)}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
            }}
          />
        </div>
      )}
    </div>
  );
}

function getActionBadgeVariant(action: string): StatusVariant {
  switch (action) {
    case 'CREATE':
      return 'green';
    case 'ACTIVATE':
      return 'green';
    case 'APPLY':
      return 'green';
    case 'UPDATE':
      return 'amber';
    case 'DEACTIVATE':
      return 'amber';
    case 'UNASSIGN':
      return 'amber';
    case 'ROLE_CHANGE':
      return 'amber';
    case 'DELETE':
      return 'red';
    case 'ASSIGN':
      return 'purple';
    case 'IMPORT':
      return 'purple';
    default:
      return 'gray';
  }
}
