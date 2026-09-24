import Link from 'next/link';

interface AuthSplitShellProps {
  mode: 'sign-in' | 'sign-up';
  eyebrow: string;
  title: string;
  subtitle: string;
  tileHeading: string;
  tileBody: string;
  tileCtaLabel: string;
  tileCtaHref: string;
  children: React.ReactNode;
}

export function AuthSplitShell({
  mode,
  eyebrow,
  title,
  subtitle,
  tileHeading,
  tileBody,
  tileCtaLabel,
  tileCtaHref,
  children,
}: AuthSplitShellProps) {
  return (
    <div className="auth-oxford-page">
      <div className="auth-oxford-frame">
        <div className="auth-oxford-sweep" aria-hidden="true" />
        <div className="auth-oxford-card">
          <div className="auth-oxford-grid" aria-hidden="true">
            <div />
            <div />
            <div />
            <div />
            <div />
            <div />
          </div>

          <div className={`auth-oxford-panels${mode === 'sign-up' ? ' is-signup' : ''}`}>
            <div className="auth-oxford-form-panel">
              <div className="auth-oxford-form-inner">
                <div className="auth-oxford-heading">
                  <span className="auth-oxford-eyebrow">{eyebrow}</span>
                  <h1>{title}</h1>
                  <p>{subtitle}</p>
                </div>
                {children}
              </div>
            </div>

            <div className="auth-oxford-tile">
              <div className="auth-oxford-tile-shell">
                <div className="auth-oxford-tile-brand">CampusHire</div>
                <div className="auth-oxford-tile-copy">
                  <h2>{tileHeading}</h2>
                  <p>{tileBody}</p>
                  <Link href={tileCtaHref} className="auth-oxford-tile-cta">
                    {tileCtaLabel}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
