import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell';
import KpiCard from '../../components/ui/KpiCard';
import DriveCard from '../../components/drives/DriveCard';
import ApplicationReviewModal from '../../components/drives/ApplicationReviewModal';
import WithdrawModal from '../../components/drives/WithdrawModal';
import { useStudent } from '../../hooks/useStudent';
import { useAppState } from '../../context/AppStateContext';
import { useToast } from '../../context/ToastContext';
import { DRIVE_STORE } from '../../data/driveStore';
import { NOTIFICATIONS, DEADLINES, DRIVES } from '../../data/mockData';
import { PATHS } from '../../routes/paths';

// Port of student-dashboard.html — secondary overview page.
export default function StudentDashboardPage() {
  const student = useStudent();
  const { isApplied, allDrives, applyDrive, withdrawDrive } = useAppState();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [applyModal, setApplyModal] = useState({ open: false, drive: null, editMode: false });
  const [withdrawModal, setWithdrawModal] = useState({ open: false, drive: null });

  const topDrives = (allDrives || []).filter((d) => d.open).slice(0, 2);

  function handleSubmitApplication(formValues) {
    applyDrive(applyModal.drive.id, formValues);
    const applicantName = formValues?.name || student?.name;
    const resumeInfo = formValues?.resumeName ? ` (Resume: ${formValues.resumeName})` : '';
    showToast(`Application submitted for ${applicantName}${resumeInfo}!`, 'success');
    setApplyModal({ open: false, drive: null, editMode: false });
  }

  function handleWithdraw(drive, reason) {
    withdrawDrive(drive.id, reason);
    showToast(`Application withdrawn (${reason || 'confirmed'}).`, 'warning');
    setWithdrawModal({ open: false, drive: null });
  }

  return (
    <AppShell role="student" user={student}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div className="sid-avatar" style={{ width: 44, height: 44, fontSize: 15 }} onClick={() => navigate(PATHS.studentProfile)}>
          {student.initials}
        </div>
        <h1 className="page-title">Welcome back, {student.name.split(' ')[0]}</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        <KpiCard value={`${student.profileCompletion}%`} label="Profile completion" onClick={() => navigate(PATHS.studentProfile)} />
        <KpiCard value={`${student.readinessScore}/100`} label="Readiness score" onClick={() => navigate(PATHS.readinessDashboard)} />
        <KpiCard value={`${student.resumeScore}/100`} label="Resume score" onClick={() => navigate(PATHS.aiAnalyzer)} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 className="section-title">Your drives</h2>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(PATHS.home)}>View all →</button>
      </div>
      <div className="drives-grid" style={{ marginBottom: 28 }}>
        {topDrives.map((d) => (
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        <div className="card" style={{ cursor: 'pointer' }} onClick={() => navigate(PATHS.resumeBuilder)}>
          <div className="icon-tile accent" style={{ marginBottom: 10 }}>📄</div>
          <strong>Build resume</strong>
        </div>
        <div className="card" style={{ cursor: 'pointer' }} onClick={() => navigate(PATHS.selfAssessment)}>
          <div className="icon-tile teal" style={{ marginBottom: 10 }}>✎</div>
          <strong>Take assessment</strong>
        </div>
        <div className="card" style={{ cursor: 'pointer' }} onClick={() => navigate(PATHS.aiAnalyzer)}>
          <div className="icon-tile amber" style={{ marginBottom: 10 }}>✦</div>
          <strong>View suggestions</strong>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <h3 className="section-title" style={{ marginBottom: 10 }}>Notifications</h3>
          {NOTIFICATIONS.map((n) => (
            <div className="activity-item" key={n.id}>
              <div className="activity-dot" />
              <div>
                <div>{n.text}</div>
                <div className="activity-time">{n.time}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="card">
          <h3 className="section-title" style={{ marginBottom: 10 }}>Deadlines</h3>
          {DEADLINES.map((d) => (
            <div className="activity-item" key={d.id}>
              <div className="activity-dot" />
              <div>{d.event} — <strong>{d.date}</strong></div>
            </div>
          ))}
        </div>
      </div>

      <h2 className="section-title" style={{ margin: '28px 0 12px' }}>Active drives</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Company</th><th>Role</th><th>Package</th><th>Min CGPA</th><th>Drive date</th><th>Deadline</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {DRIVES.map((d) => (
              <tr key={d.id}>
                <td>{d.company}</td>
                <td>{d.role}</td>
                <td>{d.package}</td>
                <td>{d.minCgpa}</td>
                <td>{d.date}</td>
                <td>{d.deadline}</td>
                <td>{d.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
