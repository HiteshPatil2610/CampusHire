import { useState } from 'react';
import AppShell from '../../components/layout/AppShell';
import Button from '../../components/ui/Button';
import ProgressBar from '../../components/ui/ProgressBar';
import { useStudent } from '../../hooks/useStudent';
import { useAppState } from '../../context/AppStateContext';
import { useToast } from '../../context/ToastContext';

const TEMPLATES = ['Minimal', 'Modern', 'Classic'];

// Port of resume-builder.html — auto-generates a resume preview from profile data,
// with a template picker and an "optimize" action.
// TODO(real-data): replace generateResumeHtml-equivalent preview with a real
// PDF/HTML render from studentService, and wire optimize -> studentService.optimizeResume().
export default function ResumeBuilderPage() {
  const student = useStudent();
  const { setResumeScore, setResumeOptimized, state } = useAppState();
  const { showToast } = useToast();
  const [template, setTemplate] = useState(TEMPLATES[0]);
  const [optimizing, setOptimizing] = useState(false);

  function handleOptimize() {
    setOptimizing(true);
    // TODO(real-data): await studentService.optimizeResume()
    setTimeout(() => {
      setResumeScore(Math.min(100, state.resumeScore + 12));
      setResumeOptimized(true);
      setOptimizing(false);
      showToast('Resume optimized! Score improved.', 'success');
    }, 900);
  }

  return (
    <AppShell role="student" user={student}>
      <h1 className="page-title" style={{ marginBottom: 20 }}>Resume Builder</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="kpi-label" style={{ marginBottom: 8 }}>Resume score</div>
            <div className="kpi-value" style={{ marginBottom: 8 }}>{state.resumeScore}/100</div>
            <ProgressBar percent={state.resumeScore} />
            <Button style={{ marginTop: 14, width: '100%', justifyContent: 'center' }} onClick={handleOptimize} disabled={optimizing}>
              {optimizing ? 'Optimizing…' : '✦ Auto-optimize with AI'}
            </Button>
          </div>

          <div className="card">
            <div className="section-title" style={{ marginBottom: 10, fontSize: 13 }}>Template</div>
            {TEMPLATES.map((t) => (
              <div
                key={t}
                className="sidebar-link"
                style={{ cursor: 'pointer' }}
                onClick={() => setTemplate(t)}
              >
                <span style={{ fontWeight: template === t ? 600 : 400, color: template === t ? 'var(--accent-dark)' : 'inherit' }}>
                  {template === t ? '● ' : '○ '}{t}
                </span>
              </div>
            ))}
            <Button variant="outline" style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}>
              Download PDF
            </Button>
          </div>
        </div>

        <div className="card" style={{ padding: 32, minHeight: 600 }}>
          <div style={{ borderBottom: '2px solid var(--accent)', paddingBottom: 12, marginBottom: 16 }}>
            <h2 style={{ fontSize: 22 }}>{student.name}</h2>
            <div className="text-secondary" style={{ fontSize: 12 }}>
              {student.email} · {student.phone} · {student.address}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <h3 className="section-title" style={{ fontSize: 13, textTransform: 'uppercase', marginBottom: 6 }}>Education</h3>
            <div style={{ fontSize: 13 }}>{student.department} — CGPA {student.cgpa}</div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <h3 className="section-title" style={{ fontSize: 13, textTransform: 'uppercase', marginBottom: 6 }}>Skills</h3>
            <div style={{ fontSize: 13 }}>{(student.technicalSkills || []).join(', ')}</div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <h3 className="section-title" style={{ fontSize: 13, textTransform: 'uppercase', marginBottom: 6 }}>Projects</h3>
            {(student.projects || []).map((p) => (
              <div key={p.id} style={{ marginBottom: 8, fontSize: 13 }}>
                <strong>{p.title}</strong> — {p.description}
              </div>
            ))}
          </div>

          <div>
            <h3 className="section-title" style={{ fontSize: 13, textTransform: 'uppercase', marginBottom: 6 }}>Certifications</h3>
            {(student.certifications || []).map((c) => (
              <div key={c.id} style={{ fontSize: 13 }}>{c.title} — {c.issuer} ({c.date})</div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
