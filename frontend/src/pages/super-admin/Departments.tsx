import { useEffect, useState } from 'react'
import { adminApi, type DepartmentOut } from '@/api/admin'
import { toast } from '@/store/toastStore'
import { getErrorMessage } from '@/utils/errors'
import Button from '@/components/common/Button'
import Input from '@/components/common/Input'
import Badge from '@/components/common/Badge'
import ConfirmModal from '@/components/common/ConfirmModal'
import { SkeletonTable } from '@/components/common/Skeleton'
import { Plus, Pencil, Trash2, X, Check, Building2 } from 'lucide-react'

interface DeptForm { department_name: string; department_code: string }

export default function DepartmentsPage() {
  const [departments, setDepts]     = useState<DepartmentOut[]>([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [editId, setEditId]         = useState<string | null>(null)
  const [saving, setSaving]         = useState(false)
  const [deleteTarget, setDelTarget]= useState<DepartmentOut | null>(null)
  const [deleting, setDeleting]     = useState(false)

  // Form state
  const [name, setName]   = useState('')
  const [code, setCode]   = useState('')
  const [active, setActive] = useState(true)
  const [nameErr, setNameErr] = useState('')
  const [codeErr, setCodeErr] = useState('')

  const load = () => {
    setLoading(true)
    adminApi.listDepartments()
      .then(r => setDepts(r.data))
      .catch(() => toast.error('Failed to load departments'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const resetForm = () => { setName(''); setCode(''); setActive(true); setNameErr(''); setCodeErr(''); setEditId(null); setShowForm(false) }

  const openEdit = (d: DepartmentOut) => {
    setName(d.department_name); setCode(d.department_code); setActive(d.status)
    setEditId(d.id); setShowForm(true); setNameErr(''); setCodeErr('')
  }

  const validate = () => {
    let ok = true
    if (!name.trim())  { setNameErr('Department name is required');   ok = false } else setNameErr('')
    if (!code.trim())  { setCodeErr('Department code is required');   ok = false } else setCodeErr('')
    return ok
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      if (editId) {
        await adminApi.updateDepartment(editId, { department_name: name.trim(), department_code: code.trim().toUpperCase(), status: active })
        toast.success('Department updated.')
      } else {
        await adminApi.createDepartment({ department_name: name.trim(), department_code: code.trim().toUpperCase(), status: active })
        toast.success('Department created.')
      }
      resetForm()
      load()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save department'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await adminApi.deleteDepartment(deleteTarget.id)
      toast.success(`${deleteTarget.department_name} deleted.`)
      setDelTarget(null)
      load()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Cannot delete department'))
      setDelTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-5 anim-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Departments</h1>
          <p className="text-xs text-text-secondary mt-0.5">Manage institutional departments.</p>
        </div>
        {!showForm && (
          <Button variant="primary" size="sm" icon={<Plus size={13} />} onClick={() => { resetForm(); setShowForm(true) }}>
            Add department
          </Button>
        )}
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="bg-surface-2 border border-accent/30 rounded-xl p-5 space-y-4 anim-scale-in">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-text-primary">{editId ? 'Edit department' : 'New department'}</p>
            <button onClick={resetForm} className="text-text-muted hover:text-text-secondary"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Department name"
              placeholder="Computer Science & Engineering"
              value={name}
              onChange={e => setName(e.target.value)}
              error={nameErr}
            />
            <Input
              label="Department code"
              placeholder="CSE"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              error={codeErr}
              hint="Unique short code used in Excel imports"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
            <input
              type="checkbox"
              checked={active}
              onChange={e => setActive(e.target.checked)}
              className="rounded"
            />
            Department is active
          </label>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" loading={saving} icon={<Check size={13} />} onClick={handleSave}>
              {editId ? 'Save changes' : 'Create department'}
            </Button>
            <Button variant="outline" size="sm" onClick={resetForm}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <SkeletonTable rows={4} />
      ) : departments.length === 0 ? (
        <div className="bg-surface-2 border border-border rounded-xl p-12 text-center">
          <Building2 size={28} className="text-text-muted mx-auto mb-3" />
          <p className="text-sm text-text-secondary">No departments yet.</p>
          <p className="text-xs text-text-muted mt-1">Click "Add department" to create your first one.</p>
        </div>
      ) : (
        <div className="bg-surface-2 border border-border rounded-xl overflow-hidden">
          <table className="ch-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Students</th>
                <th>Admins</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {departments.map(d => (
                <tr key={d.id}>
                  <td className="font-medium text-text-primary">{d.department_name}</td>
                  <td>
                    <span className="text-xs font-mono bg-surface-1 px-2 py-0.5 rounded">{d.department_code}</span>
                  </td>
                  <td className="text-text-secondary">{d.student_count ?? 0}</td>
                  <td>
                    {(d.admin_count ?? 0) === 0
                      ? <span className="text-xs text-danger">Unassigned</span>
                      : <span className="text-text-secondary">{d.admin_count}</span>
                    }
                  </td>
                  <td>
                    <Badge color={d.status ? 'green' : 'red'}>{d.status ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(d)}
                        className="p-1.5 rounded hover:bg-surface-1 text-text-muted hover:text-accent transition-colors"
                        title="Edit"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setDelTarget(d)}
                        className="p-1.5 rounded hover:bg-danger-light text-text-muted hover:text-danger transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={13} />
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
        open={!!deleteTarget}
        title={`Delete "${deleteTarget?.department_name}"?`}
        message="This cannot be undone. Departments with existing students cannot be deleted."
        confirmLabel="Delete department"
        onConfirm={handleDelete}
        onCancel={() => setDelTarget(null)}
        loading={deleting}
      />
    </div>
  )
}
