'use client';

import Link from 'next/link';
import { Compass } from 'lucide-react';

export default function NotFoundContent() {
  return (
    <div className="auth-container page-enter">
      <div
        className="auth-card"
        style={{ textAlign: 'center', maxWidth: 440 }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: 12,
            color: 'var(--accent)',
          }}
        >
          <Compass size={48} />
        </div>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Page Not Found</h1>
        <p
          className="text-secondary"
          style={{ fontSize: 13, marginBottom: 24 }}
        >
          The page you are looking for doesn&apos;t exist or has been moved.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => window.history.back()}
          >
            Go Back
          </button>
          <Link href="/" className="btn btn-primary">
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
