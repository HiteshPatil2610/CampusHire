import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'

// Auth pages
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import OTPVerificationPage from '@/pages/auth/OTPVerificationPage'
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage'

// Student pages
import StudentDashboard from '@/pages/student/Dashboard'
import StudentProfile from '@/pages/student/Profile'
import ReadinessDashboard from '@/pages/student/Readiness'
import NotificationsPage from '@/pages/student/Notifications'
import StudentSettings from '@/pages/student/Settings'

// Admin pages
import AdminHome from '@/pages/admin/Home'
import AdminStudents from '@/pages/admin/Students'
import AddStudent from '@/pages/admin/AddStudent'
import ExcelUpload from '@/pages/admin/ExcelUpload'

// Super admin pages
import SuperAdminDashboard from '@/pages/super-admin/Dashboard'
import DepartmentsPage from '@/pages/super-admin/Departments'
import AdminAccountsPage from '@/pages/super-admin/AdminAccounts'

// Layout / guards
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'

// Toast
import { ToastContainer } from '@/components/common/Toast'

// Auth store
import { useAuthStore } from '@/store/authStore'

export default function App() {
  const { initAuth } = useAuthStore()

  useEffect(() => {
    initAuth()
  }, [initAuth])

  return (
    <>
      <ToastContainer />
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-otp" element={<OTPVerificationPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Student routes */}
        <Route element={<ProtectedRoute allowedRoles={['STUDENT']} />}>
          <Route element={<AppLayout role="student" />}>
            <Route path="/dashboard" element={<StudentDashboard />} />
            <Route path="/profile" element={<StudentProfile />} />
            <Route path="/readiness" element={<ReadinessDashboard />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/settings" element={<StudentSettings />} />
          </Route>
        </Route>

        {/* Admin routes */}
        <Route element={<ProtectedRoute allowedRoles={['DEPT_ADMIN']} />}>
          <Route element={<AppLayout role="admin" />}>
            <Route path="/admin" element={<AdminHome />} />
            <Route path="/admin/students" element={<AdminStudents />} />
            <Route path="/admin/students/add" element={<AddStudent />} />
            <Route path="/admin/students/import" element={<ExcelUpload />} />
          </Route>
        </Route>

        {/* Super admin routes */}
        <Route element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']} />}>
          <Route element={<AppLayout role="super-admin" />}>
            <Route path="/super-admin" element={<SuperAdminDashboard />} />
            <Route path="/super-admin/departments" element={<DepartmentsPage />} />
            <Route path="/super-admin/admins" element={<AdminAccountsPage />} />
          </Route>
        </Route>

        {/* Root redirect */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  )
}
