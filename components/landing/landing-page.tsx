'use client';

import Link from 'next/link';
import {
  ArrowUpRight,
  Briefcase,
  ClipboardList,
  Compass,
  Sparkles,
  Target,
  UserCheck,
  Zap,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LandingPageProps {
  isAuthenticated: boolean;
  dashboardHref: string;
}

const MODULES = [
  {
    num: '01',
    title: 'Verified Profile',
    desc: 'One structured, college-verified profile for every application.',
    href: '/sign-up',
    icon: UserCheck,
  },
  {
    num: '02',
    title: 'Campus Drives',
    desc: 'Browse eligibility-filtered placement drives posted by your department.',
    href: '/sign-up',
    icon: Briefcase,
  },
  {
    num: '03',
    title: 'Applications',
    desc: 'Apply once to eligible drives and track your submission history.',
    href: '/sign-up',
    icon: ClipboardList,
  },
  {
    num: '04',
    title: 'Admin Tools',
    desc: 'Department admins manage rosters, drives, and reports in one place.',
    href: '/sign-in',
    icon: Target,
  },
];

const STEPS = [
  {
    num: '1',
    title: 'Create Profile',
    desc: 'Fill in academic credentials, verified semester scores, and projects.',
  },
  {
    num: '2',
    title: 'Browse Drives',
    desc: 'See only the drives you qualify for based on CGPA, backlogs, and branch.',
  },
  {
    num: '3',
    title: 'Apply to Companies',
    desc: 'Submit a single application per drive with your verified profile snapshot.',
  },
  {
    num: '4',
    title: 'Track Applications',
    desc: 'Monitor submitted applications and upcoming deadlines from your dashboard.',
  },
];

export default function LandingPage({
  isAuthenticated,
  dashboardHref,
}: LandingPageProps) {
  const { toast } = useToast();

  function scrollToSection(id: string, e: React.MouseEvent) {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  function handleContactCell() {
    toast({
      title: 'Placement Cell',
      description:
        'placement@college.edu · Ext. 402 (Admin Block 2nd Floor)',
    });
  }

  return (
    <div className="landing-page-wrapper page-enter">
      <nav
        className="public-navbar"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backdropFilter: 'blur(8px)',
          background: 'rgba(255,255,255,0.92)',
        }}
      >
        <Link href="/" className="brand-mark">
          <span className="brand-dot" />
          <span>CampusHire</span>
        </Link>

        <div
          className="landing-nav-links"
          style={{ display: 'flex', gap: 24, alignItems: 'center' }}
        >
          <a
            href="#features"
            onClick={(e) => scrollToSection('features', e)}
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              textDecoration: 'none',
            }}
          >
            Features
          </a>
          <a
            href="#how-it-works"
            onClick={(e) => scrollToSection('how-it-works', e)}
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              textDecoration: 'none',
            }}
          >
            How it works
          </a>
          <a
            href="#for-admins"
            onClick={(e) => scrollToSection('for-admins', e)}
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              textDecoration: 'none',
            }}
          >
            For admins
          </a>
          <button
            type="button"
            onClick={handleContactCell}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 13,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Contact
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {isAuthenticated ? (
            <Link href={dashboardHref} className="btn btn-primary btn-sm">
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link href="/sign-in" className="btn btn-outline btn-sm">
                Sign In
              </Link>
              <Link href="/sign-up" className="btn btn-primary btn-sm">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </nav>

      <section
        style={{
          padding: '72px 24px 48px',
          maxWidth: 1040,
          margin: '0 auto',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 12px',
            background: 'var(--accent-light)',
            color: 'var(--accent-dark)',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 500,
            marginBottom: 16,
          }}
        >
          <Sparkles size={14} />
          Placement Season 2026
        </div>
        <h1
          className="page-title"
          style={{
            fontSize: 38,
            lineHeight: 1.25,
            maxWidth: 780,
            margin: '0 auto 16px',
          }}
        >
          Get placement ready, one step at a time
        </h1>
        <p
          style={{
            color: 'var(--text-secondary)',
            maxWidth: 620,
            margin: '0 auto 28px',
            fontSize: 16,
            lineHeight: 1.6,
          }}
        >
          CampusHire connects verified student credentials, campus recruitment
          drives, and department coordination in one streamlined platform.
        </p>

        <div
          style={{
            display: 'flex',
            gap: 12,
            justifyContent: 'center',
            marginBottom: 40,
            flexWrap: 'wrap',
          }}
        >
          {isAuthenticated ? (
            <Link
              href={dashboardHref}
              className="btn btn-primary"
              style={{ padding: '12px 24px', fontSize: 14 }}
            >
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/sign-up"
                className="btn btn-primary"
                style={{ padding: '12px 24px', fontSize: 14 }}
              >
                Get started
              </Link>
              <a
                href="#how-it-works"
                className="btn btn-outline"
                style={{ padding: '12px 24px', fontSize: 14 }}
                onClick={(e) => scrollToSection('how-it-works', e)}
              >
                See how it works
              </a>
            </>
          )}
        </div>

        <div
          className="card"
          style={{
            maxWidth: 620,
            margin: '0 auto',
            textAlign: 'left',
            borderRadius: 16,
            border: '1px solid var(--border)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid var(--border)',
              paddingBottom: 12,
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                className="sid-avatar"
                style={{ width: 44, height: 44, fontSize: 15 }}
              >
                AS
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>Aditi Sharma</div>
                <div className="text-secondary" style={{ fontSize: 12 }}>
                  CSE · 4th Year · 8.4 CGPA
                </div>
              </div>
            </div>
            <span
              className="badge badge-green"
              style={{ fontSize: 11, padding: '4px 8px' }}
            >
              Eligible
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 12,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                background: 'var(--surface-1)',
                padding: 10,
                borderRadius: 10,
              }}
            >
              <div
                className="text-muted"
                style={{ fontSize: 11, marginBottom: 4 }}
              >
                Open Drives
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--teal)',
                }}
              >
                Browse eligible
              </div>
            </div>
            <div
              style={{
                background: 'var(--surface-1)',
                padding: 10,
                borderRadius: 10,
              }}
            >
              <div
                className="text-muted"
                style={{ fontSize: 11, marginBottom: 4 }}
              >
                Applications
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--accent-dark)',
                }}
              >
                Track status
              </div>
            </div>
            <div
              style={{
                background: 'var(--surface-1)',
                padding: 10,
                borderRadius: 10,
              }}
            >
              <div
                className="text-muted"
                style={{ fontSize: 11, marginBottom: 4 }}
              >
                Profile Complete
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                Build once
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="features"
        style={{ padding: '60px 24px', maxWidth: 1080, margin: '0 auto' }}
      >
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--accent-dark)',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 6,
            }}
          >
            Architecture
          </div>
          <h2 className="section-title" style={{ fontSize: 26 }}>
            Four Integrated Modules
          </h2>
          <p className="text-secondary" style={{ fontSize: 14 }}>
            Designed specifically for how placement cells and engineering
            colleges operate.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 18,
          }}
        >
          {MODULES.map((module) => (
            <Link
              key={module.num}
              href={module.href}
              className="card"
              style={{
                borderRadius: 14,
                cursor: 'pointer',
                border: '1px solid var(--border)',
                display: 'block',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                  }}
                >
                  Module {module.num}
                </span>
                <span
                  className="icon-tile accent"
                  style={{
                    width: 28,
                    height: 28,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ArrowUpRight size={14} />
                </span>
              </div>
              <div
                style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}
              >
                {module.title}
              </div>
              <div
                className="text-secondary"
                style={{ fontSize: 13, lineHeight: 1.5 }}
              >
                {module.desc}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section
        id="how-it-works"
        style={{ padding: '64px 24px', background: 'var(--surface-1)' }}
      >
        <div style={{ maxWidth: 1040, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <span
              className="badge badge-purple"
              style={{ marginBottom: 10, display: 'inline-block' }}
            >
              100% Verified Credentials
            </span>
            <h2 className="section-title" style={{ fontSize: 26 }}>
              A Clear 4-Step Placement Journey
            </h2>
            <p className="text-secondary" style={{ fontSize: 14 }}>
              Everything you need to go from enrollment to offer letter.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 20,
              marginBottom: 36,
            }}
          >
            {STEPS.map((step) => (
              <div
                key={step.num}
                className="card"
                style={{ background: 'var(--surface-0)', borderRadius: 12 }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'var(--accent-light)',
                    color: 'var(--accent-dark)',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 12,
                  }}
                >
                  {step.num}
                </div>
                <div
                  style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}
                >
                  {step.title}
                </div>
                <div
                  className="text-secondary"
                  style={{ fontSize: 13, lineHeight: 1.5 }}
                >
                  {step.desc}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Link href="/sign-up" className="btn btn-primary">
              Get started
            </Link>
            <Link href="/sign-in" className="btn btn-outline">
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <section
        id="for-admins"
        style={{ padding: '64px 24px', maxWidth: 1040, margin: '0 auto' }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.2fr',
            gap: 36,
            alignItems: 'center',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--accent-dark)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 8,
              }}
            >
              Department Coordination
            </div>
            <h2
              className="section-title"
              style={{ fontSize: 26, marginBottom: 12 }}
            >
              Built for Placement Admins & TPOs
            </h2>
            <p
              className="text-secondary"
              style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}
            >
              Say goodbye to scattered spreadsheets and email chains. Oversee
              department-level readiness, post campus drives with automated
              eligibility criteria, and export instant rosters.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <Link href="/sign-in" className="btn btn-outline">
                Admin sign in
              </Link>
              <Link href="/sign-in" className="btn btn-ghost">
                Excel bulk upload
              </Link>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              className="card"
              style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}
            >
              <div className="icon-tile accent">
                <Zap size={16} />
              </div>
              <div>
                <strong style={{ fontSize: 14 }}>
                  Batch Onboarding via Excel / CSV
                </strong>
                <div
                  className="text-secondary"
                  style={{ fontSize: 13, marginTop: 2 }}
                >
                  Import hundreds of student records with automated format
                  validation and duplicate checks.
                </div>
              </div>
            </div>
            <div
              className="card"
              style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}
            >
              <div className="icon-tile teal">
                <Target size={16} />
              </div>
              <div>
                <strong style={{ fontSize: 14 }}>
                  Drive Posting & Smart Eligibility
                </strong>
                <div
                  className="text-secondary"
                  style={{ fontSize: 13, marginTop: 2 }}
                >
                  Set CGPA cutoffs, backlog tolerances, and branch filters. Only
                  eligible students can submit.
                </div>
              </div>
            </div>
            <div
              className="card"
              style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}
            >
              <div className="icon-tile amber">
                <Briefcase size={16} />
              </div>
              <div>
                <strong style={{ fontSize: 14 }}>
                  Live Institutional Analytics
                </strong>
                <div
                  className="text-secondary"
                  style={{ fontSize: 13, marginTop: 2 }}
                >
                  Real-time department comparison, CTC brackets, and one-click
                  student roster exports.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        style={{
          padding: '64px 24px',
          maxWidth: 800,
          margin: '0 auto',
          textAlign: 'center',
        }}
      >
        <h2 className="section-title" style={{ fontSize: 28, marginBottom: 10 }}>
          Ready to get placement ready?
        </h2>
        <p
          className="text-secondary"
          style={{ fontSize: 15, maxWidth: 540, margin: '0 auto 24px' }}
        >
          Join students, faculty coordinators, and placement officers on
          CampusHire for the upcoming 2026 drive cycle.
        </p>
        <div
          style={{
            display: 'flex',
            gap: 12,
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <Link
            href="/sign-up"
            className="btn btn-primary"
            style={{ padding: '12px 24px', fontSize: 14 }}
          >
            Create student account
          </Link>
          <button
            type="button"
            className="btn btn-outline"
            style={{ padding: '12px 24px', fontSize: 14 }}
            onClick={handleContactCell}
          >
            Contact placement cell
          </button>
        </div>
      </section>

      <footer
        style={{
          padding: '40px 24px 32px',
          background: 'var(--surface-0)',
          borderTop: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            maxWidth: 1040,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr',
            gap: 32,
            marginBottom: 28,
          }}
        >
          <div>
            <div className="brand-mark" style={{ marginBottom: 10 }}>
              <span className="brand-dot" />
              <span style={{ fontWeight: 700 }}>CampusHire</span>
            </div>
            <p
              className="text-secondary"
              style={{ fontSize: 13, maxWidth: 360, lineHeight: 1.6 }}
            >
              The unified placement readiness platform connecting students,
              departments, and recruiters for structured recruitment.
            </p>
          </div>
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 12,
              }}
            >
              Platform
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                fontSize: 13,
              }}
            >
              <Link
                href="/sign-in"
                style={{ color: 'var(--text-secondary)' }}
              >
                Sign In
              </Link>
              <Link
                href="/sign-up"
                style={{ color: 'var(--text-secondary)' }}
              >
                Sign Up
              </Link>
              <Link
                href="/sign-in"
                style={{ color: 'var(--text-secondary)' }}
              >
                Department Admin
              </Link>
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 12,
              }}
            >
              Resources
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                fontSize: 13,
              }}
            >
              <button
                type="button"
                onClick={handleContactCell}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  fontSize: 13,
                }}
              >
                Placement Cell Desk
              </button>
            </div>
          </div>
        </div>

        <div
          style={{
            maxWidth: 1040,
            margin: '0 auto',
            paddingTop: 20,
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 12,
            color: 'var(--text-muted)',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div>
            All rights reserved © 2026 CampusHire. Built for campus placement
            cells.
          </div>
        </div>
      </footer>
    </div>
  );
}
