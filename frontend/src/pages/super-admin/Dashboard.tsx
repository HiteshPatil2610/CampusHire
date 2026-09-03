import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminApi, type DepartmentOut, type AdminOut } from '@/api/admin'
import { MetricCard } from '@/components/common/Card'
import { SkeletonMetricGrid, SkeletonCard } from '@/components/common/Skeleton'
import Badge, { statusBadge } from '@/components/common/Badge'
import { Building2, UserCog, Users, AlertCircle, ArrowRight } from 'lucide-react'

export default function SuperAdminDashboard() {
  const [departments, setDepts]     = useState<DepartmentOut[]>([])
  const [admins,      setAdmins]    = useState<AdminOut[]>([])
  const [totalStudents, setTotal]   = useState(0)
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    Promise.all([
      adminApi.listDepartments(),
      adminApi.listAdmins(),
      adminApi.listStudents({ page_size: 1 }),
    ]).then(([dRes, aRes, sRes]) => {
      setDepts(dRes.data)
      setAdmins(aRes.data)
      setTotal(sRes.data.total)
    }).catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const activeDepts    = departments.filter(d => d.status)
  const inactiveDepts  = departments.filter(d => !d.status)
  const unassigned     = departments.filter(d => (d.admin_count ?? 0) === 0)
  const inactiveAdmins = admins.filter(a => a.status !== 'ACTIVE')

  // Attention items
  const attention: { icon: React.ReactNode; text: string; sub: string; href: string; color: string }[] = []
  if (unassigned.length > 0)
    attention.push({ icon: <Building2 size={15} />, text: `${unassigned.length} department${unassigned.length > 1 ? 's' : ''} ha${unassigned.length === 1 ? 's' : 've'} no assigned admin`, sub: `${unassigned.map(d => d.department_name).join(', ')}`, href: '/super-admin/departments', color: 'amber' })
  if (inactiveAdmins.length > 0)
    attention.push({ icon: <UserCog size={15} />, text: `${inactiveAdmins.length} admin account${inactiveAdmins.length > 1 ? 's' : ''} inactive`, sub: inactiveAdmins.map(a => a.full_name).join(', '), href: '/super-admin/admins', color: 'red' })
  if (inactiveDepts.length > 0)
    attention.push({ icon: <AlertCircle size={15} />, text: `${inactiveDepts.length} inactive department${inactiveDepts.length > 1 ? 's' : ''}`, sub: inactiveDepts.map(d => d.department_name).join(', '), href: '/super-admin/departments', color: 'gray' })

  const colorMap: Record<string, string> = {
    amber: 'bg-amber-light text-amber',
    red:   'bg-danger-light text-danger',
    gray:  'bg-surface-1 text-text-secondary',
  }

  return (
    <div className="space-y-7 anim-fade-up">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Institution Overview</h1>
        <p className="text-xs text-text-secondary mt-0.5">Across all {departments.length} departments.</p>
      </div>

      {/* KPI cards */}
      {loading ? <SkeletonMetricGrid count={4} /> : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MetricCard label="Total students"   value={totalStudents}      sub="Across all departments" />
          <MetricCard label="Departments"       value={activeDepts.length} sub={`${departments.length} total, ${inactiveDepts.length} inactive`} />
          <MetricCard label="Dept admins"       value={admins.length}      sub={`${inactiveAdmins.length} inactive`} />
          <MetricCard label="Overall placement" value="—"                 sub="Phase 5 feature" />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
        {/* Attention items */}
        {loading ? <SkeletonCard /> : (
          <div className="bg-surface-2 border border-border rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-text-primary">Needs your attention</h2>
            {attention.length === 0 ? (
              <p className="text-xs text-teal bg-teal-light border border-teal/20 rounded-lg px-3 py-2">
                ✓ Everything looks good!
              </p>
            ) : (
              attention.map((a, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-surface-1 hover:bg-surface-0 transition-colors">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${colorMap[a.color]}`}>
                    {a.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-text-primary">{a.text}</p>
                    <p className="text-xs text-text-muted truncate mt-0.5">{a.sub}</p>
                  </div>
                  <Link to={a.href} className="text-xs text-accent hover:underline flex-shrink-0">
                    Fix <ArrowRight size={11} className="inline" />
                  </Link>
                </div>
              ))
            )}
          </div>
        )}

        {/* Department placement rates */}
        {loading ? <SkeletonCard /> : (
          <div className="bg-surface-2 border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-text-primary">Departments</h2>
              <Link to="/super-admin/departments" className="text-xs text-accent hover:underline">Manage →</Link>
            </div>
            {departments.length === 0 ? (
              <p className="text-xs text-text-muted text-center py-4">No departments yet.</p>
            ) : (
              <div className="space-y-3">
                {departments.map(d => (
                  <div key={d.id} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${d.status ? 'bg-teal' : 'bg-danger'}`} />
                      <span className="text-xs text-text-primary truncate">{d.department_name}</span>
                      <span className="text-xs text-text-muted">({d.department_code})</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-text-muted">{d.student_count ?? 0} students</span>
                      <Badge color={d.status ? 'green' : 'red'}>{d.status ? 'Active' : 'Inactive'}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recent admins */}
      {!loading && admins.length > 0 && (
        <div className="bg-surface-2 border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <h2 className="text-sm font-semibold text-text-primary">Admin accounts</h2>
            <Link to="/super-admin/admins" className="text-xs text-accent hover:underline">View all →</Link>
          </div>
          <table className="ch-table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Departments</th><th>Status</th></tr>
            </thead>
            <tbody>
              {admins.slice(0, 5).map(a => (
                <tr key={a.id}>
                  <td className="font-medium">{a.full_name}</td>
                  <td className="text-text-secondary text-xs">{a.email}</td>
                  <td><Badge color="purple">{a.role.replace('_', ' ')}</Badge></td>
                  <td className="text-xs text-text-muted">
                    {a.departments.length > 0 ? a.departments.map(d => d.department_code).join(', ') : <span className="text-danger">Unassigned</span>}
                  </td>
                  <td><Badge color={statusBadge(a.status)}>{a.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
