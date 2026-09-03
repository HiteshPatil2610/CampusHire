import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Check } from 'lucide-react'
import { authApi } from '@/api/auth'
import { toast } from '@/store/toastStore'
import { getErrorMessage } from '@/utils/errors'
import Button from '@/components/common/Button'
import Input from '@/components/common/Input'

type Step = 1 | 2 | 3

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState('')
  const [emailVal, setEmailVal] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Step 1 form
  const step1 = useForm<{ email: string }>()
  // Step 3 form
  const step3 = useForm<{ password: string; confirm: string }>()
  const pw = step3.watch('password')

  // ── Step 1 — Email ──────────────────────────────────────────────────────────
  const handleStep1 = step1.handleSubmit(async ({ email }) => {
    setLoading(true)
    try {
      const res = await authApi.forgotPassword(email)
      setUserId(res.data.user_id || '')
      setEmailVal(email)
      toast.success('If that email is registered, an OTP was sent.')
      setStep(2)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  })

  // ── Step 2 — OTP ────────────────────────────────────────────────────────────
  const handleOtpChange = (i: number, v: string) => {
    if (!/^\d*$/.test(v)) return
    const next = [...otp]; next[i] = v.slice(-1); setOtp(next)
    if (v && i < 5) inputRefs.current[i + 1]?.focus()
  }
  const handleOtpKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) inputRefs.current[i - 1]?.focus()
  }
  const handleStep2 = async () => {
    const code = otp.join('')
    if (code.length < 6) { toast.error('Enter all 6 digits'); return }
    setStep(3)
  }

  // ── Step 3 — New password ───────────────────────────────────────────────────
  const handleStep3 = step3.handleSubmit(async ({ password }) => {
    setLoading(true)
    try {
      await authApi.resetPassword(userId, otp.join(''), password)
      toast.success('Password reset successfully!')
      navigate('/login')
    } catch (err) {
      toast.error(getErrorMessage(err, 'Reset failed — the OTP may have expired'))
      setStep(2)
    } finally {
      setLoading(false)
    }
  })

  const stepLabels = ['Enter email', 'Verify OTP', 'New password']

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center px-4">
      <div className="w-full max-w-[400px] anim-fade-up">
        <div className="flex items-center gap-2 mb-8">
          <span className="w-6 h-6 rounded-md bg-accent inline-block" />
          <span className="font-semibold text-lg text-text-primary">CampusHire</span>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {stepLabels.map((label, i) => {
            const n = i + 1
            const done = step > n
            const active = step === n
            return (
              <div key={n} className="flex items-center gap-2 flex-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 transition-all
                  ${done ? 'bg-teal text-white' : active ? 'bg-accent text-white scale-110' : 'bg-surface-1 text-text-muted border border-border-strong'}`}>
                  {done ? <Check size={12} /> : n}
                </div>
                <span className={`text-xs ${active ? 'text-text-primary font-medium' : 'text-text-muted'}`}>{label}</span>
                {i < 2 && <div className="flex-1 h-px bg-border-strong mx-1" />}
              </div>
            )
          })}
        </div>

        <div className="bg-surface-2 border border-border rounded-xl p-8 shadow-sm">
          {step === 1 && (
            <>
              <h1 className="text-lg font-semibold mb-1">Forgot password?</h1>
              <p className="text-xs text-text-secondary mb-5">Enter your registered email and we'll send you a code.</p>
              <form onSubmit={handleStep1} className="space-y-4">
                <Input
                  label="Email address"
                  type="email"
                  placeholder="you@college.edu"
                  error={step1.formState.errors.email?.message}
                  {...step1.register('email', { required: 'Required', pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' } })}
                />
                <Button variant="primary" size="lg" type="submit" loading={loading} className="w-full">
                  Send code
                </Button>
              </form>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-lg font-semibold mb-1">Enter OTP</h1>
              <p className="text-xs text-text-secondary mb-5">
                Code sent to <span className="font-medium text-text-primary">{emailVal}</span>
              </p>
              <div className="flex gap-2.5 justify-center mb-6">
                {otp.map((d, i) => (
                  <input key={i} ref={el => { inputRefs.current[i] = el }}
                    type="text" inputMode="numeric" maxLength={1} value={d}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKey(i, e)}
                    className={`w-11 h-[52px] text-center text-xl font-semibold border rounded-lg
                      bg-surface-0 text-text-primary outline-none transition-all
                      focus:border-accent focus:ring-2 focus:ring-accent/15 focus:scale-105
                      ${d ? 'border-accent' : 'border-border-strong'}`}
                  />
                ))}
              </div>
              <Button variant="primary" size="lg" className="w-full" onClick={handleStep2}>
                Verify code
              </Button>
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="text-lg font-semibold mb-1">Set new password</h1>
              <p className="text-xs text-text-secondary mb-5">Choose a strong password you'll remember.</p>
              <form onSubmit={handleStep3} className="space-y-4">
                <Input
                  label="New password"
                  type="password"
                  placeholder="Min. 8 characters"
                  error={step3.formState.errors.password?.message}
                  {...step3.register('password', { required: 'Required', minLength: { value: 8, message: 'Min. 8 characters' } })}
                />
                <Input
                  label="Confirm password"
                  type="password"
                  placeholder="Repeat password"
                  error={step3.formState.errors.confirm?.message}
                  {...step3.register('confirm', { required: 'Required', validate: v => v === pw || 'Passwords do not match' })}
                />
                <Button variant="primary" size="lg" type="submit" loading={loading} className="w-full">
                  Save new password
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-text-secondary mt-5">
          <Link to="/login" className="text-accent hover:underline">← Back to login</Link>
        </p>
      </div>
    </div>
  )
}
