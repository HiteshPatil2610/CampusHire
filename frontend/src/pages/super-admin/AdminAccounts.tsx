import { useEffect, useState } from 'react'
import { adminApi, type AdminOut, type DepartmentOut } from '@/api/admin'
import { toast } from '@/store/toastStore'
import { getErrorMessage } from '@/utils/errors'
import Button from '@/components/common/Button'
import Input, { Select } from '@/components/common/Input'
import Badge, { statusBadge } from '@/components/common/Badge'
import ConfirmModal from '@/components/common/ConfirmModal'
import { SkeletonTable } from '@/components/common/Skeleton'
import { Plus, Pencil, KeyRound, X, Check, UserCog, Shield } from 'lucide-react'

export default function AdminAccountsPage() {
  const [admins,      setAdmins]     = useState<AdminOut[]>([])
  const [departments, setDepts]      = useState<DepartmentOut[]>([])
  const [loading, setLoading]        = useState(true)
  const [showForm, setShowForm]      = useState(false)
  const [editId, setEditId]          = useState<string | null>(null)
  const [saving, setSaving]          = useState(false)
  const [resetTarget, setResetTarget]= useState<AdminOut | null>(null)
  const [resetting, setResetting]    = useState(false)

  // Form fields
  const [fullName,    setFullName]   = useState('')
  const [email,       setEmail]      = useState('')
  const [phone,       setPhone]      = useState('')
  const [role,        setRole]       = useState('DEPT_ADMIN')
  const [selectedDepts, setSelDepts] = useState<string[]>([])
  const [status,      setStatus]     = useState('ACTIVE')

  // Errors
  const [nameErr,  setNameErr]  = useState('')
  const [emailErr, setEmailErr] = useState('')

  const load = () => {
    setLoading(true)
    Promise.all([adminApi.listAdmins(), adminApi.listDepartments()])
      .then(([aRes, dRes]) => { setAdmins(aRes.data); setDepts(dRes.data) })
      .catch(() => toast.error('Failed to load accounts'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const resetForm = () => {
    setFullName(''); setEmail(''); setPhone(''); setRole('DEPT_ADMIN')
    setSelDepts([]); setStatus('ACTIVE'); setEditId(null); setShowForm(false)
    setNameErr(''); setEmailErr('')
  }

  const openEdit = (a: AdminOut) => {
    setFullName(a.full_name); setEmail(a.email); setPhone(a.phone_number ?? '')
    setRole(a.role); setStatus(a.status)
    setSelDepts(a.departments.map(d => d.id))
    setEditId(a.id); setShowForm(true)
    setNameErr(''); setEmailErr('')
  }

  const validate = () => {
    let ok = true
    if (!fullName.trim())  { setNameErr('Name is required'); ok = false } else setNameErr('')
    if (!editId) {
      if (!email.trim())                        { setEmailErr('Email is required'); ok = false }
      else if (!/\S+@\S+\.\S+/.test(email))    { setEmailErr('Invalid email');     ok = false }
      else setEmailErr('')
    }
    return ok
  }

  const toggleDept = (id: string) =>
    setSelDepts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      if (editId) {
        await adminApi.updateAdmin(editId, {
          full_name: fullName.trim(),
          phone_number: phone || undefined,
          status,
          department_ids: selectedDepts,
        })
        toast.success('Admin account updated.')
      } else {
        await adminApi.createAdmin({
          email: email.trim(),
          full_name: fullName.trim(),
          phone_number: phone || undefined,
          role,
          department_ids: selectedDepts,
        })
        toast.success('Admin account created. Credentials have been emailed.')
      }
      resetForm()
      load()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save admin'))
    } finally {
      setSaving(false)
    }
  }

  const handleResetPassword = async () => {
    if (!resetTarget) return
    setResetting(true)
    try {
      await adminApi.resetAdminPassword(resetTarget.id)
      toast.success(`New credentials emailed to ${resetTarget.email}.`)
      setResetTarget(null)
    } catch (err) {
      toast.error(getErrorMessage(err))
      setResetTarget(null)
    } finally {
      setResetting(false)
    }
  }

  const roleOptions = [
    { value: 'DEPT_ADMIN',  label: 'Department Admin' },
    { value: 'SUPER_ADMIN', label: 'Super Admin' },
  ]
  const statusOptions = [
    { value: 'ACTIVE',   label: 'Active' },
    { value: 'INACTIVE', label: 'Inactive' },
  ]

  return (
    <div className="max-w-4xl space-y-5 anim-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Admin Accounts</h1>
          <p className="text-xs text-text-secondary mt-0.5">{admins.length} admin account{admins.length !== 1 ? 's' : ''}</p>
        </div>
        {!showForm && (
          <Button variant="primary" size="sm" icon={<Plus size={13} />} onClick={() => { resetForm(); setShowForm(true) }}>
            Add admin
          </Button>
        )}
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="bg-surface-2 border border-accent/30 rounded-xl p-5 space-y-4 anim-scale-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCog size={15} className="text-accent" />
              <p className="text-sm font-semibold text-text-primary">{editId ? 'Edit admin account' : 'New admin account'}</p>
            </div>
            <button onClick={resetForm} className="text-text-muted hover:text-text-secondary"><X size={16} /></button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Full name"
              placeholder="Meera Iyer"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              error={nameErr}
            />
            {!editId ? (
              <Input
                label="Email address"
                type="email"
                placeholder="meera@college.edu"
                value={email}
                onChange={e => setEmail(e.target.value)}
                error={emailErr}
              />
            ) : (
              <div>
                <label className="ch-label">Email address</label>
                <p className="ch-input bg-surface-1 text-text-muted cursor-not-allowed">{email}</p>
                <p className="mt-1 text-xs text-text-muted">Email cannot be changed after creation.</p>
              </div>
            )}
            <Input
              label="Phone number (optional)"
              type="tel"
              placeholder="9876543210"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
            <Select
              label="Role"
              options={roleOptions}
              value={role}
              onChange={e => setRole(e.target.value)}
            />
            {editId && (
              <Select
                label="Account status"
                options={statusOptions}
                value={status}
                onChange={e => setStatus(e.target.value)}
              />
            )}
          </div>

          {/* Department assignment */}
          {role === 'DEPT_ADMIN' && (
            <div>
              <p className="ch-label">Assign departments</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {departments.filter(d => d.status).map(d => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleDept(d.id)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-all duration-150
                      ${selectedDepts.includes(d.id)
                        ? 'bg-accent text-white border-accent'
                        : 'bg-surface-1 text-text-secondary border-border-strong hover:border-accent hover:text-accent'
                      }`}
                  >
                    {d.department_name} ({d.department_code})
                  </button>
                ))}
              </div>
              {selectedDepts.length === 0 && (
                <p className="text-xs text-amber mt-1.5">⚠ No department assigned — admin won't have access to any students.</p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="primary" size="sm" loading={saving} icon={<Check size={13} />} onClick={handleSave}>
              {editId ? 'Save changes' : 'Create account'}
            </Button>
            <Button variant="outline" size="sm" onClick={resetForm}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <SkeletonTable rows={4} />
      ) : admins.length === 0 ? (
        <div className="bg-surface-2 border border-border rounded-xl p-12 text-center">
          <Shield size={28} className="text-text-muted mx-auto mb-3" />
          <p className="text-sm text-text-secondary">No admin accounts yet.</p>
        </div>
      ) : (
        <div className="bg-surface-2 border border-border rounded-xl overflow-hidden">
          <table className="ch-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Departments</th>
                <th>Last login</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {admins.map(a => (
                <tr key={a.id}>
                  <td className="font-medium text-text-primary">{a.full_name}</td>
                  <td className="text-text-secondary text-xs">{a.email}</td>
                  <td>
                    <Badge color={a.role === 'SUPER_ADMIN' ? 'purple' : 'blue'}>
                      {a.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Dept Admin'}
                    </Badge>
                  </td>
                  <td className="text-xs">
                    {a.departments.length > 0
                      ? a.departments.map(d => d.department_code).join(', ')
                      : <span className="text-danger">Unassigned</span>
                    }
                  </td>
                  <td className="text-xs text-text-muted">
                    {a.last_login_at
                      ? new Date(a.last_login_at).toLocaleDateString()
                      : 'Never'
                    }
                  </td>
                  <td>
                    <Badge color={statusBadge(a.status)}>{a.status}</Badge>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(a)}
                        className="p-1.5 rounded hover:bg-surface-1 text-text-muted hover:text-accent transition-colors"
                        title="Edit"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setResetTarget(a)}
                        className="p-1.5 rounded hover:bg-amber-light text-text-muted hover:text-amber transition-colors"
                        title="Reset password"
                      >
                        <KeyRound size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        open={!!resetTarget}
        title={`Reset password for ${resetTarget?.full_name}?`}
        message="A new temporary password will be generated and emailed to them. They will be required to change it on next login."
        confirmLabel="Reset password"
        confirmVariant="primary"
        onConfirm={handleResetPassword}
        onCancel={() => setResetTarget(null)}
        loading={resetting}
      />
    </div>
  )
}
