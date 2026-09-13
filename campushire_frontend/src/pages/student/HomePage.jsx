import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell';
import FilterPill from '../../components/ui/FilterPill';
import DriveCard from '../../components/drives/DriveCard';
import ApplicationReviewModal from '../../components/drives/ApplicationReviewModal';
import WithdrawModal from '../../components/drives/WithdrawModal';
import { useStudent } from '../../hooks/useStudent';
import { useAppState } from '../../context/AppStateContext';
import { useToast } from '../../context/ToastContext';
import { DRIVE_STORE } from '../../data/driveStore';
import { PATHS } from '../../routes/paths';

const FILTERS = ['All drives', 'Open', 'Applied', 'Upcoming', 'Closed'];

// Port of home.html — first page after student login.
// Combines the student identity card with the full drives catalogue.
export default function HomePage() {
  const student = useStudent();
  const { allDrives, isApplied, applyDrive, withdrawDrive } = useAppState();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [filter, setFilter] = useState('All drives');
  const [applyModal, setApplyModal] = useState({ open: false, drive: null, editMode: false });
  const [withdrawModal, setWithdrawModal] = useState({ open: false, drive: null });

  const drives = useMemo(() => {
    return (allDrives || []).filter((d) => {
      const applied = isApplied(d.id);
      switch (filter) {
        case 'Open': return d.open && !applied;
        case 'Applied': return applied;
        case 'Upcoming': return d.statusBadge?.cls === 'status-upcoming';
        case 'Closed': return d.statusBadge?.cls === 'status-closed';
        default: return true;
      }
    });
  }, [allDrives, filter, isApplied]);

  function handleSubmitApplication(formValues) {
    applyDrive(applyModal.drive.id, formValues);
    const applicantName = formValues?.name || student?.name;
    const resumeInfo = formValues?.resumeName ? ` (Resume: ${formValues.resumeName})` : '';
    showToast(`Application submitted for ${applicantName}${resumeInfo}! Placement cell will notify you of test slots.`, 'success');
    setApplyModal({ open: false, drive: null, editMode: false });
  }

  function handleWithdraw(drive, reason) {
    withdrawDrive(drive.id, reason);
    showToast(`Application withdrawn (${reason || 'confirmed'}).`, 'warning');
    setWithdrawModal({ open: false, drive: null });
  }

  return (
    <AppShell role="student" user={student}>
      <div className="student-id-card">
        <div className="sid-avatar" onClick={() => navigate(PATHS.studentProfile)}>
          {student.initials}
        </div>
        <div style={{ flex: 1 }}>
          <div className="sid-name">{student.name}</div>
          <div className="sid-meta">
            <span>{student.department}</span>
            <span>{student.year} year</span>
            <span>Roll {student.rollNo}</span>
            <span>CGPA {student.cgpa}</span>
            <span>{student.email}</span>
          </div>
          <div className="sid-scores">
            <span className="sid-score-pill readiness">Readiness {student.readinessScore}</span>
            <span className="sid-score-pill resume">Resume {student.resumeScore}</span>
            <span className="sid-score-pill profile">Profile {student.profileCompletion}%</span>
            <span className="sid-score-pill badge">{student.placementBadge}</span>
          </div>
        </div>
        <div className="sid-actions">
          <button className="btn btn-primary btn-sm" onClick={() => navigate(PATHS.studentProfile)}>Edit profile</button>
          <button className="btn btn-outline btn-sm" onClick={() => navigate(PATHS.readinessDashboard)}>View readiness</button>
          <button className="btn btn-outline btn-sm" onClick={() => navigate(PATHS.resumeBuilder)}>Build resume</button>
        </div>
      </div>

      <div className="drives-filters">
        {FILTERS.map((f) => (
          <FilterPill key={f} active={filter === f} onClick={() => setFilter(f)}>{f}</FilterPill>
        ))}
      </div>

      {drives.length === 0 ? (
        <div className="drives-empty">
          <div style={{ fontSize: 28 }}>🗂</div>
          <p>No drives match this filter.</p>
        </div>
      ) : (
        <div className="drives-grid">
          {drives.map((drive) => (
            <DriveCard
              key={drive.id}
              drive={drive}
              applied={isApplied(drive.id)}
              showAllActions
              onApply={(d) => setApplyModal({ open: true, drive: d, editMode: false })}
              onView={(d) => setApplyModal({ open: true, drive: d, editMode: false })}
              onEdit={(d) => setApplyModal({ open: true, drive: d, editMode: true })}
              onWithdraw={(d) => setWithdrawModal({ open: true, drive: d })}
            />
          ))}
        </div>
      )}

      <ApplicationReviewModal
        open={applyModal.open}
        drive={applyModal.drive}
        student={student}
        editMode={applyModal.editMode}
        onClose={() => setApplyModal({ open: false, drive: null, editMode: false })}
        onSubmit={handleSubmitApplication}
      />

      <WithdrawModal
        open={withdrawModal.open}
        drive={withdrawModal.drive}
        onClose={() => setWithdrawModal({ open: false, drive: null })}
        onConfirm={handleWithdraw}
      />
    </AppShell>
  );
}
