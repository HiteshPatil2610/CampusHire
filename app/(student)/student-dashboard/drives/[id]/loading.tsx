/**
 * Drive detail loading skeleton.
 *
 * Mirrors the real page's block structure: header card → eligibility section →
 * content sections → apply section. Having a loading.tsx here also lets
 * Next.js prefetch this segment so navigation from the drives list is instant.
 */
export default function Loading() {
  return (
    <div style={{ padding: '24px 32px', maxWidth: 900, margin: '0 auto' }}>
      {/* Back link placeholder */}
      <div className="skeleton" style={{ height: 14, width: 120, marginBottom: 20 }} />

      {/* Drive header */}
      <div
        className="card"
        style={{ marginBottom: 24, padding: 24 }}
      >
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}>
          <div className="skeleton" style={{ width: 64, height: 64, borderRadius: 12, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 24, width: '55%', marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 16, width: '30%', marginBottom: 12 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <div className="skeleton" style={{ height: 22, width: 80, borderRadius: 20 }} />
              <div className="skeleton" style={{ height: 22, width: 60, borderRadius: 20 }} />
            </div>
          </div>
        </div>
        {/* Meta grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 16,
            padding: 16,
            borderRadius: 8,
            background: 'var(--surface-1)',
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              <div className="skeleton" style={{ height: 10, width: '50%', marginBottom: 6 }} />
              <div className="skeleton" style={{ height: 14, width: '70%' }} />
            </div>
          ))}
        </div>
      </div>

      {/* Eligibility checklist */}
      <div className="card" style={{ marginBottom: 24, padding: 20 }}>
        <div className="skeleton" style={{ height: 16, width: '30%', marginBottom: 16 }} />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <div className="skeleton" style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0 }} />
            <div className="skeleton" style={{ height: 14, flex: 1, maxWidth: '60%' }} />
          </div>
        ))}
      </div>

      {/* Content sections */}
      {[0, 1].map((i) => (
        <div key={i} className="card" style={{ marginBottom: 24, padding: 20 }}>
          <div className="skeleton" style={{ height: 16, width: '25%', marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 12, width: '100%', marginBottom: 7 }} />
          <div className="skeleton" style={{ height: 12, width: '85%', marginBottom: 7 }} />
          <div className="skeleton" style={{ height: 12, width: '70%' }} />
        </div>
      ))}

      {/* Apply section skeleton */}
      <div className="card" style={{ padding: 20 }}>
        <div className="skeleton" style={{ height: 16, width: '20%', marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 40, width: 160, borderRadius: 8 }} />
      </div>
    </div>
  );
}
