import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/store/toastStore'
import { getErrorMessage } from '@/utils/errors'
import Button from '@/components/common/Button'
import Input from '@/components/common/Input'
import ConfirmModal from '@/components/common/ConfirmModal'
import { Shield, Bell, AlertTriangle } from 'lucide-react'

interface PwForm { current_password: string; new_password: string; confirm: string }

export default function StudentSettings() {
  const { logout } = useAuthStore()
  const navigate = useNavigate()
  const [savingPw, setSavingPw] = useState(false)
  const [showDeactivate, setShowDeactivate] = useState(false)

  const [prefs, setPrefs] = useState({
    drive_announcements: true,
    placement_announcements: true,
    readiness_reminders: true,
    email_notifications: true,
  })

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<PwForm>()
  const newPw = watch('new_password')

  const onChangePw = handleSubmit(async ({ current_password, new_password }) => {
    setSavingPw(true)
    try {
      await authApi.changePassword(current_password, new_password)
      toast.success('Password changed successfully!')
      reset()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to change password'))
    } finally {
      setSavingPw(false)
    }
  })

  const Toggle = ({ label, sub, checked, onChange }: { label: string; sub: string; checked: boolean; onChange: () => void }) => (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div>
        <p className="text-sm font-medium text-text-primary">{label}</p>
        <p className="text-xs text-text-secondary">{sub}</p>
      </div>
      <button
        onClick={onChange}
        className={`relative w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0 ${checked ? 'bg-accent' : 'bg-border-strong'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </button>
    </div>
  )

  return (
    <div className="max-w-xl space-y-6 anim-fade-up">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Settings</h1>
        <p className="text-xs text-text-secondary mt-0.5">Manage your account security and preferences.</p>
      </div>

      {/* Change password */}
      <section className="bg-surface-2 border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={16} className="text-accent" />
          <h2 className="text-sm font-semibold text-text-primary">Change password</h2>
        </div>
        <form onSubmit={onChangePw} className="space-y-3">
          <Input
            label="Current password" type="password" placeholder="••••••••"
            error={errors.current_password?.message}
            {...register('current_password', { required: 'Required' })}
          />
          <Input
            label="New password" type="password" placeholder="Min. 8 characters"
            error={errors.new_password?.message}
            {...register('new_password', { required: 'Required', minLength: { value: 8, message: 'Min. 8 characters' } })}
          />
          <Input
            label="Confirm new password" type="password" placeholder="Repeat password"
            error={errors.confirm?.message}
            {...register('confirm', { required: 'Required', validate: v => v === newPw || 'Passwords do not match' })}
          />
          <div className="flex justify-end pt-1">
            <Button variant="primary" size="sm" type="submit" loading={savingPw}>Update password</Button>
          </div>
        </form>
      </section>

      {/* Notification preferences */}
      <section className="bg-surface-2 border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Bell size={16} className="text-accent" />
          <h2 className="text-sm font-semibold text-text-primary">Notification preferences</h2>
        </div>
        <Toggle
          label="Drive announcements"
          sub="Get notified when new placement drives are posted"
          checked={prefs.drive_announcements}
          onChange={() => setPrefs(p => ({ ...p, drive_announcements: !p.drive_announcements }))}
        />
        <Toggle
          label="Placement cell announcements"
          sub="Receive general announcements from your placement cell"
          checked={prefs.placement_announcements}
          onChange={() => setPrefs(p => ({ ...p, placement_announcements: !p.placement_announcements }))}
        />
        <Toggle
          label="Readiness reminders"
          sub="Weekly nudge if your readiness score drops"
          checked={prefs.readiness_reminders}
          onChange={() => setPrefs(p => ({ ...p, readiness_reminders: !p.readiness_reminders }))}
        />
        <Toggle
          label="Email notifications"
          sub="Receive all notifications by email as well"
          checked={prefs.email_notifications}
          onChange={() => setPrefs(p => ({ ...p, email_notifications: !p.email_notifications }))}
        />
      </section>

      {/* Danger zone */}
      <section className="bg-danger-light border border-danger/20 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={16} className="text-danger" />
          <h2 className="text-sm font-semibold text-danger">Danger zone</h2>
        </div>
        <p className="text-xs text-text-secondary mb-3">
          Deactivating your account will hide your profile from placement drives. You can re-activate by contacting your placement cell.
        </p>
        <Button variant="danger" size="sm" onClick={() => setShowDeactivate(true)}>
          Deactivate account
        </Button>
      </section>

      <ConfirmModal
        open={showDeactivate}
        title="Deactivate your account?"
        message="Your profile will be hidden from all placement drives. You'll need to contact the placement cell to re-activate."
        confirmLabel="Deactivate"
        onConfirm={() => { setShowDeactivate(false); logout(); navigate('/login') }}
        onCancel={() => setShowDeactivate(false)}
      />
    </div>
  )
}
