'use client';

import Sidebar from './sidebar';
import Topbar from './topbar';

export interface AppShellProps {
  role: 'student' | 'admin' | 'superadmin';
  children: React.ReactNode;
}

export default function AppShell({ role, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <Sidebar role={role} />
      <div className="app-main">
        <Topbar role={role} />
        <main className="app-content page-enter">{children}</main>
      </div>
    </div>
  );
}
