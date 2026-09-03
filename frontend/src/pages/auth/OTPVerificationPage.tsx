import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { authApi } from '@/api/auth'
import { toast } from '@/store/toastStore'
import { getErrorMessage } from '@/utils/errors'
import Button from '@/components/common/Button'

export default function OTPVerificationPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as { user_id: string; email: string; purpose?: string } | null

  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [countdown, setCountdown] = useState(60)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const purpose = state?.purpose ?? 'REGISTRATION'

  // Redirect if no state
  useEffect(() => {
    if (!state?.user_id) navigate('/register')
  }, [state, navigate])

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const next = [...otp]
    next[index] = value.slice(-1)
    setOtp(next)
    if (value && index < 5) inputRefs.current[index + 1]?.focus()
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const next = [...otp]
    text.split('').forEach((ch, i) => { next[i] = ch })
    setOtp(next)
    inputRefs.current[Math.min(text.length, 5)]?.focus()
  }

  const handleVerify = async () => {
    const code = otp.join('')
    if (code.length < 6) { toast.error('Please enter all 6 digits'); return }
    setLoading(true)
    try {
      await authApi.verifyOtp(state!.user_id, code, purpose)
      toast.success('Email verified! You can now log in.')
      navigate('/login')
    } catch (err) {
      toast.error(getErrorMessage(err, 'Verification failed'))
      setOtp(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    try {
      await authApi.resendOtp(state!.user_id, purpose)
      toast.success('New OTP sent to your email')
      setCountdown(60)
      setOtp(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center px-4">
      <div className="w-full max-w-[380px] anim-scale-in">
        {/* Brand */}
        <div className="flex items-center gap-2 mb-8">
          <span className="w-6 h-6 rounded-md bg-accent inline-block" />
          <span className="font-semibold text-lg text-text-primary">CampusHire</span>
        </div>

        <div className="bg-surface-2 border border-border rounded-xl p-8 shadow-sm text-center">
          <div className="w-12 h-12 bg-accent-light rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail size={22} className="text-accent" />
          </div>
          <h1 className="text-lg font-semibold text-text-primary mb-1">Check your email</h1>
          <p className="text-xs text-text-secondary mb-6">
            We sent a 6-digit code to{' '}
            <span className="font-medium text-text-primary">{state?.email}</span>
          </p>

          {/* OTP boxes */}
          <div className="flex gap-2.5 justify-center mb-6" onPaste={handlePaste}>
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={el => { inputRefs.current[i] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                className={`
                  w-11 h-13 text-center text-xl font-semibold border rounded-lg
                  bg-surface-0 text-text-primary caret-accent
                  transition-all duration-150 outline-none
                  focus:border-accent focus:ring-2 focus:ring-accent/15 focus:scale-105
                  ${digit ? 'border-accent' : 'border-border-strong'}
                `}
                style={{ height: '52px' }}
              />
            ))}
          </div>

          <Button
            variant="primary" size="lg"
            loading={loading} className="w-full mb-4"
            onClick={handleVerify}
          >
            Verify & continue
          </Button>

          <div className="text-xs text-text-secondary">
            {countdown > 0 ? (
              <span>Resend code in <span className="font-medium text-text-primary">{countdown}s</span></span>
            ) : (
              <button
                onClick={handleResend}
                disabled={resending}
                className="text-accent hover:underline font-medium disabled:opacity-50"
              >
                {resending ? 'Sending…' : 'Resend code'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
