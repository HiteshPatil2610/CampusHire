// Standard badge — ui-context.md §5.2. variant: green | amber | red | purple | accent
export function Badge({ variant = 'accent', children, className = '' }) {
  return <span className={`badge badge-${variant} ${className}`}>{children}</span>;
}

// Pill-shaped drive status badge (bigger, brighter than Badge)
export function DriveStatusBadge({ variant = 'accent', children }) {
  return <span className={`badge badge-${variant} drive-status-badge`}>{children}</span>;
}
