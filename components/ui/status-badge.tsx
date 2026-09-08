export type StatusVariant = 'green' | 'amber' | 'red' | 'purple' | 'accent' | 'gray';

export interface StatusBadgeProps {
  variant: StatusVariant;
  children: React.ReactNode;
  className?: string;
}

export default function StatusBadge({
  variant,
  children,
  className = '',
}: StatusBadgeProps) {
  const variantClass = `badge-${variant}`;

  return (
    <span className={`badge ${variantClass} ${className}`.trim()}>
      {children}
    </span>
  );
}
