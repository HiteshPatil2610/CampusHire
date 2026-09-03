import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { adminApi, type DepartmentOut } from '@/api/admin'
import { toast } from '@/store/toastStore'
import { getErrorMessage } from '@/utils/errors'
import Button from '@/components/common/Button'
import Input, { Select } from '@/components/common/Input'
import { ChevronLeft, Info } from 'lucide-react'

interface FormValues {
  full_name: string
  email: string
  roll_number: string
  phone_number: string
  department_id: string
  current_year: string
  current_semester: string
}

export default function AddStudent() {
  const navigate = useNavigate()
  const [departments, setDepts] = useState<DepartmentOut[]>([])
  const [loading, setLoading]   = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>()

  useEffect(() => {
    adminApi.listDepartments()
      .then(r => setDepts(r.data.filter(d => d.status)))
      .catch(() => {})
  }, [])

  const onSubmit = async (values: FormValues) => {
    setLoading(true)
    try {
      await adminApi.addStudent({
        email:           values.email,
        full_name:       values.full_name,
        roll_number:     values.roll_number,
        phone_number:    values.phone_number || undefined,
        department_id:   values.department_id,
        current_year:    +values.current_year,
        current_semester: +values.current_semester,
      })
      toast.success('Student account created. Login credentials have been emailed.')
      navigate('/admin/students')
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to add student'))
    } finally {
      setLoading(false)
    }
  }

  const deptOpts = departments.map(d => ({ value: d.id, label: `${d.department_name} (${d.department_code})` }))
  const yearOpts = [
    { value: '1', label: '1st Year' }, { value: '2', label: '2nd Year' },
    { value: '3', label: '3rd Year' }, { value: '4', label: '4th Year' },
  ]
  const semOpts = Array.from({ length: 8 }, (_, i) => ({ value: String(i + 1), label: `Semester ${i + 1}` }))

  return (
    <div className="max-w-xl anim-fade-up">
      {/* Breadcrumb */}
      <Link to="/admin/students" className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary mb-5 transition-colors">
        <ChevronLeft size={14} /> Back to students
      </Link>

      <h1 className="text-xl font-semibold text-text-primary mb-1">Add student</h1>
      <p className="text-xs text-text-secondary mb-6">Create a student account manually. A temporary password will be emailed to them.</p>

      {/* Info banner */}
      <div className="flex items-start gap-2.5 p-3.5 bg-surface-1 border border-border rounded-lg mb-5 text-xs text-text-secondary">
        <Info size={14} className="text-accent flex-shrink-0 mt-0.5" />
        <span>The student will receive their temporary password by email and will be prompted to change it on first login. For bulk additions, use <Link to="/admin/students/import" className="text-accent hover:underline">Excel import</Link> instead.</span>
      </div>

      <div className="bg-surface-2 border border-border rounded-xl p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Full name"
              placeholder="Aditi Sharma"
              error={errors.full_name?.message}
              {...register('full_name', { required: 'Required' })}
            />
            <Input
              label="Roll number"
              placeholder="CS0142"
              error={errors.roll_number?.message}
              {...register('roll_number', { required: 'Required' })}
            />
          </div>
          <Input
            label="Email address"
            type="email"
            placeholder="aditi@college.edu"
            error={errors.email?.message}
            {...register('email', {
              required: 'Required',
              pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' },
            })}
          />
          <Input
            label="Phone number (optional)"
            type="tel"
            placeholder="9876543210"
            {...register('phone_number')}
          />
          <Select
            label="Department"
            placeholder="Select department"
            options={deptOpts}
            error={errors.department_id?.message}
            {...register('department_id', { required: 'Required' })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Year"
              placeholder="Select year"
              options={yearOpts}
              error={errors.current_year?.message}
              {...register('current_year', { required: 'Required' })}
            />
            <Select
              label="Semester"
              placeholder="Select semester"
              options={semOpts}
              error={errors.current_semester?.message}
              {...register('current_semester', { required: 'Required' })}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="primary" size="md" type="submit" loading={loading} className="flex-1">
              Add student
            </Button>
            <Link to="/admin/students">
              <Button variant="outline" size="md">Cancel</Button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
