'use client';

export interface ProgressBarProps {
  value: number; // 0-100
  variant?: 'accent' | 'teal' | 'amber';
  showLabel?: boolean;
  className?: string;
}

export default function ProgressBar({
  value,
  variant = 'accent',
  showLabel = false,
  className = '',
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  const variantClass = variant !== 'accent' ? variant : '';

  return (
    <div className={`progress-track ${className}`.trim()}>
      <div
        className={`progress-fill ${variantClass}`.trim()}
        style={{ width: `${pct}%` }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {showLabel && (
          <span
            style={{
              fontSize: '10px',
              color: 'white',
              paddingLeft: '4px',
              fontWeight: 600,
            }}
          >
            {Math.round(pct)}%
          </span>
        )}
      </div>
    </div>
  );
}
