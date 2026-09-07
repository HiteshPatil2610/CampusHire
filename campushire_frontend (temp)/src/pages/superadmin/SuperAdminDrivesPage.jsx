import { useState } from 'react';
import AppShell from '../../components/layout/AppShell';
import Button from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import DatePicker from '../../components/ui/DatePicker';
import UrlField from '../../components/ui/UrlField';
import Modal from '../../components/ui/Modal';
import { SUPER_ADMIN, CENTRAL_DRIVES } from '../../data/mockData';
import { useToast } from '../../context/ToastContext';

// Port of super-admin-drives.html — TPO manages central (cross-department) drives
// and configures per-drive admin settings + application fields.
export default function SuperAdminDrivesPage() {
  const user = { name: SUPER_ADMIN.name, initials: 'VR' };
  const { showToast } = useToast();

  const [drivesList, setDrivesList] = useState(() => CENTRAL_DRIVES);
  const [selectedId, setSelectedId] = useState(() => CENTRAL_DRIVES[0]?.id || 'cd_1');
  const [showPostModal, setShowPostModal] = useState(false);

  // New central drive form
  const [newDrive, setNewDrive] = useState({
    company: '',
    role: '',
    ctc: '',
    minCgpa: '7.0',
    date: '2026-09-15',
    deadline: '2026-09-10',
    departments: ['CSE', 'ECE', 'IT'],
    portalUrl: '',
    pptLink: '',
    jd: '',
  });

  const selected = drivesList.find((d) => d.id === selectedId) || drivesList[0];

  function handleSaveSelected() {
    showToast(`Drive configuration for ${selected.company} saved successfully!`, 'success');
  }

  function handleCreateCentralDrive(e) {
    e.preventDefault();
    if (!newDrive.company.trim() || !newDrive.role.trim() || !newDrive.ctc.trim()) {
      showToast('Please enter company, role, and package details.', 'error');
      return;
    }

    const created = {
      id: `cd_${Date.now()}`,
      company: newDrive.company.trim(),
      role: newDrive.role.trim(),
      ctc: newDrive.ctc.trim(),
      minCgpa: parseFloat(newDrive.minCgpa) || 6.5,
      departments: newDrive.departments,
      date: newDrive.date,
      deadline: newDrive.deadline,
      status: 'Open',
      applicants: 0,
      rounds: 'Online Assessment → Technical Interview → HR',
      jd: newDrive.jd.trim() || `${newDrive.role} hiring drive for eligible graduates.`,
      applyLink: newDrive.portalUrl ? (newDrive.portalUrl.startsWith('http') ? newDrive.portalUrl : `https://${newDrive.portalUrl}`) : '',
      adminConfig: {
        venue: 'Main Campus Convention Center',
        reportingTime: '08:30 AM',
        contactPerson: 'TPO Central Desk',
        contactPhone: '98000 00001',
        pptLink: newDrive.pptLink ? (newDrive.pptLink.startsWith('http') ? newDrive.pptLink : `https://${newDrive.pptLink}`) : '',
        configured: true,
      },
      applicationFields: [
        { key: 'resume', label: 'Resume attachment', source: 'profile', category: 'Documents', required: true, enabled: true },
        { key: 'cgpa', label: 'Current CGPA', source: 'profile', category: 'Academic Records', required: true, enabled: true },
        { key: 'phone', label: 'Phone number', source: 'profile', category: 'Contact Info', required: true, enabled: true },
      ],
    };

    setDrivesList((prev) => [created, ...prev]);
    setSelectedId(created.id);
    setShowPostModal(false);
    showToast(`Central drive for ${created.company} created successfully!`, 'success');
  }

  return (
    <AppShell role="superadmin" user={user}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Central Drives</h1>
          <p className="text-secondary" style={{ fontSize: 13, margin: '4px 0 0' }}>
            Configure institutional campus placement drives across all engineering departments.
          </p>
        </div>
        <Button onClick={() => setShowPostModal(true)}>
          + Post Central Drive
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20 }}>
        {/* Drive list on the left */}
        <div>
          {drivesList.map((d) => (
            <div
              key={d.id}
              className="card"
              style={{
                marginBottom: 10,
                cursor: 'pointer',
                borderColor: selected?.id === d.id ? 'var(--accent)' : undefined,
                background: selected?.id === d.id ? 'var(--surface-hover)' : undefined,
              }}
              onClick={() => setSelectedId(d.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <strong style={{ fontSize: 14 }}>{d.company}</strong>
                  <div className="text-secondary" style={{ fontSize: 12, marginTop: 2 }}>{d.role}</div>
                </div>
                <Badge variant={d.status === 'Open' ? 'green' : d.status === 'Upcoming' ? 'purple' : 'red'}>
                  {d.status}
                </Badge>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                <span>📅 {d.date}</span>
                <span>🎓 Min {d.minCgpa}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Selected Drive Configuration Panel on the right */}
        {selected && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <h3 className="section-title" style={{ margin: 0 }}>{selected.company} — {selected.role}</h3>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Package: <strong>{selected.ctc}</strong> · Departments: {selected.departments?.join(', ')}
                </div>
              </div>
              <Badge variant="green">{selected.status}</Badge>
            </div>

            <p className="text-secondary" style={{ fontSize: 13, margin: '0 0 16px', lineHeight: 1.5 }}>
              {selected.jd}
            </p>

            {/* Key Drive Dates with DatePicker */}
            <div className="app-section-head">Key Placement Dates</div>
            <div className="field-row">
              <div className="field">
                <label>Drive Date</label>
                <DatePicker
                  value={selected.date}
                  onChange={(val) => {
                    setDrivesList((list) =>
                      list.map((item) => (item.id === selected.id ? { ...item, date: val } : item))
                    );
                  }}
                />
              </div>
              <div className="field">
                <label>Application Deadline</label>
                <DatePicker
                  value={selected.deadline}
                  onChange={(val) => {
                    setDrivesList((list) =>
                      list.map((item) => (item.id === selected.id ? { ...item, deadline: val } : item))
                    );
                  }}
                />
              </div>
            </div>

            {/* Online Links with UrlField */}
            <div className="app-section-head" style={{ marginTop: 16 }}>Portals & Online Links</div>
            <div className="field-row">
              <div className="field">
                <label>Company Career / Registration Portal</label>
                <UrlField
                  prefix="https://"
                  placeholder="careers.company.com"
                  value={(selected.applyLink || '').replace(/^https?:\/\//i, '')}
                  onChange={(val) => {
                    setDrivesList((list) =>
                      list.map((item) =>
                        item.id === selected.id
                          ? { ...item, applyLink: val ? (val.startsWith('http') ? val : `https://${val}`) : '' }
                          : item
                      )
                    );
                  }}
                />
              </div>
              <div className="field">
                <label>Pre-Placement Talk (PPT) / Virtual Meeting Link</label>
                <UrlField
                  prefix="https://"
                  placeholder="meet.google.com/..."
                  value={(selected.adminConfig?.pptLink || '').replace(/^https?:\/\//i, '')}
                  onChange={(val) => {
                    const formatted = val ? (val.startsWith('http') ? val : `https://${val}`) : '';
                    setDrivesList((list) =>
                      list.map((item) =>
                        item.id === selected.id
                          ? { ...item, adminConfig: { ...item.adminConfig, pptLink: formatted } }
                          : item
                      )
                    );
                  }}
                />
              </div>
            </div>

            {/* Venue & logistics */}
            <div className="app-section-head" style={{ marginTop: 16 }}>Venue & Logistics</div>
            <div className="field-row">
              <div className="field">
                <label>Venue</label>
                <input
                  value={selected.adminConfig?.venue || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDrivesList((list) =>
                      list.map((item) =>
                        item.id === selected.id
                          ? { ...item, adminConfig: { ...item.adminConfig, venue: val } }
                          : item
                      )
                    );
                  }}
                />
              </div>
              <div className="field">
                <label>Reporting Time</label>
                <input
                  value={selected.adminConfig?.reportingTime || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDrivesList((list) =>
                      list.map((item) =>
                        item.id === selected.id
                          ? { ...item, adminConfig: { ...item.adminConfig, reportingTime: val } }
                          : item
                      )
                    );
                  }}
                />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Contact Person</label>
                <input
                  value={selected.adminConfig?.contactPerson || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDrivesList((list) =>
                      list.map((item) =>
                        item.id === selected.id
                          ? { ...item, adminConfig: { ...item.adminConfig, contactPerson: val } }
                          : item
                      )
                    );
                  }}
                />
              </div>
              <div className="field">
                <label>Contact Phone</label>
                <input
                  value={selected.adminConfig?.contactPhone || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDrivesList((list) =>
                      list.map((item) =>
                        item.id === selected.id
                          ? { ...item, adminConfig: { ...item.adminConfig, contactPhone: val } }
                          : item
                      )
                    );
                  }}
                />
              </div>
            </div>

            {/* Application fields */}
            <div className="app-section-head" style={{ marginTop: 16 }}>Application Fields Required</div>
            {selected.applicationFields?.map((f) => (
              <div className="pref-row" key={f.key}>
                <span style={{ fontSize: 13 }}>
                  {f.label} {f.required && <span style={{ color: 'var(--red)' }}>*</span>}
                </span>
                <button
                  type="button"
                  className={`toggle-switch ${f.enabled ? 'on' : ''}`}
                  onClick={() => {
                    setDrivesList((list) =>
                      list.map((item) =>
                        item.id === selected.id
                          ? {
                              ...item,
                              applicationFields: item.applicationFields.map((field) =>
                                field.key === f.key ? { ...field, enabled: !field.enabled } : field
                              ),
                            }
                          : item
                      )
                    );
                  }}
                >
                  <span className="knob" />
                </button>
              </div>
            ))}

            <Button style={{ marginTop: 20 }} onClick={handleSaveSelected}>
              Save Configuration
            </Button>
          </div>
        )}
      </div>

      {/* Post Central Drive Modal */}
      {showPostModal && (
        <Modal
          open={showPostModal}
          onClose={() => setShowPostModal(false)}
          title="Post New Central Campus Drive"
        >
          <form onSubmit={handleCreateCentralDrive} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="field-row">
              <div className="field">
                <label>Company Name *</label>
                <input
                  required
                  placeholder="e.g. Google, Microsoft, Adobe"
                  value={newDrive.company}
                  onChange={(e) => setNewDrive((d) => ({ ...d, company: e.target.value }))}
                />
              </div>
              <div className="field">
                <label>Role / Designation *</label>
                <input
                  required
                  placeholder="e.g. Software Engineer"
                  value={newDrive.role}
                  onChange={(e) => setNewDrive((d) => ({ ...d, role: e.target.value }))}
                />
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label>Package / CTC *</label>
                <input
                  required
                  placeholder="e.g. 14 – 22 LPA"
                  value={newDrive.ctc}
                  onChange={(e) => setNewDrive((d) => ({ ...d, ctc: e.target.value }))}
                />
              </div>
              <div className="field">
                <label>Min CGPA Cutoff</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={newDrive.minCgpa}
                  onChange={(e) => setNewDrive((d) => ({ ...d, minCgpa: e.target.value }))}
                />
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label>Drive Date *</label>
                <DatePicker
                  value={newDrive.date}
                  onChange={(v) => setNewDrive((d) => ({ ...d, date: v }))}
                />
              </div>
              <div className="field">
                <label>Application Deadline *</label>
                <DatePicker
                  value={newDrive.deadline}
                  onChange={(v) => setNewDrive((d) => ({ ...d, deadline: v }))}
                />
              </div>
            </div>

            <div className="field">
              <label>Company Portal / Registration URL (Optional)</label>
              <UrlField
                prefix="https://"
                placeholder="careers.company.com/apply"
                value={(newDrive.portalUrl || '').replace(/^https?:\/\//i, '')}
                onChange={(v) => setNewDrive((d) => ({ ...d, portalUrl: v }))}
              />
            </div>

            <div className="field">
              <label>Pre-Placement Talk (PPT) Link (Optional)</label>
              <UrlField
                prefix="https://"
                placeholder="meet.google.com/..."
                value={(newDrive.pptLink || '').replace(/^https?:\/\//i, '')}
                onChange={(v) => setNewDrive((d) => ({ ...d, pptLink: v }))}
              />
            </div>

            <div className="field">
              <label>Job Description & Instructions</label>
              <textarea
                rows={3}
                placeholder="Key requirements, selection rounds, and guidelines..."
                value={newDrive.jd}
                onChange={(e) => setNewDrive((d) => ({ ...d, jd: e.target.value }))}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
              <Button type="button" variant="outline" onClick={() => setShowPostModal(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Create Central Drive
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </AppShell>
  );
}

