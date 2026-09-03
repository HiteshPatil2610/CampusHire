import { useEffect, useState } from 'react'
import { studentApi, type FullProfileOut } from '@/api/student'
import { SkeletonCard } from '@/components/common/Skeleton'
import { ArrowRight, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'

export default function ReadinessDashboard() {
  const [data, setData] = useState<FullProfileOut | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    studentApi.getFullProfile()
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="space-y-4"><SkeletonCard /><SkeletonCard /></div>

  const completion = data?.profile.profile_completion_percentage ?? 0
  // Simple derived scores for Phase 1 (no assessment data yet)
  const profileScore   = completion
  const resumeScore    = Math.min(100, completion * 0.9)
  const assessmentScore = 0 // Phase 4
  const overall = Math.round((profileScore * 0.4 + resumeScore * 0.3 + assessmentScore * 0.3))

  const scoreColor = overall >= 75 ? 'text-teal' : overall >= 50 ? 'text-amber' : 'text-danger'
  const progressColor = overall >= 75 ? 'bg-teal' : overall >= 50 ? 'bg-amber' : 'bg-danger'

  const breakdown = [
    { label: 'Profile completion', score: profileScore,    color: 'bg-accent' },
    { label: 'Resume score',       score: resumeScore,     color: 'bg-purple' },
    { label: 'Assessment score',   score: assessmentScore, color: 'bg-teal'   },
  ]

  const suggestions = [
    { done: completion >= 40, text: 'Add your skills (technical & soft)' },
    { done: (data?.projects.length ?? 0) > 0, text: 'Add at least one project' },
    { done: (data?.experiences.length ?? 0) > 0, text: 'Add internship or work experience' },
    { done: (data?.academic_records.length ?? 0) > 0, text: 'Fill in your semester CGPAs' },
    { done: !!data?.preferences, text: 'Set your placement preferences' },
  ].filter(s => !s.done)

  return (
    <div className="space-y-6 anim-fade-up max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Placement Readiness</h1>
        <p className="text-xs text-text-secondary mt-0.5">Your overall placement readiness score based on profile, resume, and assessments.</p>
      </div>

      {/* Score + breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Gauge-style score */}
        <div className="bg-surface-2 border border-border rounded-xl p-6 flex flex-col items-center justify-center gap-3">
          <div className="relative w-36 h-36">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#E6E4DA" strokeWidth="10" />
              <circle
                cx="60" cy="60" r="50" fill="none"
                stroke={overall >= 75 ? '#0F6E56' : overall >= 50 ? '#854F0B' : '#A32D2D'}
                strokeWidth="10"
                strokeDasharray={`${overall * 3.14} 314`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 1s cubic-bezier(.4,0,.2,1)' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={clsx('text-3xl font-bold', scoreColor)}>{overall}</span>
              <span className="text-xs text-text-muted">/100</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-text-secondary">
            <TrendingUp size={14} className="text-teal" />
            <span>Overall readiness score</span>
          </div>
        </div>

        {/* Breakdown */}
        <div className="bg-surface-2 border border-border rounded-xl p-5 space-y-4">
          <p className="text-sm font-semibold text-text-primary">Score breakdown</p>
          {breakdown.map(b => (
            <div key={b.label}>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-text-secondary">{b.label}</span>
                <span className="font-medium text-text-primary">{Math.round(b.score)}%</span>
              </div>
              <div className="progress-track">
                <div className={clsx('progress-fill', b.color)} style={{ width: `${b.score}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="bg-surface-2 border border-border rounded-xl p-5">
          <p className="text-sm font-semibold text-text-primary mb-3">Improve your score</p>
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <div key={i} className="flex items-center justify-between gap-3 p-3 bg-surface-1 rounded-lg">
                <p className="text-xs text-text-primary">{s.text}</p>
                <Link to="/profile" className="flex items-center gap-1 text-xs text-accent hover:underline flex-shrink-0">
                  Fix <ArrowRight size={12} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {suggestions.length === 0 && (
        <div className="bg-teal-light border border-teal/20 rounded-xl p-5 text-center">
          <p className="text-sm font-semibold text-teal">Great work! Your profile looks complete.</p>
          <p className="text-xs text-teal/80 mt-1">Keep it updated to stay ready for placement drives.</p>
        </div>
      )}
    </div>
  )
}
