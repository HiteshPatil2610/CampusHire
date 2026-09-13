import { useNavigate } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import Button from '../../components/ui/Button';
import { useToast } from '../../context/ToastContext';

export default function LandingPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const modules = [
    { num: '01', title: 'Verified Profile', desc: 'One structured, college-verified profile for every application.', to: PATHS.studentProfile },
    { num: '02', title: 'Resume Builder', desc: 'Auto-generate a clean, ATS-friendly resume from your profile.', to: PATHS.resumeBuilder },
    { num: '03', title: 'AI Analyzer', desc: 'Get an ATS score and targeted suggestions before you apply.', to: PATHS.aiAnalyzer },
    { num: '04', title: 'Readiness Score', desc: 'Know where you stand against real placement criteria.', to: PATHS.readinessDashboard },
  ];

  const steps = [
    { num: '1', title: 'Create Profile', desc: 'Fill in academic credentials, verified semester scores, and projects.' },
    { num: '2', title: 'Build Resume', desc: 'Auto-format your resume with ATS-ready professional templates.' },
    { num: '3', title: 'Take Assessments', desc: 'Practice aptitude and core CS tests to calibrate your skill index.' },
    { num: '4', title: 'Track Readiness', desc: 'Monitor your tier eligibility and apply directly to campus drives.' },
  ];

  function scrollToHowItWorks(e) {
    e.preventDefault();
    const elem = document.getElementById('how-it-works');
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth' });
    }
  }

  function handleContactCell() {
    showToast('Placement Cell: placement@college.edu · Ext. 402 (Admin Block 2nd Floor)', 'info');
  }

  return (
    <div className="landing-page-wrapper page-enter">
      {/* Section 1 — Navbar */}
      <nav className="public-navbar" style={{ position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'blur(8px)', background: 'rgba(255,255,255,0.92)' }}>
        <div className="brand-mark" style={{ cursor: 'pointer' }} onClick={() => navigate(PATHS.landing)}>
          <span className="brand-dot" />
          <span>CampusHire</span>
        </div>

        <div className="landing-nav-links" style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <a href="#features" onClick={scrollToHowItWorks} style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}>
            Features
          </a>
          <a href="#how-it-works" onClick={scrollToHowItWorks} style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}>
            How it works
          </a>
          <a href="#for-admins" onClick={(e) => { e.preventDefault(); document.getElementById('for-admins')?.scrollIntoView({ behavior: 'smooth' }); }} style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}>
            For admins
          </a>
          <button type="button" onClick={handleContactCell} style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            Contact
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Button variant="outline" size="sm" onClick={() => navigate(PATHS.adminHome)}>
            Admin view
          </Button>
          <Button size="sm" onClick={() => navigate(PATHS.login)}>
            Student login
          </Button>
        </div>
      </nav>

      {/* Section 2 — Hero */}
      <section style={{ padding: '72px 24px 48px', maxWidth: 1040, margin: '0 auto', textAlign: 'center' }}>
        <div
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 12px', background: 'var(--accent-light)', color: 'var(--accent-dark)', borderRadius: 20, fontSize: 12, fontWeight: 500, marginBottom: 16 }}
        >
          <span>✦</span> Placement Season 2026 Live
        </div>
        <h1
          className="page-title"
          style={{ fontSize: 38, lineHeight: 1.25, maxWidth: 780, margin: '0 auto 16px' }}
        >
          Get placement ready, one step at a time
        </h1>
        <p
          style={{ color: 'var(--text-secondary)', maxWidth: 620, margin: '0 auto 28px', fontSize: 16, lineHeight: 1.6 }}
        >
          CampusHire connects verified student credentials, AI resume optimization, and campus recruitment drives in one streamlined platform.
        </p>

        <div
          style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 40, flexWrap: 'wrap' }}
        >
          <Button onClick={() => navigate(PATHS.register)} style={{ padding: '12px 24px', fontSize: 14 }}>
            Get started
          </Button>
          <Button variant="outline" onClick={scrollToHowItWorks} style={{ padding: '12px 24px', fontSize: 14 }}>
            See how it works
          </Button>
        </div>

        {/* Live Preview Card */}
        <div
          className="card"
          style={{ maxWidth: 620, margin: '0 auto', textAlign: 'left', borderRadius: 16, boxShadow: 'var(--shadow-md)', border: '1px solid var(--border)' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="sid-avatar" style={{ width: 44, height: 44, fontSize: 15 }}>AS</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>Aditi Sharma</div>
                <div className="text-secondary" style={{ fontSize: 12 }}>CSE · 4th Year · 8.4 CGPA</div>
              </div>
            </div>
            <span className="badge badge-green" style={{ fontSize: 11, padding: '4px 8px' }}>Tier 1 Eligible</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, textAlign: 'center' }}>
            <div style={{ background: 'var(--surface-1)', padding: 10, borderRadius: 10 }}>
              <div className="text-muted" style={{ fontSize: 11, marginBottom: 4 }}>Readiness Score</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--teal)' }}>78<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>/100</span></div>
            </div>
            <div style={{ background: 'var(--surface-1)', padding: 10, borderRadius: 10 }}>
              <div className="text-muted" style={{ fontSize: 11, marginBottom: 4 }}>Resume Score</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-dark)' }}>64<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>/100</span></div>
            </div>
            <div style={{ background: 'var(--surface-1)', padding: 10, borderRadius: 10 }}>
              <div className="text-muted" style={{ fontSize: 11, marginBottom: 4 }}>Profile Complete</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>72%</div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3 — Core Modules */}
      <section id="features" style={{ padding: '60px 24px', maxWidth: 1080, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-dark)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Architecture</div>
          <h2 className="section-title" style={{ fontSize: 26 }}>Four Integrated Modules</h2>
          <p className="text-secondary" style={{ fontSize: 14 }}>Designed specifically for how placement cells and engineering colleges operate.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
          {modules.map((m) => (
            <div
              key={m.num}
              className="card"
              style={{ borderRadius: 14, cursor: 'pointer', border: '1px solid var(--border)' }}
              onClick={() => navigate(m.to)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Module {m.num}</span>
                <span className="icon-tile accent" style={{ width: 28, height: 28, fontSize: 12 }}>↗</span>
              </div>
              <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>{m.title}</div>
              <div className="text-secondary" style={{ fontSize: 13, lineHeight: 1.5 }}>{m.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 4 — How It Works */}
      <section id="how-it-works" style={{ padding: '64px 24px', background: 'var(--surface-1)' }}>
        <div style={{ maxWidth: 1040, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <span className="badge badge-purple" style={{ marginBottom: 10, display: 'inline-block' }}>100% Verified Credentials</span>
            <h2 className="section-title" style={{ fontSize: 26 }}>A Clear 4-Step Placement Journey</h2>
            <p className="text-secondary" style={{ fontSize: 14 }}>Everything you need to go from enrollment to offer letter.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginBottom: 36 }}>
            {steps.map((s) => (
              <div
                key={s.num}
                className="card"
                style={{ background: 'var(--surface-0)', borderRadius: 12 }}
              >
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-light)', color: 'var(--accent-dark)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  {s.num}
                </div>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>{s.title}</div>
                <div className="text-secondary" style={{ fontSize: 13, lineHeight: 1.5 }}>{s.desc}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Button onClick={() => navigate(PATHS.register)}>Get started</Button>
            <Button variant="outline" onClick={() => navigate(PATHS.login)}>Student login</Button>
          </div>
        </div>
      </section>

      {/* Section 5 — For Admins */}
      <section id="for-admins" style={{ padding: '64px 24px', maxWidth: 1040, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 36, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-dark)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Department Coordination</div>
            <h2 className="section-title" style={{ fontSize: 26, marginBottom: 12 }}>Built for Placement Admins & TPOs</h2>
            <p className="text-secondary" style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              Say goodbye to scattered spreadsheets and email chains. Oversee department-level readiness, post campus drives with automated eligibility criteria, and export instant rosters.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <Button variant="outline" onClick={() => navigate(PATHS.adminHome)}>See the admin view</Button>
              <Button variant="ghost" onClick={() => navigate(PATHS.excelUpload)}>Excel bulk upload</Button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="card" style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div className="icon-tile accent">⚡</div>
              <div>
                <strong style={{ fontSize: 14 }}>Batch Onboarding via Excel / CSV</strong>
                <div className="text-secondary" style={{ fontSize: 13, marginTop: 2 }}>Import hundreds of student records with automated format validation and duplicate checks.</div>
              </div>
            </div>
            <div className="card" style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div className="icon-tile teal">🎯</div>
              <div>
                <strong style={{ fontSize: 14 }}>Drive Posting & Smart Eligibility</strong>
                <div className="text-secondary" style={{ fontSize: 13, marginTop: 2 }}>Set CGPA cutoffs, backlog tolerances, and branch filters. Only eligible students can submit.</div>
              </div>
            </div>
            <div className="card" style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div className="icon-tile amber">📊</div>
              <div>
                <strong style={{ fontSize: 14 }}>Live Institutional Analytics</strong>
                <div className="text-secondary" style={{ fontSize: 13, marginTop: 2 }}>Real-time department comparison, CTC brackets, and one-click student roster exports.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 6 — Metrics */}
      <section style={{ padding: '48px 24px', background: 'var(--surface-1)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 840, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--teal)', lineHeight: 1 }}>92%</div>
            <div className="text-secondary" style={{ fontSize: 13, marginTop: 6 }}>Profile completion rate</div>
          </div>
          <div>
            <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--accent-dark)', lineHeight: 1 }}>04</div>
            <div className="text-secondary" style={{ fontSize: 13, marginTop: 6 }}>Departments onboarded</div>
          </div>
          <div>
            <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>78</div>
            <div className="text-secondary" style={{ fontSize: 13, marginTop: 6 }}>Average readiness score</div>
          </div>
        </div>
      </section>

      {/* Section 7 — CTA Block */}
      <section style={{ padding: '64px 24px', maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
        <h2 className="section-title" style={{ fontSize: 28, marginBottom: 10 }}>Ready to get placement ready?</h2>
        <p className="text-secondary" style={{ fontSize: 15, maxWidth: 540, margin: '0 auto 24px' }}>
          Join students, faculty coordinators, and placement officers on CampusHire for the upcoming 2026 drive cycle.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button onClick={() => navigate(PATHS.register)} style={{ padding: '12px 24px', fontSize: 14 }}>
            Create student account
          </Button>
          <Button variant="outline" onClick={handleContactCell} style={{ padding: '12px 24px', fontSize: 14 }}>
            Contact placement cell
          </Button>
        </div>
      </section>

      {/* Section 8 — Footer */}
      <footer style={{ padding: '40px 24px 32px', background: 'var(--surface-0)', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1040, margin: '0 auto', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 32, marginBottom: 28 }}>
          <div>
            <div className="brand-mark" style={{ marginBottom: 10 }}>
              <span className="brand-dot" />
              <span style={{ fontWeight: 700 }}>CampusHire</span>
            </div>
            <p className="text-secondary" style={{ fontSize: 13, maxWidth: 360, lineHeight: 1.6 }}>
              The unified placement readiness platform connecting students, departments, and recruiters for structured recruitment.
            </p>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Platform</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
              <a href="#" onClick={(e) => { e.preventDefault(); navigate(PATHS.login); }} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Student Login</a>
              <a href="#" onClick={(e) => { e.preventDefault(); navigate(PATHS.register); }} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Student Registration</a>
              <a href="#" onClick={(e) => { e.preventDefault(); navigate(PATHS.adminHome); }} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Department Admin</a>
              <a href="#" onClick={(e) => { e.preventDefault(); navigate(PATHS.superAdminDashboard); }} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>TPO Super Admin</a>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Resources</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
              <a href="#" onClick={(e) => { e.preventDefault(); handleContactCell(); }} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Placement Cell Desk</a>
              <a href="#" onClick={(e) => { e.preventDefault(); navigate(PATHS.aiAnalyzer); }} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>ATS Resume Analyzer</a>
              <a href="#" onClick={(e) => { e.preventDefault(); navigate(PATHS.selfAssessment); }} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Readiness Assessment</a>
              <a href="#" onClick={(e) => { e.preventDefault(); navigate(PATHS.resetPassword); }} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Password Recovery</a>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 1040, margin: '0 auto', paddingTop: 20, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap', gap: 8 }}>
          <div>All rights reserved © 2026 CampusHire. Built for campus placement cells.</div>
          <div>Version 2.4.0 · Production Ready Frontend</div>
        </div>
      </footer>
    </div>
  );
}


