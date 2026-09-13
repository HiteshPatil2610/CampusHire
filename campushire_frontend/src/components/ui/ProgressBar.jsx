// variant: '' (accent) | 'teal' | 'amber' — ui-context.md §2.8
export default function ProgressBar({ percent, variant = '' }) {
  const pct = Math.max(0, Math.min(100, percent));
  return (
    <div className="progress-track">
      <div className={`progress-fill ${variant}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

