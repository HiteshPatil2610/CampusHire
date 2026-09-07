import { useState, useRef } from 'react';
import AppShell from '../../components/layout/AppShell';
import Button from '../../components/ui/Button';
import Gauge from '../../components/ui/Gauge';
import { useStudent } from '../../hooks/useStudent';
import { useAppState } from '../../context/AppStateContext';
import { useToast } from '../../context/ToastContext';

const INITIAL_SUGGESTIONS = [
  { id: 1, severity: 'red', category: 'Measurable Impact', text: 'Add quantifiable metrics to project descriptions (e.g. "reduced API latency by 35%" instead of "worked on speed").' },
  { id: 2, severity: 'amber', category: 'Keywords', text: 'Your skills section is missing core industry keywords: "REST APIs", "CI/CD", and "Unit Testing".' },
  { id: 3, severity: 'amber', category: 'Structure', text: 'Add a concise 3-line professional summary highlighting your primary tech stack.' },
  { id: 4, severity: 'green', category: 'Action Verbs', text: 'Strong use of active technical verbs ("Architected", "Spearheaded", "Engineered").' },
];

export default function AiAnalyzerPage() {
  const student = useStudent();
  const { state, setResumeScore, setResumeOptimized } = useAppState();
  const { showToast } = useToast();
  const fileInputRef = useRef(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [uploadedResume, setUploadedResume] = useState({ name: 'Aditi_Sharma_Resume.pdf', size: '240 KB' });
  const [suggestions, setSuggestions] = useState(INITIAL_SUGGESTIONS);

  const currentScore = state.resumeScore;

  function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf') && !file.name.toLowerCase().endsWith('.docx')) {
      showToast('Please upload a valid .pdf or .docx resume.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Resume size must be under 5MB.', 'error');
      return;
    }

    setUploadedResume({
      name: file.name,
      size: `${(file.size / 1024).toFixed(1)} KB`,
    });
    triggerAnalysis(file.name);
  }

  function triggerAnalysis(fileName = uploadedResume.name) {
    setAnalyzing(true);
    setTimeout(() => {
      setAnalyzing(false);
      showToast(`Analysis complete for ${fileName}! ATS score refreshed.`, 'success');
    }, 1000);
  }

  function handleAutoOptimize() {
    setAnalyzing(true);
    setTimeout(() => {
      setAnalyzing(false);
      setResumeScore(88);
      setResumeOptimized(true);
      setSuggestions([
        { id: 1, severity: 'green', category: 'Measurable Impact', text: 'Quantifiable metrics applied across all listed projects.' },
        { id: 2, severity: 'green', category: 'Keywords', text: 'Missing ATS keywords synthesized into skills & project blurbs.' },
        { id: 3, severity: 'green', category: 'Structure', text: 'Professional summary added and calibrated for software roles.' },
        { id: 4, severity: 'green', category: 'Action Verbs', text: 'Consistent active phrasing verified throughout.' },
      ]);
      showToast('Resume optimized! Score increased to 88/100.', 'success');
    }, 1200);
  }

  return (
    <AppShell role="student" user={student}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 className="page-title">AI Resume Analyzer & ATS Optimizer</h1>
          <p className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>
            Verify keyword relevance, formatting consistency, and impact metrics against campus recruiter filters.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            type="file"
            ref={fileInputRef}
            accept=".pdf,.docx"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            📤 Upload New Resume
          </Button>
          <Button disabled={analyzing || state.resumeOptimized} onClick={handleAutoOptimize}>
            {state.resumeOptimized ? '✓ Optimized' : '✨ 1-Click ATS Boost'}
          </Button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 24 }}>
        {/* ATS Score & Breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <Gauge score={currentScore} caption="ATS Readiness Score" />
            <div className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>
              Active Document: <strong>{uploadedResume.name}</strong> ({uploadedResume.size})
            </div>
            <Button
              variant="outline"
              style={{ marginTop: 14, width: '100%', justifyContent: 'center' }}
              onClick={() => triggerAnalysis()}
              disabled={analyzing}
            >
              {analyzing ? 'Evaluating…' : '🔄 Re-evaluate'}
            </Button>
          </div>

          <div className="card">
            <h4 style={{ fontSize: 13, marginBottom: 10 }}>ATS Sub-Scores</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Keywords & Stack</span>
                  <strong>{state.resumeOptimized ? '90%' : '65%'}</strong>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: state.resumeOptimized ? '90%' : '65%', background: 'var(--teal)' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Measurable Metrics</span>
                  <strong>{state.resumeOptimized ? '85%' : '45%'}</strong>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: state.resumeOptimized ? '85%' : '45%', background: state.resumeOptimized ? 'var(--teal)' : 'var(--amber)' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Layout & Readability</span>
                  <strong>92%</strong>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: '92%', background: 'var(--teal)' }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Suggestions */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 className="section-title">Diagnostic Recommendations</h3>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {suggestions.filter((s) => s.severity !== 'green').length} actionable points
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {suggestions.map((s) => (
              <div
                key={s.id}
                className="attn-item"
                style={{
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: '0.5px solid var(--border)',
                  background: s.severity === 'green' ? 'var(--teal-light)' : 'transparent',
                }}
              >
                <div className={`attn-icon ${s.severity === 'red' ? 'urgent' : s.severity === 'amber' ? 'pending' : 'info'}`}>
                  {s.severity === 'green' ? '✓' : '!'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {s.category}
                  </div>
                  <div style={{ fontSize: 13, marginTop: 2 }}>{s.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
