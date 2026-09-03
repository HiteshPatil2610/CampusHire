import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Eye, EyeOff } from 'lucide-react'
import { authApi } from '@/api/auth'
import { adminApi } from '@/api/admin'
import { toast } from '@/store/toastStore'
import { getErrorMessage } from '@/utils/errors'
import Button from '@/components/common/Button'
import Input, { Select } from '@/components/common/Input'
import type { DepartmentOut } from '@/api/admin'

interface FormValues {
  full_name: string; email: string; roll_number: string
  phone_number: string; password: string; confirm_password: string
  department_id: string; current_year: string; gender: string
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [departments, setDepartments] = useState<DepartmentOut[]>([])

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>()
  const password = watch('password')

  useEffect(() => {
    adminApi.listDepartments()
      .then(r => setDepartments(r.data.filter(d => d.status)))
      .catch(() => {})
  }, [])

  const onSubmit = async (values: FormValues) => {
    setLoading(true)
    try {
      const res = await authApi.register({
        email: values.email,
        password: values.password,
        full_name: values.full_name,
        roll_number: values.roll_number,
        phone_number: values.phone_number,
        department_id: values.department_id,
        current_year: parseInt(values.current_year),
        current_semester: 1,
        gender: values.gender || undefined,
      })
      toast.success('Account created! Please verify your email.')
      navigate('/verify-otp', { state: { user_id: res.data.user_id, email: values.email, purpose: 'REGISTRATION' } })
    } catch (err) {
      toast.error(getErrorMessage(err, 'Registration failed'))
    } finally {
      setLoading(false)
    }
  }

  const deptOptions = departments.map(d => ({ value: d.id, label: `${d.department_name} (${d.department_code})` }))
  const yearOptions = [
    { value: '1', label: '1st Year' }, { value: '2', label: '2nd Year' },
    { value: '3', label: '3rd Year' }, { value: '4', label: '4th Year' },
  ]
  const genderOptions = [
    { value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' },
    { value: 'Other', label: 'Other' }, { value: 'Prefer not to say', label: 'Prefer not to say' },
  ]

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg anim-fade-up">
        {/* Brand */}
        <div className="flex items-center gap-2 mb-8">
          <span className="w-6 h-6 rounded-md bg-accent inline-block" />
          <span className="font-semibold text-lg text-text-primary">CampusHire</span>
        </div>

        <div className="bg-surface-2 border border-border rounded-xl p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-text-primary mb-1">Create your account</h1>
          <p className="text-xs text-text-secondary mb-6">Student registration — admin accounts are created by your placement cell</p>

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
              label="College email"
              type="email"
              placeholder="aditi@college.edu"
              error={errors.email?.message}
              {...register('email', {
                required: 'Required',
                pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' },
              })}
            />

            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Department"
                placeholder="Select department"
                options={deptOptions}
                error={errors.department_id?.message}
                {...register('department_id', { required: 'Required' })}
              />
              <Select
                label="Year"
                placeholder="Select year"
                options={yearOptions}
                error={errors.current_year?.message}
                {...register('current_year', { required: 'Required' })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Phone number"
                type="tel"
                placeholder="9876543210"
                error={errors.phone_number?.message}
                {...register('phone_number', { required: 'Required' })}
              />
              <Select
                label="Gender"
                placeholder="Select gender"
                options={genderOptions}
                {...register('gender')}
              />
            </div>

            <div className="relative">
              <Input
                label="Password"
                type={showPw ? 'text' : 'password'}
                placeholder="Min. 8 characters"
                error={errors.password?.message}
                {...register('password', {
                  required: 'Required',
                  minLength: { value: 8, message: 'Min. 8 characters' },
                })}
              />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-[30px] text-text-muted" tabIndex={-1}>
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            <Input
              label="Confirm password"
              type="password"
              placeholder="Repeat password"
              error={errors.confirm_password?.message}
              {...register('confirm_password', {
                required: 'Required',
                validate: v => v === password || 'Passwords do not match',
              })}
            />

            <Button variant="primary" size="lg" type="submit" loading={loading} className="w-full mt-2">
              Create account
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-text-secondary mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-accent hover:underline font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
