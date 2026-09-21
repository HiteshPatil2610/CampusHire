'use client';

import { useEffect, useState } from 'react';
import Sidebar from './sidebar';

export interface AppShellProps {
  role: 'student' | 'admin' | 'superadmin';
  children: React.ReactNode;
}

const COLLAPSED_KEY = 'campushire.sidebar.collapsed';

/**
 * Chassis & floating screen: a black frame that holds the sidebar and bezels
 * the page on the top, right and bottom. The page scrolls inside the rounded
 * canvas; there is no header bar, so global actions live in the sidebar.
 */
export default function AppShell({ role, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Read after mount so server and first client render agree.
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === '1');
    } catch {
      // Storage blocked — the sidebar just starts expanded.
    }
  }, []);

  function setAndRemember(next: boolean) {
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
    } catch {
      // Non-critical convenience.
    }
  }

  return (
    <div className="relative flex h-screen w-screen select-none overflow-hidden bg-black font-sans">
      <Sidebar
        role={role}
        collapsed={collapsed}
        onToggle={() => setAndRemember(!collapsed)}
      />
      <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-black py-2.5 pl-0 pr-2.5">
        <div className="relative h-full w-full flex-1 overflow-hidden rounded-[20px] bg-white">
          <div className="app-content page-enter h-full select-text overflow-y-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
