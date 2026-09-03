import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

interface Props { allowedRoles: string[] }

export default function ProtectedRoute({ allowedRoles }: Props) {
  const { isAuthenticated, isLoading, user } = useAuthStore()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-0">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated || !user) return <Navigate to="/login" replace />

  if (!allowedRoles.includes(user.role)) {
    const redirect =
      user.role === 'STUDENT' ? '/dashboard' :
      user.role === 'DEPT_ADMIN' ? '/admin' : '/super-admin'
    return <Navigate to={redirect} replace />
  }

  return <Outlet />
}
