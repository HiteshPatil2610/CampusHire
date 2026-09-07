import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell';
import Button from '../../components/ui/Button';
import { useStudent } from '../../hooks/useStudent';
import { useAppState } from '../../context/AppStateContext';
import { useToast } from '../../context/ToastContext';
import { PATHS } from '../../routes/paths';

const ASSESSMENT_QUESTIONS = [
  {
    id: 1,
    category: 'Quantitative Aptitude',
    text: 'A train running at a speed of 72 km/hr crosses a pole in 9 seconds. What is the length of the train?',
    options: [
      { id: 'A', text: '160 metres' },
      { id: 'B', text: '180 metres' },
      { id: 'C', text: '200 metres' },
      { id: 'D', text: '220 metres' },
    ],
    correctAnswer: 'B',
    explanation: 'Speed = 72 * (5/18) = 20 m/s. Distance = Speed * Time = 20 * 9 = 180 metres.',
  },
  {
    id: 2,
    category: 'Data Structures & Algorithms',
    text: 'What is the worst-case time complexity of searching an element in an AVL Tree with n nodes?',
    options: [
      { id: 'A', text: 'O(1)' },
      { id: 'B', text: 'O(n)' },
      { id: 'C', text: 'O(log n)' },
      { id: 'D', text: 'O(n log n)' },
    ],
    correctAnswer: 'C',
    explanation: 'An AVL tree is strictly self-balancing with height guaranteed to be O(log n), so search is always O(log n).',
  },
  {
    id: 3,
    category: 'Core CS (DBMS & SQL)',
    text: 'In a relational database, which normal form ensures that there is no transitive dependency of non-prime attributes on a candidate key?',
    options: [
      { id: 'A', text: '1NF' },
      { id: 'B', text: '2NF' },
      { id: 'C', text: '3NF' },
      { id: 'D', text: 'BCNF' },
    ],
    correctAnswer: 'C',
    explanation: 'Third Normal Form (3NF) requires 2NF compliance and the elimination of transitive functional dependencies.',
  },
  {
    id: 4,
    category: 'Technical Coding Fundamentals',
    text: 'In JavaScript, which keyword is used to declare a block-scoped variable that cannot be reassigned?',
    options: [
      { id: 'A', text: 'var' },
      { id: 'B', text: 'let' },
      { id: 'C', text: 'const' },
      { id: 'D', text: 'static' },
    ],
    correctAnswer: 'C',
    explanation: 'const creates a block-scoped immutable binding that cannot be reassigned once initialized.',
  },
];

export default function SelfAssessmentPage() {
  const student = useStudent();
  const { setReadinessScore, state } = useAppState();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);

  function handleSelectOption(qId, optionId) {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qId]: optionId }));
  }

  function handleSubmit() {
    if (Object.keys(answers).length === 0) return;

    let correctCount = 0;
    ASSESSMENT_QUESTIONS.forEach((q) => {
      if (answers[q.id] === q.correctAnswer) {
        correctCount += 1;
      }
    });

    const scorePct = Math.round((correctCount / ASSESSMENT_QUESTIONS.length) * 100);
    // Formula: min(95, 70 + round(score% * 0.2))
    const newReadiness = Math.min(95, 70 + Math.round(scorePct * 0.2));

    setReadinessScore(newReadiness);
    setResult({
      scorePct,
      correctCount,
      total: ASSESSMENT_QUESTIONS.length,
      newReadiness,
    });
    setSubmitted(true);

    showToast(`Assessment finished! Scored ${scorePct}%. Readiness score updated to ${newReadiness}.`, 'success');
  }

  function handleRetake() {
    setAnswers({});
    setSubmitted(false);
    setResult(null);
  }

  const hasAnsweredAny = Object.keys(answers).length > 0;

  return (
    <AppShell role="student" user={student}>
      {/* Section 1 — Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>Placement Readiness Assessment</h1>
          <p className="text-secondary" style={{ fontSize: 13 }}>
            Simulating standard selection tests (TCS NQT, Infosys InfyTQ, Accenture Cognitive).
          </p>
        </div>
        {submitted && (
          <Button variant="outline" size="sm" onClick={handleRetake}>
            ↺ Retake test
          </Button>
        )}
      </div>

      {/* Section 4 — Result Banner (if submitted) */}
      {submitted && result && (
        <div
          className="card"
          style={{
            marginBottom: 24,
            background: 'var(--surface-1)',
            borderLeft: '4px solid var(--teal)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
            padding: 20,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 20 }}>🎯</span>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                Assessment Score: {result.scorePct}% ({result.correctCount}/{result.total} Correct)
              </h2>
            </div>
            <p className="text-secondary" style={{ fontSize: 13, margin: 0 }}>
              Placement readiness recalibrated to <strong>{result.newReadiness} / 100</strong>. Keep solving assessments to unlock higher tier placement drives.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="outline" size="sm" onClick={handleRetake}>
              ↺ Retake test
            </Button>
            <Button size="sm" onClick={() => navigate(PATHS.studentDashboard)}>
              View Dashboard →
            </Button>
          </div>
        </div>
      )}

      {/* Section 2 — 4 Question Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 28 }}>
        {ASSESSMENT_QUESTIONS.map((q, idx) => {
          const selected = answers[q.id];
          return (
            <div
              key={q.id}
              className="card"
              style={{
                borderRadius: 14,
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span className="badge badge-purple" style={{ fontSize: 11 }}>
                  {q.category}
                </span>
                <span className="text-muted" style={{ fontSize: 12, fontWeight: 500 }}>
                  Question {idx + 1} of {ASSESSMENT_QUESTIONS.length}
                </span>
              </div>

              <h3 style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.5, marginBottom: 16 }}>
                {q.text}
              </h3>

              {/* 4 options in 2x2 grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
                {q.options.map((opt) => {
                  const isSelected = selected === opt.id;
                  const isCorrect = opt.id === q.correctAnswer;

                  let border = '1px solid var(--border)';
                  let bg = 'var(--surface-0)';
                  let color = 'var(--text-primary)';

                  if (submitted) {
                    if (isCorrect) {
                      border = '1px solid var(--teal)';
                      bg = '#e6f7f2';
                      color = '#007050';
                    } else if (isSelected && !isCorrect) {
                      border = '1px solid var(--red)';
                      bg = '#fdf0ef';
                      color = '#c5221f';
                    }
                  } else if (isSelected) {
                    border = '1px solid var(--accent-dark)';
                    bg = 'var(--accent-light)';
                    color = 'var(--accent-dark)';
                  }

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={submitted}
                      onClick={() => handleSelectOption(q.id, opt.id)}
                      style={{
                        padding: '12px 16px',
                        borderRadius: 10,
                        border,
                        background: bg,
                        color,
                        textAlign: 'left',
                        cursor: submitted ? 'default' : 'pointer',
                        fontSize: 13,
                        fontWeight: isSelected || (submitted && isCorrect) ? 600 : 400,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          background: isSelected || (submitted && isCorrect) ? 'rgba(0,0,0,0.06)' : 'var(--surface-1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {opt.id}
                      </span>
                      <span style={{ flex: 1 }}>{opt.text}</span>
                      {submitted && isCorrect && <span>✓</span>}
                      {submitted && isSelected && !isCorrect && <span>✕</span>}
                    </button>
                  );
                })}
              </div>

              {submitted && (
                <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--surface-1)', borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <strong>Explanation:</strong> {q.explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Section 3 — Submit Row */}
      {!submitted && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 14 }}>
          {!hasAnsweredAny && (
            <span className="text-muted" style={{ fontSize: 12 }}>
              Select at least one answer to submit
            </span>
          )}
          <Button disabled={!hasAnsweredAny} onClick={handleSubmit} style={{ padding: '10px 24px', fontSize: 14 }}>
            Submit Assessment
          </Button>
        </div>
      )}
    </AppShell>
  );
}

