import { useState, useMemo, useEffect } from 'react';
import AppShell from '../../components/layout/AppShell';
import Button from '../../components/ui/Button';
import DatePicker from '../../components/ui/DatePicker';
import UrlField from '../../components/ui/UrlField';
import AdminDriveLogisticsPanel from '../../components/admin/drives/AdminDriveLogisticsPanel';
import AdminApplicationFieldsPanel from '../../components/admin/drives/AdminApplicationFieldsPanel';
import AdminDrivePreviewCard from '../../components/admin/drives/AdminDrivePreviewCard';
import StudentApplicationPreviewModal from '../../components/admin/drives/StudentApplicationPreviewModal';
import DepartmentScopeBanner from '../../components/admin/DepartmentScopeBanner';
import { useToast } from '../../context/ToastContext';
import { useAppState } from '../../context/AppStateContext';
import { useAuth } from '../../context/AuthContext';
import { CENTRAL_DRIVES } from '../../data/mockData';
import { isDeptMatch, isDriveEligibleForDept, normalizeDept } from '../../utils/departmentUtils';

const DEPARTMENTS = ['CSE', 'IT', 'ECE', 'EEE', 'Mech', 'Civil'];

export default function PostDrivePage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { allDrives, centralDrives = CENTRAL_DRIVES, saveDriveFullConfig, addDrive, studentsList } = useAppState();

  const currentDept = normalizeDept(user?.department || 'CSE');

  // Active top tab: 'central' (Super Admin drives) | 'post' (New Department drive)
  const [activeTab, setActiveTab] = useState('central');

  // Search & filter for Super Admin drives list
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'configured' | 'pending'
  const [scopeOnlyDept, setScopeOnlyDept] = useState(true);

  // Central drives list scoped to logged-in department
  const superAdminDrives = useMemo(() => {
    const list = centralDrives && centralDrives.length > 0 ? centralDrives : CENTRAL_DRIVES;
    if (!scopeOnlyDept) return list;
    return list.filter((drive) => isDriveEligibleForDept(drive, currentDept));
  }, [centralDrives, scopeOnlyDept, currentDept]);

  const deptStudentsCount = useMemo(() => {
    return (studentsList || []).filter((s) => isDeptMatch(s.dept, currentDept)).length;
  }, [studentsList, currentDept]);

  // Currently selected drive in editor
  const [selectedDriveId, setSelectedDriveId] = useState(() => {
    return superAdminDrives[0]?.id || 'cd_1';
  });

  // Keep selectedDriveId synchronized when department changes
  useEffect(() => {
    if (superAdminDrives.length > 0 && !superAdminDrives.some((d) => d.id === selectedDriveId)) {
      setSelectedDriveId(superAdminDrives[0].id);
    }
  }, [superAdminDrives, selectedDriveId]);

  const selectedDrive = useMemo(() => {
    return superAdminDrives.find((d) => d.id === selectedDriveId) || superAdminDrives[0] || null;
  }, [superAdminDrives, selectedDriveId]);

  // Working state for the selected drive's logistics & application fields
  const [adminConfig, setAdminConfig] = useState({});
  const [applicationFields, setApplicationFields] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Student Preview Modal state
  const [previewOpen, setPreviewOpen] = useState(false);

  // When selectedDrive changes, load its existing config into state
  useEffect(() => {
    if (selectedDrive) {
      setAdminConfig(selectedDrive.adminConfig || {});
      setApplicationFields(
        selectedDrive.applicationFields || [
          { key: 'name', label: 'Full Name', source: 'profile', category: 'Basic Identity', icon: '👤', required: true, enabled: true },
          { key: 'rollNo', label: 'Roll Number', source: 'profile', category: 'Basic Identity', icon: '🪪', required: true, enabled: true },
          { key: 'email', label: 'College Email', source: 'profile', category: 'Contact Info', icon: '✉️', required: true, enabled: true },
          { key: 'phone', label: 'Mobile Number', source: 'profile', category: 'Contact Info', icon: '📞', required: true, enabled: true },
          { key: 'cgpa', label: 'Current CGPA', source: 'profile', category: 'Academic Records', icon: '🎓', required: true, enabled: true },
          { key: 'backlogs', label: 'Active Backlogs', source: 'profile', category: 'Academic Records', icon: '⚠️', required: true, enabled: true },
          { key: 'department', label: 'Department', source: 'profile', category: 'Academic Records', icon: '🏛️', required: true, enabled: true },
          { key: 'resume', label: 'Placement Resume (PDF)', source: 'resume', category: 'Documents & Portfolios', icon: '📄', required: true, enabled: true },
        ]
      );
      setHasUnsavedChanges(false);
    }
  }, [selectedDrive?.id]);

  function handleLogisticsChange(newConfig) {
    setAdminConfig(newConfig);
    setHasUnsavedChanges(true);
  }

  function handleApplicationFieldsChange(newFields) {
    setApplicationFields(newFields);
    setHasUnsavedChanges(true);
  }

  function handleSaveCentralDriveConfig() {
    if (!selectedDrive) return;

    saveDriveFullConfig(selectedDrive.id, {
      adminConfig: {
        ...adminConfig,
        configured: true,
        lastUpdated: new Date().toISOString(),
      },
      applicationFields,
    });

    setHasUnsavedChanges(false);
    showToast(`Logistics & application requirements for ${selectedDrive.company} saved successfully!`, 'success');
  }

  // Filtered drives for left sidebar
  const filteredCentralDrives = useMemo(() => {
    return superAdminDrives.filter((drive) => {
      const matchesSearch =
        !searchQuery.trim() ||
        drive.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        drive.role?.toLowerCase().includes(searchQuery.toLowerCase());

      const isConfigured = Boolean(drive.adminConfig?.venue || drive.adminConfig?.reportingTime);

      if (statusFilter === 'configured') return matchesSearch && isConfigured;
      if (statusFilter === 'pending') return matchesSearch && !isConfigured;
      return matchesSearch;
    });
  }, [superAdminDrives, searchQuery, statusFilter]);

  // KPI Metrics
  const totalCentral = superAdminDrives.length;
  const configuredCount = superAdminDrives.filter((d) => Boolean(d.adminConfig?.venue || d.adminConfig?.reportingTime)).length;
  const pendingCount = totalCentral - configuredCount;
  const totalApplicants = superAdminDrives.reduce((acc, d) => acc + (d.applicants || 0), 0);

  // New Department Drive form state
  const [newDriveForm, setNewDriveForm] = useState({
    company: '',
    role: '',
    ctc: '',
    minCgpa: '7.0',
    maxBacklogs: '0',
    driveDate: '2026-10-15',
    deadline: '2026-10-01',
    departments: ['CSE', 'IT'],
    applyLink: '',
    description: '',
  });

  function handleNewDriveSubmit(e) {
    e.preventDefault();

    if (!newDriveForm.company.trim() || !newDriveForm.role.trim() || !newDriveForm.ctc.trim()) {
      showToast('Please fill in Company, Role, and CTC details.', 'error');
      return;
    }

    const minCgpaNum = parseFloat(newDriveForm.minCgpa);
    if (isNaN(minCgpaNum) || minCgpaNum < 0 || minCgpaNum > 10) {
      showToast('Minimum CGPA must be a number between 0.0 and 10.0.', 'error');
      return;
    }

    if (!newDriveForm.departments.length) {
      showToast('Please select at least one eligible department.', 'error');
      return;
    }

    if (newDriveForm.deadline && newDriveForm.driveDate && newDriveForm.deadline >= newDriveForm.driveDate) {
      showToast('Application deadline must precede the drive date.', 'error');
      return;
    }

    const formattedApplyLink = newDriveForm.applyLink.trim()
      ? (newDriveForm.applyLink.startsWith('http')
          ? newDriveForm.applyLink.trim()
          : `https://${newDriveForm.applyLink.trim()}`)
      : '';

    addDrive({
      company: newDriveForm.company.trim(),
      role: newDriveForm.role.trim(),
      ctc: newDriveForm.ctc.trim(),
      minCgpa: minCgpaNum,
      maxBacklogs: parseInt(newDriveForm.maxBacklogs, 10) || 0,
      driveDateRaw: newDriveForm.driveDate,
      driveDeadlineRaw: newDriveForm.deadline,
      date: newDriveForm.driveDate,
      deadline: newDriveForm.deadline,
      departments: newDriveForm.departments,
      applyLink: formattedApplyLink,
      jdSummary: newDriveForm.description || `${newDriveForm.role} hiring drive at ${newDriveForm.company}.`,
      adminConfig: {
        configured: true,
        venue: 'Department Seminar Hall & Lab 3',
        reportingTime: '09:00 AM',
        pptLink: formattedApplyLink,
      },
    });

    showToast(`Campus drive for ${newDriveForm.company} published successfully!`, 'success');
    setActiveTab('central');
  }

  return (
    <AppShell role="admin" user={user}>
      <DepartmentScopeBanner
        currentDept={currentDept}
        studentCount={deptStudentsCount}
        driveCount={totalCentral}
      />

      {/* Top Header & Context */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="page-title" style={{ margin: 0 }}>Campus Recruitment Drives</h1>
            <span
              style={{
                fontSize: 12,
                padding: '3px 10px',
                borderRadius: 14,
                background: 'var(--accent-light)',
                color: 'var(--accent-dark)',
                fontWeight: 600,
              }}
            >
              {currentDept} Department Admin
            </span>
          </div>
          <p className="text-secondary" style={{ fontSize: 13, margin: '4px 0 0' }}>
            Review drives posted by Central Placement Cell (Super Admin) for <strong>{currentDept}</strong>, configure department venue logistics, and set required student application fields.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div
          style={{
            display: 'flex',
            background: 'var(--surface-1)',
            padding: 4,
            borderRadius: 8,
            border: '0.5px solid var(--border)',
            gap: 4,
          }}
        >
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'central' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('central')}
            style={{ fontSize: 12 }}
          >
            🏢 Super Admin Drives ({totalCentral})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'post' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('post')}
            style={{ fontSize: 12 }}
          >
            ➕ Post Department Drive
          </button>
        </div>
      </div>

      {/* KPI Overview Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div className="card" style={{ padding: '12px 16px' }}>
          <div className="text-muted" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>Super Admin Drives</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>{totalCentral}</div>
          <div className="text-secondary" style={{ fontSize: 11 }}>Central placement drives</div>
        </div>

        <div className="card" style={{ padding: '12px 16px' }}>
          <div className="text-muted" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>Logistics Configured</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--teal)', marginTop: 4 }}>{configuredCount}</div>
          <div className="text-secondary" style={{ fontSize: 11 }}>Ready with venue & instructions</div>
        </div>

        <div className="card" style={{ padding: '12px 16px' }}>
          <div className="text-muted" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>Pending Admin Setup</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: pendingCount > 0 ? 'var(--amber)' : 'var(--text-muted)', marginTop: 4 }}>{pendingCount}</div>
          <div className="text-secondary" style={{ fontSize: 11 }}>Awaiting venue / fields config</div>
        </div>

        <div className="card" style={{ padding: '12px 16px' }}>
          <div className="text-muted" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>Student Applicants</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--purple)', marginTop: 4 }}>{totalApplicants}</div>
          <div className="text-secondary" style={{ fontSize: 11 }}>Registered department students</div>
        </div>
      </div>

      {activeTab === 'central' ? (
        /* SUPER ADMIN DRIVES MANAGEMENT VIEW */
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>
          {/* Left Column: Drive Selector & Filter List */}
          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                Super Admin Posted Drives
              </div>
              <span className="badge badge-neutral" style={{ fontSize: 10 }}>
                {filteredCentralDrives.length} drives
              </span>
            </div>

            {/* Search input */}
            <input
              type="text"
              placeholder="Search company or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px',
                fontSize: 12,
                borderRadius: 6,
                border: '0.5px solid var(--border-strong)',
                marginBottom: 10,
              }}
            />

            {/* Filter pills */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
              <button
                type="button"
                className={`btn btn-sm ${statusFilter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: 11, padding: '3px 8px', flex: 1 }}
                onClick={() => setStatusFilter('all')}
              >
                All
              </button>
              <button
                type="button"
                className={`btn btn-sm ${statusFilter === 'configured' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: 11, padding: '3px 8px', flex: 1 }}
                onClick={() => setStatusFilter('configured')}
              >
                Ready
              </button>
              <button
                type="button"
                className={`btn btn-sm ${statusFilter === 'pending' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: 11, padding: '3px 8px', flex: 1 }}
                onClick={() => setStatusFilter('pending')}
              >
                Needs Setup
              </button>
            </div>

            {/* Department scope toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '5px 8px', background: 'var(--surface-hover)', borderRadius: 6, fontSize: 11 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Department Scope:</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11, padding: '2px 6px', fontWeight: 600, color: 'var(--accent)' }}
                onClick={() => setScopeOnlyDept(!scopeOnlyDept)}
              >
                {scopeOnlyDept ? `✓ ${currentDept} Only` : 'Showing All'}
              </button>
            </div>

            {/* Drive Cards List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 'calc(100vh - 340px)', overflowY: 'auto' }}>
              {filteredCentralDrives.length === 0 ? (
                <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>
                  <div>No recruitment drives found for <strong>{currentDept}</strong>.</div>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ marginTop: 10, fontSize: 11 }}
                    onClick={() => setScopeOnlyDept(false)}
                  >
                    View drives across all departments
                  </button>
                </div>
              ) : (
                filteredCentralDrives.map((d) => {
                const isSelected = selectedDrive?.id === d.id;
                const isConfigured = Boolean(d.adminConfig?.venue || d.adminConfig?.reportingTime);
                const fieldCount = d.applicationFields?.length || 8;

                return (
                  <div
                    key={d.id}
                    onClick={() => setSelectedDriveId(d.id)}
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      border: isSelected ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                      background: isSelected ? 'var(--accent-light)' : 'var(--surface-0)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <div
                        className="company-avatar"
                        style={{
                          width: 32,
                          height: 32,
                          fontSize: 10,
                          background: isSelected ? 'var(--accent)' : 'var(--surface-2)',
                          color: isSelected ? '#fff' : 'var(--accent-dark)',
                        }}
                      >
                        {d.logoText || (d.company || 'CO').slice(0, 4).toUpperCase()}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                            {d.company}
                          </div>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              color: d.status === 'Open' ? 'var(--teal)' : 'var(--amber)',
                            }}
                          >
                            {d.status || 'Open'}
                          </span>
                        </div>

                        <div className="text-secondary" style={{ fontSize: 11, marginTop: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {d.role} · <strong>{d.ctc}</strong>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, fontSize: 10 }}>
                          <span
                            style={{
                              padding: '1px 6px',
                              borderRadius: 10,
                              background: isConfigured ? 'var(--teal-light)' : 'var(--amber-light)',
                              color: isConfigured ? 'var(--teal)' : 'var(--amber)',
                              fontWeight: 600,
                            }}
                          >
                            {isConfigured ? '✓ Configured' : '⚠ Needs Setup'}
                          </span>

                          <span className="text-muted">
                            {fieldCount} fields required
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }))}
            </div>
          </div>

          {/* Right Column: Selected Drive Workspace */}
          {selectedDrive ? (
            <div>
              {/* Drive Specifications Card (from Super Admin) */}
              <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="company-avatar" style={{ width: 44, height: 44, fontSize: 14 }}>
                      {selectedDrive.logoText || (selectedDrive.company || 'CO').slice(0, 4).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {selectedDrive.company}
                        </h2>
                        <span className="badge badge-purple" style={{ fontSize: 10 }}>
                          Posted by Super Admin
                        </span>
                        <span
                          className={`badge ${selectedDrive.status === 'Open' ? 'badge-green' : 'badge-amber'}`}
                          style={{ fontSize: 10 }}
                        >
                          {selectedDrive.status || 'Open'}
                        </span>
                      </div>
                      <div className="text-secondary" style={{ fontSize: 13, marginTop: 2 }}>
                        {selectedDrive.role} · <strong style={{ color: 'var(--accent-dark)' }}>{selectedDrive.ctc}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Actions Header */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewOpen(true)}
                      style={{ fontSize: 12 }}
                    >
                      👁 Preview Student View
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveCentralDriveConfig}
                      style={{ fontSize: 12 }}
                    >
                      💾 Save Configuration
                    </Button>
                  </div>
                </div>

                {/* Super Admin Key Specs Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: 10,
                    marginTop: 14,
                    background: 'var(--surface-1)',
                    padding: 12,
                    borderRadius: 8,
                  }}
                >
                  <div>
                    <div className="text-muted" style={{ fontSize: 10, fontWeight: 600 }}>MIN CGPA CRITERIA</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                      ≥ {selectedDrive.minCgpa ?? 6.5}
                    </div>
                  </div>

                  <div>
                    <div className="text-muted" style={{ fontSize: 10, fontWeight: 600 }}>MAX BACKLOGS</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                      ≤ {selectedDrive.maxBacklogs ?? 0} active
                    </div>
                  </div>

                  <div>
                    <div className="text-muted" style={{ fontSize: 10, fontWeight: 600 }}>ELIGIBLE DEPTS</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                      {(selectedDrive.departments || ['All']).join(', ')}
                    </div>
                  </div>

                  <div>
                    <div className="text-muted" style={{ fontSize: 10, fontWeight: 600 }}>DRIVE DATE</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                      {selectedDrive.date || selectedDrive.driveDate || 'Oct 15, 2026'}
                    </div>
                  </div>

                  <div>
                    <div className="text-muted" style={{ fontSize: 10, fontWeight: 600 }}>APP DEADLINE</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-dark)', marginTop: 2 }}>
                      {selectedDrive.deadline || 'Oct 01, 2026'}
                    </div>
                  </div>

                  <div>
                    <div className="text-muted" style={{ fontSize: 10, fontWeight: 600 }}>REGISTERED STUDENTS</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--teal)', marginTop: 2 }}>
                      {selectedDrive.applicants || 0} applicants
                    </div>
                  </div>
                </div>

                {/* Job Description from Super Admin */}
                {selectedDrive.jd && (
                  <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-secondary)', borderTop: '0.5px solid var(--border)', paddingTop: 10 }}>
                    <strong>Job Scope & Description (from Super Admin):</strong>
                    <div style={{ marginTop: 4, lineHeight: 1.5 }}>
                      {selectedDrive.jd}
                    </div>
                  </div>
                )}
              </div>

              {/* Student View Live Preview Card for Admin */}
              <AdminDrivePreviewCard
                drive={selectedDrive}
                config={adminConfig}
                fields={applicationFields}
                onTestApply={() => setPreviewOpen(true)}
              />

              {/* Panel 1: Department Logistics & Additional Information */}
              <AdminDriveLogisticsPanel
                config={adminConfig}
                onChange={handleLogisticsChange}
              />

              {/* Panel 2: Required Student Application Fields */}
              <AdminApplicationFieldsPanel
                fields={applicationFields}
                onChange={handleApplicationFieldsChange}
                onPreview={() => setPreviewOpen(true)}
              />

              {/* Sticky bottom save bar */}
              <div
                className="card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 18px',
                  background: 'var(--surface-2)',
                  border: hasUnsavedChanges ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{hasUnsavedChanges ? '⚠️' : '✅'}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {hasUnsavedChanges ? 'You have unsaved changes' : 'Drive configuration is up-to-date'}
                    </div>
                    <div className="text-muted" style={{ fontSize: 11 }}>
                      {applicationFields.length} fields configured · Venue: {adminConfig.venue ? adminConfig.venue.slice(0, 30) + '...' : 'Not set'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <Button
                    variant="outline"
                    onClick={() => setPreviewOpen(true)}
                    style={{ fontSize: 12 }}
                  >
                    👁 Preview Student Form
                  </Button>
                  <Button
                    onClick={handleSaveCentralDriveConfig}
                    style={{ fontSize: 12 }}
                  >
                    💾 Save All Changes
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <p className="text-secondary">Please select a drive from the list to view and configure its details.</p>
            </div>
          )}
        </div>
      ) : (
        /* POST NEW DEPARTMENT DRIVE TAB */
        <div style={{ maxWidth: 840, margin: '0 auto' }}>
          <form className="card" onSubmit={handleNewDriveSubmit}>
            <h3 className="section-title" style={{ marginBottom: 6 }}>Post New Department Campus Drive</h3>
            <p className="text-secondary" style={{ fontSize: 13, marginBottom: 18 }}>
              Post a drive specifically coordinated by your department. You can also configure its logistics and requirements.
            </p>

            <div className="field-row">
              <div className="field">
                <label>Company Name *</label>
                <input
                  required
                  value={newDriveForm.company}
                  onChange={(e) => setNewDriveForm((f) => ({ ...f, company: e.target.value }))}
                  placeholder="e.g. Google / Microsoft / Zoho"
                />
              </div>
              <div className="field">
                <label>Designation / Role *</label>
                <input
                  required
                  value={newDriveForm.role}
                  onChange={(e) => setNewDriveForm((f) => ({ ...f, role: e.target.value }))}
                  placeholder="e.g. Associate Software Engineer"
                />
              </div>
            </div>

            <div className="field-row" style={{ marginTop: 12 }}>
              <div className="field">
                <label>Package / CTC *</label>
                <input
                  required
                  value={newDriveForm.ctc}
                  onChange={(e) => setNewDriveForm((f) => ({ ...f, ctc: e.target.value }))}
                  placeholder="e.g. 8.5 – 12 LPA"
                />
              </div>
              <div className="field">
                <label>Min CGPA Required</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={newDriveForm.minCgpa}
                  onChange={(e) => setNewDriveForm((f) => ({ ...f, minCgpa: e.target.value }))}
                />
              </div>
            </div>

            <div className="field-row" style={{ marginTop: 12 }}>
              <div className="field">
                <label>Max Backlogs Permitted</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={newDriveForm.maxBacklogs}
                  onChange={(e) => setNewDriveForm((f) => ({ ...f, maxBacklogs: e.target.value }))}
                />
              </div>
              <div className="field">
                <label>Drive Date *</label>
                <DatePicker
                  value={newDriveForm.driveDate}
                  onChange={(v) => setNewDriveForm((f) => ({ ...f, driveDate: v }))}
                />
              </div>
            </div>

            <div className="field" style={{ marginTop: 12 }}>
              <label>Application Deadline *</label>
              <DatePicker
                value={newDriveForm.deadline}
                onChange={(v) => setNewDriveForm((f) => ({ ...f, deadline: v }))}
              />
            </div>

            <div className="field" style={{ marginTop: 12 }}>
              <label>Eligible Departments *</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                {DEPARTMENTS.map((dept) => {
                  const active = newDriveForm.departments.includes(dept);
                  return (
                    <button
                      key={dept}
                      type="button"
                      className={`btn btn-sm ${active ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() =>
                        setNewDriveForm((prev) => ({
                          ...prev,
                          departments: active
                            ? prev.departments.filter((d) => d !== dept)
                            : [...prev.departments, dept],
                        }))
                      }
                      style={{ fontSize: 12 }}
                    >
                      {active ? '✓ ' : ''}{dept}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="field" style={{ marginTop: 12 }}>
              <label>Company Career / Application Portal Link (Optional)</label>
              <UrlField
                prefix="https://"
                placeholder="careers.company.com/apply/..."
                value={(newDriveForm.applyLink || '').replace(/^https?:\/\//i, '')}
                onChange={(v) => setNewDriveForm((f) => ({ ...f, applyLink: v }))}
              />
            </div>

            <div className="field" style={{ marginTop: 12 }}>
              <label>Drive Scope & Description</label>
              <textarea
                rows={3}
                value={newDriveForm.description}
                onChange={(e) => setNewDriveForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Job responsibilities, assessment rounds, and department specific instructions..."
                style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '0.5px solid var(--border-strong)' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <Button type="button" variant="outline" onClick={() => setActiveTab('central')}>
                Cancel
              </Button>
              <Button type="submit">
                Publish Department Drive
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Student Application Preview Modal */}
      {previewOpen && selectedDrive && (
        <StudentApplicationPreviewModal
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          drive={selectedDrive}
          config={adminConfig}
          fields={applicationFields}
        />
      )}
    </AppShell>
  );
}
