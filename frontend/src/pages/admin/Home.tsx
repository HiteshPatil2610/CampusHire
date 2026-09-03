import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminApi, type DepartmentOut } from '@/api/admin'
import { MetricCard } from '@/components/common/Card'
import { SkeletonMetricGrid } from '@/components/common/Skeleton'
import { Users, UserPlus, FileSpreadsheet, ArrowRight, AlertCircle } from 'lucide-react'

export default function AdminHome() {
  const [departments, setDepartments] = useState<DepartmentOut[]>([])
  const [totalStudents, setTotalStudents] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      adminApi.listDepartments(),
      adminApi.listStudents({ page_size: 1 }),
    ]).then(([deptRes, studRes]) => {
      setDepartments(deptRes.data)
      setTotalStudents(studRes.data.total)
    }).catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const activeDepts = departments.filter(d => d.status)

  return (
    <div className="space-y-7 anim-fade-up">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Admin Dashboard</h1>
        <p className="text-xs text-text-secondary mt-0.5">Department overview and quick actions.</p>
      </div>

      {/* KPI cards */}
      {loading ? (
        <SkeletonMetricGrid count={4} />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MetricCard label="Total students"    value={totalStudents}      sub="Registered in system" />
          <MetricCard label="Departments"        value={activeDepts.length} sub={`${departments.length} total`} />
          <MetricCard label="Active drives"      value="—"                 sub="Phase 5 feature" />
          <MetricCard label="Placement rate"     value="—"                 sub="Phase 5 feature" />
        </div>
      )}

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold text-text-primary mb-3">Quick actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: <Users size={18} className="text-accent" />,         title: 'View students',   desc: 'Search, filter and manage all students',   href: '/admin/students' },
            { icon: <UserPlus size={18} className="text-teal" />,        title: 'Add student',     desc: 'Manually add a single student account',    href: '/admin/students/add' },
            { icon: <FileSpreadsheet size={18} className="text-purple" />,title:'Import via Excel', desc: 'Bulk import students from an Excel file',   href: '/admin/students/import' },
          ].map(item => (
            <Link
              key={item.href} to={item.href}
              className="bg-surface-2 border border-border rounded-xl p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
            >
              <div className="w-9 h-9 bg-surface-1 rounded-lg flex items-center justify-center mb-3">{item.icon}</div>
              <p className="text-sm font-medium text-text-primary">{item.title}</p>
              <p className="text-xs text-text-secondary mt-0.5 mb-3">{item.desc}</p>
              <div className="flex items-center gap-1 text-xs text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                Go <ArrowRight size={11} />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Departments overview */}
      {!loading && departments.length > 0 && (
        <div className="bg-surface-2 border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border">
            <h2 className="text-sm font-semibold text-text-primary">Departments</h2>
          </div>
          <table className="ch-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Students</th>
                <th>Admins</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {departments.map(d => (
                <tr key={d.id}>
                  <td className="font-medium">{d.department_name}</td>
                  <td className="text-text-secondary">{d.department_code}</td>
                  <td>{d.student_count ?? '—'}</td>
                  <td>{d.admin_count ?? '—'}</td>
                  <td>
                    <span className={`badge-${d.status ? 'green' : 'red'}`}>
                      {d.status ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && departments.length === 0 && (
        <div className="bg-amber-light border border-amber/20 rounded-xl p-5 flex items-start gap-3">
          <AlertCircle size={16} className="text-amber mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber">No departments configured</p>
            <p className="text-xs text-text-secondary mt-0.5">Ask your Super Admin to add departments before adding students.</p>
          </div>
        </div>
      )}
    </div>
  )
}
