import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell';
import Button from '../../components/ui/Button';
import { DEPT_ADMIN } from '../../data/mockData';
import { useToast } from '../../context/ToastContext';
import { useAppState } from '../../context/AppStateContext';
import { useAuth } from '../../context/AuthContext';
import { PATHS } from '../../routes/paths';

export default function AddStudentPage() {
  const { user: authUser } = useAuth();
  const user = authUser || { name: DEPT_ADMIN.name, initials: 'DA' };
  const currentDept = user.department || DEPT_ADMIN.department;

  const [form, setForm] = useState({ name: '', rollNo: '', email: '', cgpa: '', year: '4th' });
  const { showToast } = useToast();
  const { addStudent } = useAppState();
  const navigate = useNavigate();

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.rollNo.trim() || !form.email.trim()) {
      showToast('Please fill in student Name, Roll Number, and Email.', 'error');
      return;
    }

    addStudent({
      ...form,
      dept: currentDept,
    });

    showToast(`${form.name} enrolled in ${currentDept} placement records.`, 'success');
    navigate(PATHS.adminDashboard);
  }

  return (
    <AppShell role="admin" user={user}>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title" style={{ marginBottom: 4 }}>Add Student</h1>
        <p className="text-secondary" style={{ fontSize: 13 }}>
          Enroll an individual student manually into the {currentDept} placement roster.
        </p>
      </div>

      <form className="card" style={{ maxWidth: 520 }} onSubmit={handleSubmit}>
        <div className="field">
          <label>Full Name *</label>
          <input required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Aditi Sharma" />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Roll Number *</label>
            <input required value={form.rollNo} onChange={(e) => set('rollNo', e.target.value)} placeholder="e.g. 21CS042" />
          </div>
          <div className="field">
            <label>Year</label>
            <select value={form.year} onChange={(e) => set('year', e.target.value)}>
              <option value="1st">1st Year</option>
              <option value="2nd">2nd Year</option>
              <option value="3rd">3rd Year</option>
              <option value="4th">4th Year</option>
            </select>
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>College Email *</label>
            <input required type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="student@college.edu" />
          </div>
          <div className="field">
            <label>CGPA</label>
            <input type="number" step="0.01" min="0" max="10" value={form.cgpa} onChange={(e) => set('cgpa', e.target.value)} placeholder="e.g. 8.4" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <Button variant="outline" type="button" onClick={() => navigate(PATHS.adminDashboard)}>
            Cancel
          </Button>
          <Button type="submit">Enroll Student</Button>
        </div>
      </form>
    </AppShell>
  );
}

