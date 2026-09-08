export interface KpiCardProps {
  value: string | number;
  label: string;
  trend?: string; // e.g. "+12%" or "-3%"
  trendPositive?: boolean; // true = green, false = red
  icon?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export default function KpiCard({
  value,
  label,
  trend,
  trendPositive,
  icon,
  className = '',
  onClick,
}: KpiCardProps) {
  return (
    <div
      className={`kpi-card ${className}`.trim()}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <div className="kpi-value">{value}</div>
          <div className="kpi-label">{label}</div>
          {trend && (
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                marginTop: '4px',
                color: trendPositive ? 'var(--teal)' : 'var(--red)',
              }}
            >
              {trend}
            </div>
          )}
        </div>
        {icon && (
          <div
            style={{
              color: 'var(--text-secondary)',
              marginLeft: '8px',
            }}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
