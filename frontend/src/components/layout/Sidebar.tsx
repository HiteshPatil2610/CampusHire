import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import {
  LayoutDashboard, Users, UserPlus, FileSpreadsheet,
  BookOpen, Activity, Bell, Settings, LogOut,
  Building2, UserCog, BarChart3, ChevronRight,
} from 'lucide-react'
import clsx from 'clsx'

interface NavItem { label: string; to: string; icon: React.ReactNode }

const studentNav: NavItem[] = [
  { label: 'Dashboard',     to: '/dashboard',     icon: <LayoutDashboard size={16}/> },
  { label: 'My Profile',    to: '/profile',        icon: <BookOpen size={16}/> },
  { label: 'Readiness',     to: '/readiness',      icon: <Activity size={16}/> },
  { label: 'Notifications', to: '/notifications',  icon: <Bell size={16}/> },
  { label: 'Settings',      to: '/settings',       icon: <Settings size={16}/> },
]

const adminNav: NavItem[] = [
  { label: 'Dashboard',   to: '/admin',                  icon: <LayoutDashboard size={16}/> },
  { label: 'Students',    to: '/admin/students',          icon: <Users size={16}/> },
  { label: 'Add Student', to: '/admin/students/add',      icon: <UserPlus size={16}/> },
  { label: 'Import Excel',to: '/admin/students/import',   icon: <FileSpreadsheet size={16}/> },
]

const superAdminNav: NavItem[] = [
  { label: 'Dashboard',    to: '/super-admin',             icon: <LayoutDashboard size={16}/> },
  { label: 'Departments',  to: '/super-admin/departments', icon: <Building2 size={16}/> },
  { label: 'Admin Accounts',to:'/super-admin/admins',      icon: <UserCog size={16}/> },
]

const navMap = { student: studentNav, admin: adminNav, 'super-admin': superAdminNav }

interface Props { role: 'student' | 'admin' | 'super-admin'; onClose?: () => void }

export default function Sidebar({ role, onClose }: Props) {
  const { logout, user } = useAuthStore()
  const navigate = useNavigate()
  const items = navMap[role]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? 'CH'
  const roleLabel = role === 'student' ? 'Student' : role === 'admin' ? 'Dept Admin' : 'Super Admin'

  return (
    <aside className="flex flex-col h-full bg-surface-2 border-r border-border w-[220px]">
      {/* Brand */}
      <div className="flex items-center gap-2 px-4 py-5 mb-1">
        <span className="w-5 h-5 rounded-md bg-accent inline-block" />
        <span className="font-semibold text-base text-text-primary">CampusHire</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 space-y-0.5">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/admin' || item.to === '/super-admin' || item.to === '/dashboard'}
            onClick={onClose}
            className={({ isActive }) =>
              clsx('sidebar-link', isActive && 'active')
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      <div className="px-2 pb-4 border-t border-border pt-3 mt-2 space-y-0.5">
        <div className="flex items-center gap-2.5 px-3 py-2 rounded">
          <div className="w-7 h-7 rounded-full bg-accent-light flex items-center justify-center text-accent-dark text-xs font-semibold flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-text-primary truncate">{roleLabel}</p>
            <p className="text-[11px] text-text-muted truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="sidebar-link w-full text-left text-danger"
        >
          <LogOut size={16} />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  )
}
