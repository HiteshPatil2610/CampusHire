import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell';
import Gauge from '../../components/ui/Gauge';
import ProgressBar from '../../components/ui/ProgressBar';
import Button from '../../components/ui/Button';
import DriveCard from '../../components/drives/DriveCard';
import ApplicationReviewModal from '../../components/drives/ApplicationReviewModal';
import WithdrawModal from '../../components/drives/WithdrawModal';
import { useStudent } from '../../hooks/useStudent';
import { useAppState } from '../../context/AppStateContext';
import { useToast } from '../../context/ToastContext';
import { PATHS } from '../../routes/paths';

export default function ReadinessDashboardPage() {
  const student = useStudent();
  const { state, allDrives, isApplied, applyDrive, withdrawDrive } = useAppState();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [applyModal, setApplyModal] = useState({ open: false, drive: null, editMode: false });
  const [withdrawModal, setWithdrawModal] = useState({ open: false, drive: null });

  function handleSubmitApplication(formValues) {
    applyDrive(applyModal.drive.id, formValues);
    const applicantName = formValues?.name || student?.name;
    showToast(`Application submitted for ${applicantName}!`, 'success');
    setApplyModal({ open: false, drive: null, editMode: false });
  }

  function handleWithdraw(drive, reason) {
    withdrawDrive(drive.id, reason);
    showToast(`Application withdrawn (${reason || 'confirmed'}).`, 'warning');
    setWithdrawModal({ open: false, drive: null });
  }

  const currentScore = state.readinessScore ?? 78;
  const resumeScore = state.resumeScore ?? 64;
  const profileCompletion = state.profileCompletion ?? 72;

  // Filter drives relevant for the student's readiness tier
  const eligibleDrives = (allDrives || []).filter((d) => d.open);

  const tierBadge = currentScore >= 75 ? { label: 'Tier 1 Ready ✓', cls: 'badge-green' } : currentScore >= 60 ? { label: 'Tier 1 Eligible', cls: 'badge-purple' } : { label: 'Developing', cls: 'badge-amber' };

  const factors = [
    {
      label: 'Academic CGPA',
      pct: 95,
      note: 'CGPA 8.4 meets cutoff for 95% of active campus drives',
      variant: 'teal',
    },
    {
      label: 'Resume Quality',
      pct: resumeScore,
      note: 'ATS formatting, quantifiable impact metrics, and keywords',
      variant: resumeScore >= 75 ? 'teal' : resumeScore >= 60 ? '' : 'amber',
    },
    {
      label: 'Assessment Score',
      pct: 85,
      note: 'Scored in top 15% on core problem solving & technical aptitude',
      variant: 'teal',
    },
    {
      label: 'Profile Completeness',
      pct: profileCompletion,
      note: 'Verified academic records, semester credits, and basic contact info',
      variant: profileCompletion >= 80 ? 'teal' : '',
    },
    {
      label: 'Projects & Experience',
      pct: 82,
      note: '2 projects deployed with GitHub links, 1 internship completed',
      variant: 'teal',
    },
  ];

  const trendMonths = [
    { month: 'Mar', score: 45 },
    { month: 'Apr', score: 52 },
    { month: 'May', score: 60 },
    { month: 'Jun', score: 68 },
    { month: 'Jul', score: 72 },
    { month: 'Aug', score: currentScore, current: true },
  ];

  const nextActions = [
    {
      title: 'Add missing project links',
      desc: 'Link live deployments and GitHub repositories to increase score.',
      icon: '🔗',
      onClick: () => navigate(PATHS.studentProfile),
    },
    {
      title: 'Complete technical assessment',
      desc: 'Practice aptitude and core CS questions to raise placement index.',
      icon: '📝',
      onClick: () => navigate(PATHS.selfAssessment),
    },
    {
      title: 'Run resume through AI analyzer',
      desc: 'Get ATS keyword matching against target job profiles.',
      icon: '✦',
      onClick: () => navigate(PATHS.aiAnalyzer),
    },
    {
      title: 'Verify academic marksheet',
      desc: 'Ensure 10th and 12th certificates are verified by department coordinator.',
      icon: '🎓',
      onClick: () => navigate(PATHS.studentProfile),
    },
  ];

  return (
    <AppShell role="student" user={student}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title" style={{ marginBottom: 4 }}>Placement Readiness Dashboard</h1>
        <p className="text-secondary" style={{ fontSize: 13 }}>
          Multi-factor evaluation tracking your preparedness for Tier-1 and Day-1 campus placement drives.
        </p>
      </div>

      {/* Section 1 — Overall Score Card (Side-by-Side) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '300px 1fr',
          gap: 20,
          marginBottom: 24,
        }}
      >
        {/* Left column — Gauge & Tier */}
        <div
          className="card"
          style={{
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: 24,
          }}
        >
          <div>
            <Gauge score={currentScore} caption="Placement Readiness" />
            <div style={{ marginTop: 12 }}>
              <span className={`badge ${tierBadge.cls}`} style={{ fontSize: 12, padding: '4px 10px' }}>
                {tierBadge.label}
              </span>
            </div>
            <div className="text-secondary" style={{ fontSize: 12, marginTop: 8 }}>
              📈 Up 6 points since last month
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20 }}>
            <Button size="sm" onClick={() => navigate(PATHS.selfAssessment)}>
              Take assessment
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(PATHS.resumeBuilder)}>
              Refine resume
            </Button>
          </div>
        </div>

        {/* Right column — Factor breakdown */}
        <div className="card" style={{ padding: 24 }}>
          <h3 className="section-title" style={{ fontSize: 16, marginBottom: 16 }}>
            Readiness Factor Breakdown
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {factors.map((f) => (
              <div key={f.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{f.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{f.pct}%</span>
                </div>
                <ProgressBar percent={f.pct} variant={f.variant} />
                <div className="text-secondary" style={{ fontSize: 11, marginTop: 4 }}>
                  {f.note}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Section 2 — Readiness Trend (6-month bar chart) */}
      <div className="card" style={{ marginBottom: 24, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h3 className="section-title" style={{ fontSize: 16, margin: 0 }}>
              6-Month Historical Trajectory
            </h3>
            <p className="text-secondary" style={{ fontSize: 12, margin: '4px 0 0' }}>
              Track score acceleration across academic semesters and test rounds.
            </p>
          </div>
          <span className="badge badge-green" style={{ fontSize: 12 }}>
            +33 points over the last 6 months
          </span>
        </div>

        <div style={{ height: 160, display: 'flex', alignItems: 'flex-end', gap: 16, padding: '10px 0 0', borderBottom: '1px solid var(--border)' }}>
          {trendMonths.map((m) => {
            const heightPct = (m.score / 100) * 100;
            return (
              <div
                key={m.month}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  height: '100%',
                  justifyContent: 'flex-end',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: m.current ? 'var(--teal)' : 'var(--text-secondary)', marginBottom: 4 }}>
                  {m.score}
                </div>
                <div
                  style={{
                    width: '100%',
                    maxWidth: 48,
                    height: `${heightPct}%`,
                    background: m.current ? 'var(--teal)' : 'var(--accent-light)',
                    borderRadius: '6px 6px 0 0',
                    transition: 'height 0.4s ease',
                  }}
                />
                <div style={{ fontSize: 12, fontWeight: m.current ? 600 : 400, color: m.current ? 'var(--teal)' : 'var(--text-muted)', marginTop: 8 }}>
                  {m.month}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 3 — Suggested Next Actions */}
      <div style={{ marginBottom: 12 }}>
        <h3 className="section-title" style={{ fontSize: 16, marginBottom: 12 }}>
          Suggested Next Actions
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          {nextActions.map((action) => (
            <div
              key={action.title}
              className="card"
              style={{
                borderRadius: 12,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                border: '1px solid var(--border)',
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
              }}
              onClick={action.onClick}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: 'var(--surface-1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  flexShrink: 0,
                }}
              >
                {action.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{action.title}</span>
                  <span style={{ fontSize: 12, color: 'var(--accent-dark)' }}>→</span>
                </div>
                <div className="text-secondary" style={{ fontSize: 12, lineHeight: 1.4 }}>
                  {action.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 4 — Eligible Drives for Your Tier */}
      <div style={{ marginTop: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h3 className="section-title" style={{ fontSize: 16, margin: 0 }}>
              Eligible Campus Drives for Your Readiness Tier
            </h3>
            <p className="text-secondary" style={{ fontSize: 12, margin: '2px 0 0' }}>
              Drives accepting applications matching your CGPA ({student.cgpa}) and department ({student.department || student.dept}).
            </p>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => navigate(PATHS.home)}
          >
            Explore All Drives →
          </button>
        </div>

        <div className="drives-grid" style={{ marginBottom: 28 }}>
          {eligibleDrives.slice(0, 2).map((d) => (
            <DriveCard
              key={d.id}
              drive={d}
              student={student}
              showAllActions={true}
              applied={isApplied(d.id)}
              onApply={(drive) => setApplyModal({ open: true, drive, editMode: false })}
              onView={(drive) => setApplyModal({ open: true, drive, editMode: false })}
              onEdit={(drive) => setApplyModal({ open: true, drive, editMode: true })}
              onWithdraw={(drive) => setWithdrawModal({ open: true, drive })}
            />
          ))}
        </div>
      </div>

      {/* Application Review & Confirmation Modal */}
      {applyModal.open && applyModal.drive && (
        <ApplicationReviewModal
          open={applyModal.open}
          drive={applyModal.drive}
          student={student}
          editMode={applyModal.editMode}
          onClose={() => setApplyModal({ open: false, drive: null, editMode: false })}
          onSubmit={handleSubmitApplication}
        />
      )}

      {/* Application Withdrawal Confirmation Modal */}
      {withdrawModal.open && withdrawModal.drive && (
        <WithdrawModal
          open={withdrawModal.open}
          drive={withdrawModal.drive}
          onClose={() => setWithdrawModal({ open: false, drive: null })}
          onConfirm={handleWithdraw}
        />
      )}
    </AppShell>
  );
}

