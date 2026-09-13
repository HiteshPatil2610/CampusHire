'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown } from 'lucide-react';

type PortalRole = 'student' | 'admin' | 'superadmin';

const PORTALS: Record<PortalRole, { label: string; href: string }> = {
  student: { label: 'Student', href: '/student-dashboard' },
  admin: { label: 'Dept Admin', href: '/admin-dashboard' },
  superadmin: { label: 'Super Admin', href: '/super-admin-dashboard' },
};

/**
 * Portals a user may reach, by their assigned role. A user holds exactly one
 * role and middleware redirects any cross-portal request, so this control
 * reports the active role rather than switching between them. Widen these
 * lists only alongside the matching middleware rule.
 */
const REACHABLE: Record<PortalRole, PortalRole[]> = {
  student: ['student'],
  admin: ['admin'],
  superadmin: ['superadmin'],
};

export interface RoleSwitcherProps {
  role: PortalRole;
}

export default function RoleSwitcher({ role }: RoleSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const options = REACHABLE[role] ?? ['student'];
  const hasChoice = options.length > 1;

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="role-pill"
        aria-haspopup={hasChoice ? 'menu' : undefined}
        aria-expanded={hasChoice ? open : undefined}
        disabled={!hasChoice}
        onClick={() => hasChoice && setOpen((o) => !o)}
      >
        <span className="role-pill-label">Role:</span>
        <span className="role-pill-value">{PORTALS[role].label}</span>
        <ChevronDown size={13} strokeWidth={2} aria-hidden />
      </button>

      {open && (
        <div className="role-menu" role="menu">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              role="menuitem"
              className="role-menu-item"
              onClick={() => {
                setOpen(false);
                router.push(PORTALS[option].href);
              }}
            >
              <span>{PORTALS[option].label}</span>
              {option === role && (
                <Check size={13} strokeWidth={2.5} color="var(--accent)" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
