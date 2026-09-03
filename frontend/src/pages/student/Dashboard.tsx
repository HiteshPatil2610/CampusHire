import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { studentApi, type StudentProfileOut } from '@/api/student'
import { MetricCard } from '@/components/common/Card'
import { SkeletonMetricGrid } from '@/components/common/Skeleton'
import { Activity, BookOpen, Target } from 'lucide-react'

export default function StudentDashboard() {
  const { user } = useAuthStore()
  const [profile, setProfile] = useState<StudentProfileOut | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    studentApi.getFullProfile()
      .then(r => setProfile(r.data.profile))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const name = profile?.full_name ?? user?.email ?? 'Student'
  const completion = profile?.profile_completion_percentage ?? 0

  return (
    <div className="space-y-7 anim-fade-up">
      {/* Welcome */}
      <div>
        <h1 className="text-xl font-semibold text-text-primary">
          Welcome back, {name.split(' ')[0]} 👋
        </h1>
        <p className="text-xs text-text-secondary mt-0.5">
          Here's a snapshot of your placement readiness.
        </p>
      </div>

      {/* KPI cards */}
      {loading ? (
        <SkeletonMetricGrid count={3} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            label="Profile completion"
            value={`${completion}%`}
            sub={completion >= 80 ? '✓ Looking good!' : 'Add more sections to improve'}
            trend={completion >= 80 ? 'up' : undefined}
          />
          <MetricCard
            label="Readiness score"
            value="—"
            sub="Take the assessment to get your score"
          />
          <MetricCard
            label="Active drives"
            value="—"
            sub="Check notifications for new drives"
          />
        </div>
      )}

      {/* Progress bar */}
      <div className="bg-surface-2 border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-accent" />
            <span className="text-sm font-medium">Profile completion</span>
          </div>
          <span className="text-sm font-semibold text-accent">{completion}%</span>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill bg-accent"
            style={{ width: `${completion}%`, transition: 'width 0.9s cubic-bezier(.4,0,.2,1)' }}
          />
        </div>
        {completion < 100 && (
          <p className="text-xs text-text-muted mt-2">
            Complete your profile to appear in placement drives.
          </p>
        )}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold text-text-primary mb-3">Quick actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: <BookOpen size={18} className="text-accent" />, title: 'Complete profile', desc: 'Add skills, projects & experience', href: '/profile' },
            { icon: <Activity size={18} className="text-teal" />, title: 'View readiness', desc: 'See your placement readiness score', href: '/readiness' },
            { icon: <Target size={18} className="text-purple" />, title: 'Check drives', desc: 'View open placement drives', href: '/notifications' },
          ].map(item => (
            <a
              key={item.href} href={item.href}
              className="bg-surface-2 border border-border rounded-xl p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 block"
            >
              <div className="w-8 h-8 bg-surface-1 rounded-lg flex items-center justify-center mb-3">
                {item.icon}
              </div>
              <p className="text-sm font-medium text-text-primary">{item.title}</p>
              <p className="text-xs text-text-secondary mt-0.5">{item.desc}</p>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
