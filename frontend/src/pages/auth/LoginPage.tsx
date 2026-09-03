import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Eye, EyeOff } from 'lucide-react'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/store/toastStore'
import { getErrorMessage } from '@/utils/errors'
import Button from '@/components/common/Button'
import Input from '@/components/common/Input'

interface FormValues { email: string; password: string }

export default function LoginPage() {
  const navigate = useNavigate()
  const { setTokens, setUser } = useAuthStore()
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>()

  const onSubmit = async (values: FormValues) => {
    setLoading(true)
    try {
      const res = await authApi.login(values)
      const { access_token, refresh_token, role, user_id, must_change_password } = res.data

      setTokens(access_token, refresh_token)
      setUser({ id: user_id, email: values.email, role: role as any, status: 'ACTIVE', email_verified: true, must_change_password })

      if (must_change_password) {
        toast.warning('Please change your temporary password.')
        navigate('/settings')
        return
      }

      const redirect = role === 'STUDENT' ? '/dashboard' : role === 'DEPT_ADMIN' ? '/admin' : '/super-admin'
      navigate(redirect)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Login failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center px-4">
      <div className="w-full max-w-[380px] anim-fade-up">
        {/* Brand */}
        <div className="flex items-center gap-2 mb-8">
          <span className="w-6 h-6 rounded-md bg-accent inline-block" />
          <span className="font-semibold text-lg text-text-primary">CampusHire</span>
        </div>

        <div className="bg-surface-2 border border-border rounded-xl p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-text-primary mb-1">Welcome back</h1>
          <p className="text-xs text-text-secondary mb-6">Sign in to your account to continue</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Email address"
              type="email"
              placeholder="you@college.edu"
              autoComplete="email"
              error={errors.email?.message}
              {...register('email', {
                required: 'Email is required',
                pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' },
              })}
            />

            <div className="relative">
              <Input
                label="Password"
                type={showPw ? 'text' : 'password'}
                placeholder="••••••••"
                autoComplete="current-password"
                error={errors.password?.message}
                {...register('password', { required: 'Password is required' })}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-[30px] text-text-muted hover:text-text-secondary"
                tabIndex={-1}
              >
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            <div className="flex justify-end">
              <Link to="/reset-password" className="text-xs text-accent hover:underline">
                Forgot password?
              </Link>
            </div>

            <Button variant="primary" size="lg" type="submit" loading={loading} className="w-full">
              Sign in
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-text-secondary mt-5">
          Don't have an account?{' '}
          <Link to="/register" className="text-accent hover:underline font-medium">
            Register as a student
          </Link>
        </p>
      </div>
    </div>
  )
}
