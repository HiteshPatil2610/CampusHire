import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PATHS } from './routes/paths';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';

import LandingPage from './pages/public/LandingPage';
import LoginPage from './pages/public/LoginPage';
import RegisterPage from './pages/public/RegisterPage';
import OtpVerificationPage from './pages/public/OtpVerificationPage';
import ResetPasswordPage from './pages/public/ResetPasswordPage';
import NotFoundPage from './pages/public/NotFoundPage';

import HomePage from './pages/student/HomePage';
import StudentDashboardPage from './pages/student/StudentDashboardPage';
import StudentProfilePage from './pages/student/StudentProfilePage';
import ResumeBuilderPage from './pages/student/ResumeBuilderPage';
import AiAnalyzerPage from './pages/student/AiAnalyzerPage';
import SelfAssessmentPage from './pages/student/SelfAssessmentPage';
import ReadinessDashboardPage from './pages/student/ReadinessDashboardPage';
import NotificationsPage from './pages/student/NotificationsPage';
import SettingsPage from './pages/student/SettingsPage';

import AdminHomePage from './pages/admin/AdminHomePage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AddStudentPage from './pages/admin/AddStudentPage';
import ExcelUploadPage from './pages/admin/ExcelUploadPage';
import PostDrivePage from './pages/admin/PostDrivePage';
import AnnouncementsPage from './pages/admin/AnnouncementsPage';
import ReportsAnalyticsPage from './pages/admin/ReportsAnalyticsPage';

import SuperAdminDashboardPage from './pages/superadmin/SuperAdminDashboardPage';
import SuperAdminStudentsPage from './pages/superadmin/SuperAdminStudentsPage';
import SuperAdminDrivesPage from './pages/superadmin/SuperAdminDrivesPage';
import DepartmentManagementPage from './pages/superadmin/DepartmentManagementPage';
import AdminAccountsPage from './pages/superadmin/AdminAccountsPage';
import GlobalReportsPage from './pages/superadmin/GlobalReportsPage';
import AuditLogPage from './pages/superadmin/AuditLogPage';
import SystemSettingsPage from './pages/superadmin/SystemSettingsPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path={PATHS.landing} element={<LandingPage />} />
          <Route path={PATHS.login} element={<LoginPage />} />
          <Route path={PATHS.register} element={<RegisterPage />} />
          <Route path={PATHS.otpVerification} element={<OtpVerificationPage />} />
          <Route path={PATHS.resetPassword} element={<ResetPasswordPage />} />

          {/* Student Protected Routes */}
          <Route path={PATHS.home} element={<ProtectedRoute allowedRoles={['student']}><HomePage /></ProtectedRoute>} />
          <Route path={PATHS.studentDashboard} element={<ProtectedRoute allowedRoles={['student']}><StudentDashboardPage /></ProtectedRoute>} />
          <Route path={PATHS.studentProfile} element={<ProtectedRoute allowedRoles={['student']}><StudentProfilePage /></ProtectedRoute>} />
          <Route path={PATHS.resumeBuilder} element={<ProtectedRoute allowedRoles={['student']}><ResumeBuilderPage /></ProtectedRoute>} />
          <Route path={PATHS.aiAnalyzer} element={<ProtectedRoute allowedRoles={['student']}><AiAnalyzerPage /></ProtectedRoute>} />
          <Route path={PATHS.selfAssessment} element={<ProtectedRoute allowedRoles={['student']}><SelfAssessmentPage /></ProtectedRoute>} />
          <Route path={PATHS.readinessDashboard} element={<ProtectedRoute allowedRoles={['student']}><ReadinessDashboardPage /></ProtectedRoute>} />
          <Route path={PATHS.notifications} element={<ProtectedRoute allowedRoles={['student']}><NotificationsPage /></ProtectedRoute>} />
          <Route path={PATHS.settings} element={<ProtectedRoute allowedRoles={['student']}><SettingsPage /></ProtectedRoute>} />

          {/* Dept Admin Protected Routes */}
          <Route path={PATHS.adminHome} element={<ProtectedRoute allowedRoles={['admin']}><AdminHomePage /></ProtectedRoute>} />
          <Route path={PATHS.adminDashboard} element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboardPage /></ProtectedRoute>} />
          <Route path={PATHS.addStudent} element={<ProtectedRoute allowedRoles={['admin']}><AddStudentPage /></ProtectedRoute>} />
          <Route path={PATHS.excelUpload} element={<ProtectedRoute allowedRoles={['admin']}><ExcelUploadPage /></ProtectedRoute>} />
          <Route path={PATHS.postDrive} element={<ProtectedRoute allowedRoles={['admin']}><PostDrivePage /></ProtectedRoute>} />
          <Route path={PATHS.announcements} element={<ProtectedRoute allowedRoles={['admin']}><AnnouncementsPage /></ProtectedRoute>} />
          <Route path={PATHS.reportsAnalytics} element={<ProtectedRoute allowedRoles={['admin']}><ReportsAnalyticsPage /></ProtectedRoute>} />

          {/* Super Admin Protected Routes */}
          <Route path={PATHS.superAdminDashboard} element={<ProtectedRoute allowedRoles={['superadmin']}><SuperAdminDashboardPage /></ProtectedRoute>} />
          <Route path={PATHS.superAdminStudents} element={<ProtectedRoute allowedRoles={['superadmin']}><SuperAdminStudentsPage /></ProtectedRoute>} />
          <Route path={PATHS.superAdminDrives} element={<ProtectedRoute allowedRoles={['superadmin']}><SuperAdminDrivesPage /></ProtectedRoute>} />
          <Route path={PATHS.departmentManagement} element={<ProtectedRoute allowedRoles={['superadmin']}><DepartmentManagementPage /></ProtectedRoute>} />
          <Route path={PATHS.adminAccounts} element={<ProtectedRoute allowedRoles={['superadmin']}><AdminAccountsPage /></ProtectedRoute>} />
          <Route path={PATHS.globalReports} element={<ProtectedRoute allowedRoles={['superadmin']}><GlobalReportsPage /></ProtectedRoute>} />
          <Route path={PATHS.auditLog} element={<ProtectedRoute allowedRoles={['superadmin']}><AuditLogPage /></ProtectedRoute>} />
          <Route path={PATHS.systemSettings} element={<ProtectedRoute allowedRoles={['superadmin']}><SystemSettingsPage /></ProtectedRoute>} />

          {/* 404 Catch-All */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
