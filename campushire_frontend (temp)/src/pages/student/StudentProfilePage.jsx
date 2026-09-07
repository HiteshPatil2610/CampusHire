import { useState } from 'react';
import AppShell from '../../components/layout/AppShell';
import ProfileHeaderStrip from '../../components/student/profile/ProfileHeaderStrip';
import TabPersonalInfo from '../../components/student/profile/TabPersonalInfo';
import TabAcademicInfo from '../../components/student/profile/TabAcademicInfo';
import TabSkillsLinks from '../../components/student/profile/TabSkillsLinks';
import TabProjects, { isProjectComplete } from '../../components/student/profile/TabProjects';
import TabExperience from '../../components/student/profile/TabExperience';
import TabCertifications from '../../components/student/profile/TabCertifications';
import TabPreferences from '../../components/student/profile/TabPreferences';

import { useStudent } from '../../hooks/useStudent';
import { useAppState } from '../../context/AppStateContext';
import { useToast } from '../../context/ToastContext';
import { computeProfileCompletion } from '../../utils/profileCompletion';
import { STUDENT } from '../../data/mockData';

const TABS = [
  'Personal Info',
  'Academic Info',
  'Skills & Links',
  'Projects',
  'Internships & Experience',
  'Certifications',
  'Preferences',
];

export default function StudentProfilePage() {
  const student = useStudent();
  const { saveStudent, saveStudentOverrides, setProfileCompletion, state } = useAppState();
  const { showToast } = useToast();

  const [tab, setTab] = useState(TABS[0]);
  const [form, setForm] = useState(() => ({
    ...STUDENT,
    ...student,
    dob: student.dob || '2004-03-12',
    tenth: student.tenth || '92%',
    tenthBoard: student.tenthBoard || 'CBSE, 2019',
    twelfth: student.twelfth || '89%',
    twelfthBoard: student.twelfthBoard || 'CBSE, 2021',
    cgpa: student.cgpa ?? 8.4,
    semester: student.semester || '7th semester',
    activeBacklogs: student.activeBacklogs || 'No',
    backlogHistory: student.backlogHistory ?? 0,
    companyType: student.companyType || 'Product',
    relocate: student.relocate || 'Yes',
    workMode: student.workMode || ['On-site'],
  }));

  const [photoPreview, setPhotoPreview] = useState(null);
  const [attachedFiles, setAttachedFiles] = useState(() => ({
    tenthMarksheet: '10th_marksheet_verified.pdf',
    twelfthMarksheet: '12th_marksheet_verified.pdf',
    'sem-1': 'sem1_gradecard.pdf',
    'sem-2': 'sem2_gradecard.pdf',
    'sem-3': 'sem3_gradecard.pdf',
    'sem-4': 'sem4_gradecard.pdf',
    'sem-5': 'sem5_gradecard.pdf',
    'sem-6': 'sem6_gradecard.pdf',
    'exp-1': 'InnoTech_Offer_Certificate.pdf',
    ...(student.attachedFiles || {}),
  }));

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function setAttachedFile(key, fileName) {
    setAttachedFiles((prev) => ({ ...prev, [key]: fileName }));
  }

  function handleSave() {
    // 1. Validation Rule: Validate all project cards are complete
    const projects = form.projects || [];
    const hasIncomplete = projects.some((p) => !isProjectComplete(p));
    if (hasIncomplete) {
      setTab('Projects');
      showToast('Please complete all required fields in your projects before saving.', 'error');
      return;
    }

    // 2. Flush all values to updated student object
    const updatedStudent = {
      ...student,
      ...form,
      attachedFiles,
      photoPreview,
    };

    // 3. Computes profileCompletion across 10 fields
    const pct = computeProfileCompletion(updatedStudent);
    setProfileCompletion(pct);

    // 4. Calls AppState.saveStudent(STUDENT) and saveStudentOverrides
    if (saveStudent) saveStudent(updatedStudent);
    if (saveStudentOverrides) saveStudentOverrides(updatedStudent);
    Object.assign(STUDENT, updatedStudent);

    // 5. Shows "Profile changes saved successfully!" toast
    showToast('Profile changes saved successfully!', 'success');
  }

  const completionPct = state.profileCompletion ?? computeProfileCompletion(form);

  return (
    <AppShell
      role="student"
      user={{ ...student, name: form.name }}
      showProfileCompletion
      onSave={handleSave}
    >
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <h1 className="page-title" style={{ marginBottom: 16 }}>
          Student Profile
        </h1>

        {/* Dynamic Header Strip with Progress, Avatar, and Quick Save */}
        <ProfileHeaderStrip
          student={{ ...student, name: form.name, department: form.department || 'CSE' }}
          completion={completionPct}
          onSave={handleSave}
          photoPreview={photoPreview}
        />

        <div className="profile-layout">
          {/* Vertical Sticky Tabs Navigation */}
          <div className="profile-tabs">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                className={`profile-tab ${tab === t ? 'active' : ''}`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Active Tab Card Container */}
          <div className="card" style={{ padding: 24, minHeight: 480 }}>
            {tab === 'Personal Info' && (
              <TabPersonalInfo
                form={form}
                setField={setField}
                onSave={handleSave}
                photoPreview={photoPreview}
                setPhotoPreview={setPhotoPreview}
                showToast={showToast}
              />
            )}

            {tab === 'Academic Info' && (
              <TabAcademicInfo
                form={form}
                setField={setField}
                onSave={handleSave}
                attachedFiles={attachedFiles}
                setAttachedFile={setAttachedFile}
                showToast={showToast}
              />
            )}

            {tab === 'Skills & Links' && (
              <TabSkillsLinks
                form={form}
                setField={setField}
                onSave={handleSave}
              />
            )}

            {tab === 'Projects' && (
              <TabProjects
                form={form}
                setField={setField}
                onSave={handleSave}
                showToast={showToast}
              />
            )}

            {tab === 'Internships & Experience' && (
              <TabExperience
                form={form}
                setField={setField}
                onSave={handleSave}
                attachedFiles={attachedFiles}
                setAttachedFile={setAttachedFile}
                showToast={showToast}
              />
            )}

            {tab === 'Certifications' && (
              <TabCertifications
                form={form}
                setField={setField}
                onSave={handleSave}
                showToast={showToast}
              />
            )}

            {tab === 'Preferences' && (
              <TabPreferences
                form={form}
                setField={setField}
                onSave={handleSave}
              />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
