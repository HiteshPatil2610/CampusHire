import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

// role: 'student' | 'admin' | 'superadmin'
export default function AppShell({ role, user, showProfileCompletion, onSave, children }) {
  const location = useLocation();

  return (
    <div className="app-shell">
      <Sidebar role={role} />
      <div className="app-main">
        <Topbar user={user} showProfileCompletion={showProfileCompletion} onSave={onSave} />
        <main key={location.pathname} className="app-content page-enter">
          {children}
        </main>
      </div>
    </div>
  );
}

