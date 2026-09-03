import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminApi, type StudentListItem, type DepartmentOut } from '@/api/admin'
import { toast } from '@/store/toastStore'
import Button from '@/components/common/Button'
import { SkeletonTable } from '@/components/common/Skeleton'
import Badge, { readinessBadge, statusBadge } from '@/components/common/Badge'
import { Search, UserPlus, FileSpreadsheet, ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE = 20

export default function AdminStudents() {
  const [students, setStudents]   = useState<StudentListItem[]>([])
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(1)
  const [loading, setLoading]     = useState(true)
  const [departments, setDepts]   = useState<DepartmentOut[]>([])

  // Filters
  const [search, setSearch]       = useState('')
  const [deptId, setDeptId]       = useState('')
  const [year, setYear]           = useState('')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load departments once
  useEffect(() => {
    adminApi.listDepartments().then(r => setDepts(r.data)).catch(() => {})
  }, [])

  const fetchStudents = useCallback((pg: number, s: string, d: string, y: string) => {
    setLoading(true)
    adminApi.listStudents({
      page: pg,
      page_size: PAGE_SIZE,
      search: s || undefined,
      department_id: d || undefined,
      year: y ? +y : undefined,
    })
      .then(r => { setStudents(r.data.items); setTotal(r.data.total) })
      .catch(() => toast.error('Failed to load students'))
      .finally(() => setLoading(false))
  }, [])

  // Initial load + page change
  useEffect(() => { fetchStudents(page, search, deptId, year) }, [page])

  // Debounced search / filter change — reset to page 1
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(1)
      fetchStudents(1, search, deptId, year)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search, deptId, year])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-5 anim-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Students</h1>
          <p className="text-xs text-text-secondary mt-0.5">{total} students registered</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/admin/students/import">
            <Button size="sm" icon={<FileSpreadsheet size={13} />}>Import Excel</Button>
          </Link>
          <Link to="/admin/students/add">
            <Button variant="primary" size="sm" icon={<UserPlus size={13} />}>Add student</Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search by name, roll no. or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="ch-input pl-8"
          />
        </div>
        <select
          value={deptId}
          onChange={e => setDeptId(e.target.value)}
          className="ch-input sm:w-44"
        >
          <option value="">All departments</option>
          {departments.map(d => (
            <option key={d.id} value={d.id}>{d.department_name}</option>
          ))}
        </select>
        <select
          value={year}
          onChange={e => setYear(e.target.value)}
          className="ch-input sm:w-32"
        >
          <option value="">All years</option>
          <option value="1">1st Year</option>
          <option value="2">2nd Year</option>
          <option value="3">3rd Year</option>
          <option value="4">4th Year</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonTable rows={8} />
      ) : students.length === 0 ? (
        <div className="bg-surface-2 border border-border rounded-xl p-12 text-center">
          <Search size={28} className="text-text-muted mx-auto mb-3" />
          <p className="text-sm text-text-secondary">No students match your filters.</p>
          {(search || deptId || year) && (
            <button
              className="mt-2 text-xs text-accent hover:underline"
              onClick={() => { setSearch(''); setDeptId(''); setYear('') }}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="bg-surface-2 border border-border rounded-xl overflow-hidden">
          <table className="ch-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Roll no.</th>
                <th>Department</th>
                <th>Year</th>
                <th>Profile</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => (
                <tr key={s.user_id}>
                  <td>
                    <div>
                      <p className="font-medium text-text-primary">{s.full_name}</p>
                      <p className="text-xs text-text-muted">{s.email}</p>
                    </div>
                  </td>
                  <td className="text-text-secondary">{s.roll_number}</td>
                  <td>
                    <span className="text-xs bg-surface-1 px-2 py-0.5 rounded text-text-secondary">
                      {s.department_code}
                    </span>
                  </td>
                  <td className="text-text-secondary">{s.current_year}th</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-16 progress-track">
                        <div
                          className={`progress-fill ${
                            s.profile_completion_percentage >= 75 ? 'bg-teal' :
                            s.profile_completion_percentage >= 50 ? 'bg-amber' : 'bg-danger'
                          }`}
                          style={{ width: `${s.profile_completion_percentage}%` }}
                        />
                      </div>
                      <Badge color={readinessBadge(s.profile_completion_percentage)}>
                        {Math.round(s.profile_completion_percentage)}%
                      </Badge>
                    </div>
                  </td>
                  <td>
                    <Badge color={statusBadge(s.status)}>{s.status}</Badge>
                  </td>
                  <td>
                    <span className="text-xs text-accent hover:underline cursor-pointer">View</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-text-secondary">
            <span>Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1 rounded hover:bg-surface-1 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <span>{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1 rounded hover:bg-surface-1 disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
