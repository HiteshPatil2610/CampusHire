import type { CompleteProfile } from '@/features/students/queries/profile-completion';
import {
  ENTRY_TYPE_LABELS,
  preCollegePercentage,
  preCollegeQualificationLabel,
} from '@/features/students/utils/entry-type';
import { formatPreCollegeScore } from '@/features/students/utils/score-conversion';
import { requiredMarkSemesters } from '@/features/drives/domain/eligibility-evaluator';
import { parseJsonArray } from '@/lib/parse-json-array';

/**
 * Everything a student has put on their profile, for their department admin:
 * semester results (with the grade cards), the academic record, personal
 * details, projects, experience, certifications and preferences.
 *
 * Read-only. Marks count for eligibility as soon as they are uploaded — an
 * admin's verification is not required — so the results table shows each
 * semester's verification state for information, and which semesters a
 * final-year student still has to upload to see final-year drives.
 */

const card: React.CSSProperties = { padding: 14 };
const heading: React.CSSProperties = { fontSize: 13, fontWeight: 600, marginBottom: 10 };
const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12 };
const muted: React.CSSProperties = { color: 'var(--text-secondary)' };

const day = (value: Date | string | null | undefined) =>
  value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

/** Only web links are rendered as links; anything else is shown as text. */
function SafeLink({ href, children }: { href: string | null | undefined; children: React.ReactNode }) {
  if (!href || !/^https?:\/\//i.test(href)) return <span>—</span>;
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" style={{ color: 'var(--accent)' }}>
      {children}
    </a>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={row}>
      <span style={muted}>{label}</span>
      <span style={{ textAlign: 'right', wordBreak: 'break-word' }}>{children}</span>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-muted" style={{ fontSize: 12 }}>{children}</div>;
}

export function StudentProfileSections({ profile }: { profile: CompleteProfile }) {
  const { student, academic, semesterMarks, projects, experiences, certifications, preferences } = profile;
  const required = requiredMarkSemesters(student.entryType);
  const uploaded = new Set(semesterMarks.map((mark) => mark.semester));
  const missing = required.filter((semester) => !uploaded.has(semester));
  const preCollege = preCollegePercentage(student.entryType, academic);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Semester results */}
      <div className="card" style={card}>
        <div style={{ ...heading, display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <span>📑 Semester Results</span>
          <span className={`badge ${missing.length === 0 ? 'badge-teal' : 'badge-amber'}`} style={{ fontSize: 10 }}>
            {missing.length === 0
              ? `Semesters ${required[0]}–${required[required.length - 1]} uploaded`
              : `Missing semester${missing.length === 1 ? '' : 's'} ${missing.join(', ')}`}
          </span>
        </div>
        {semesterMarks.length === 0 ? (
          <Empty>No semester results uploaded yet.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Semester</th>
                  <th>SGPA</th>
                  <th>Grade card</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {semesterMarks.map((mark) => (
                  <tr key={mark.id}>
                    <td>Sem {mark.semester}</td>
                    <td>
                      <strong>{mark.sgpa.toFixed(2)}</strong>
                    </td>
                    <td>
                      <SafeLink href={mark.gradeCardUrl}>View ↗</SafeLink>
                    </td>
                    <td>
                      <span className={`badge ${mark.isVerified ? 'badge-teal' : 'badge-gray'}`} style={{ fontSize: 10 }}>
                        {mark.isVerified ? 'Verified' : 'Uploaded'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="text-muted" style={{ fontSize: 11, marginTop: 8 }}>
          Final-year drives need semesters {required[0]}–{required[required.length - 1]} uploaded
          {student.entryType === 'DIPLOMA' ? ' (lateral entry: no semester 1 or 2)' : ''}. Uploaded marks count
          without verification.
        </div>
      </div>

      {/* Academic record */}
      <div className="card" style={card}>
        <div style={heading}>🎓 Academic Record</div>
        {!academic ? (
          <Empty>The student has not filled in their academic details yet.</Empty>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px 24px' }}>
            <Row label="Entry type">{ENTRY_TYPE_LABELS[student.entryType]}</Row>
            <Row label="CGPA">{academic.currentCGPA ?? 'Not yet (no finished semester)'}</Row>
            <Row label="Active backlogs">{academic.activeBacklogs}</Row>
            <Row label="Past backlogs (cleared)">{academic.pastBacklogCount}</Row>
            <Row label="10th %">
              {formatPreCollegeScore(academic.tenthPercentage, academic.tenthCgpa)}
              {academic.tenthBoard ? ` · ${academic.tenthBoard}` : ''}
              {academic.tenthYear ? ` · ${academic.tenthYear}` : ''}
            </Row>
            <Row label="10th marksheet">
              <SafeLink href={academic.tenthMarksheetUrl}>View ↗</SafeLink>
            </Row>
            <Row label={`${preCollegeQualificationLabel(student.entryType)} %`}>
              {formatPreCollegeScore(
                preCollege,
                student.entryType === 'DIPLOMA' ? academic.diplomaCgpa : academic.twelfthCgpa
              ) ?? '—'}
              {student.entryType === 'DIPLOMA'
                ? `${academic.diplomaBoard ? ` · ${academic.diplomaBoard}` : ''}${academic.diplomaYear ? ` · ${academic.diplomaYear}` : ''}`
                : `${academic.twelfthBoard ? ` · ${academic.twelfthBoard}` : ''}${academic.twelfthYear ? ` · ${academic.twelfthYear}` : ''}`}
            </Row>
            <Row label={`${preCollegeQualificationLabel(student.entryType)} marksheet`}>
              <SafeLink href={student.entryType === 'DIPLOMA' ? academic.diplomaMarksheetUrl : academic.twelfthMarksheetUrl}>
                View ↗
              </SafeLink>
            </Row>
          </div>
        )}
      </div>

      {/* Personal details */}
      <div className="card" style={card}>
        <div style={heading}>👤 Personal Details</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px 24px' }}>
          <Row label="Gender">{student.gender || '—'}</Row>
          <Row label="Date of birth">{day(student.dateOfBirth)}</Row>
          <Row label="Personal email">{student.personalEmail || '—'}</Row>
          <Row label="Portfolio">
            <SafeLink href={student.portfolioUrl}>Open ↗</SafeLink>
          </Row>
          <Row label="Address">{student.address || '—'}</Row>
        </div>
      </div>

      {/* Projects */}
      <div className="card" style={card}>
        <div style={heading}>🛠 Projects ({projects.length})</div>
        {projects.length === 0 ? (
          <Empty>No projects added.</Empty>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {projects.map((project) => (
              <div key={project.id} style={{ fontSize: 12, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong>{project.title}</strong>
                  <SafeLink href={project.projectUrl}>Link ↗</SafeLink>
                </div>
                <div style={muted}>
                  {project.technologiesUsed}
                  {project.startDate ? ` · ${day(project.startDate)} – ${project.endDate ? day(project.endDate) : 'ongoing'}` : ''}
                </div>
                <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{project.description}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Experience */}
      <div className="card" style={card}>
        <div style={heading}>💼 Experience ({experiences.length})</div>
        {experiences.length === 0 ? (
          <Empty>No experience added.</Empty>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {experiences.map((experience) => (
              <div key={experience.id} style={{ fontSize: 12, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong>
                    {experience.role} · {experience.companyName}
                  </strong>
                  <SafeLink href={experience.certificateUrl}>Certificate ↗</SafeLink>
                </div>
                <div style={muted}>
                  {day(experience.startDate)} – {experience.endDate ? day(experience.endDate) : 'present'}
                </div>
                <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{experience.description}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Certifications */}
      <div className="card" style={card}>
        <div style={heading}>📜 Certifications ({certifications.length})</div>
        {certifications.length === 0 ? (
          <Empty>No certifications added.</Empty>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {certifications.map((certification) => (
              <div key={certification.id} style={{ ...row, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                <span>
                  <strong>{certification.certificationName}</strong>
                  <span style={muted}>
                    {' '}
                    · {certification.issuingOrganization} · {day(certification.issueDate)}
                    {certification.expiryDate ? ` (expires ${day(certification.expiryDate)})` : ''}
                  </span>
                </span>
                <SafeLink href={certification.credentialUrl}>Credential ↗</SafeLink>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preferences */}
      <div className="card" style={card}>
        <div style={heading}>🎯 Job Preferences</div>
        {!preferences ? (
          <Empty>No preferences set.</Empty>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            <Row label="Preferred roles">{parseJsonArray(preferences.preferredRoles).join(', ') || '—'}</Row>
            <Row label="Company types">{parseJsonArray(preferences.preferredCompanyTypes).join(', ') || '—'}</Row>
            <Row label="Work modes">{parseJsonArray(preferences.workModes).join(', ') || '—'}</Row>
            <Row label="Expected package">
              {preferences.expectedPackageMin || preferences.expectedPackageMax
                ? `${preferences.expectedPackageMin ?? '—'} – ${preferences.expectedPackageMax ?? '—'} LPA`
                : '—'}
            </Row>
            <Row label="Willing to relocate">{preferences.willingToRelocate ? 'Yes' : 'No'}</Row>
          </div>
        )}
      </div>
    </div>
  );
}
