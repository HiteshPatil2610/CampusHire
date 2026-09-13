import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

export interface ComingSoonProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** What the student can do in the meantime. */
  bullets?: string[];
}

/**
 * Placeholder for a student feature that is designed but not yet built.
 * Keeps the route reachable from the sidebar so navigation stays honest
 * about what exists.
 */
export default function ComingSoon({
  icon: Icon,
  title,
  description,
  bullets = [],
}: ComingSoonProps) {
  return (
    <div className="stub-page">
      <div className="stub-icon">
        <Icon size={22} aria-hidden />
      </div>

      <h1 className="page-title" style={{ marginBottom: 8 }}>
        {title}
      </h1>
      <p className="text-secondary" style={{ fontSize: 14, lineHeight: 1.6 }}>
        {description}
      </p>

      <span
        className="badge badge-amber"
        style={{ display: 'inline-block', marginTop: 14 }}
      >
        Coming soon
      </span>

      {bullets.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: '20px 0 0',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {bullets.map((bullet) => (
            <li
              key={bullet}
              className="text-secondary"
              style={{ fontSize: 13, display: 'flex', gap: 8 }}
            >
              <span style={{ color: 'var(--accent)' }}>•</span>
              {bullet}
            </li>
          ))}
        </ul>
      )}

      <div style={{ marginTop: 24 }}>
        <Link href="/student-dashboard" className="btn btn-outline btn-sm">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
