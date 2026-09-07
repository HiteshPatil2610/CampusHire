/* ============================================================
   Route path constants — mirrors FRONTEND_ARCHITECTURE.md §3 file inventory.
   Original filename kept as a comment for traceability during migration.
   ============================================================ */

export const PATHS = {
  // Public
  landing: '/', // index.html
  login: '/login', // login.html
  register: '/register', // register.html
  otpVerification: '/otp-verification', // otp-verification.html
  resetPassword: '/reset-password', // reset-password.html

  // Student
  home: '/home', // home.html — first page after student login
  studentDashboard: '/dashboard', // student-dashboard.html
  studentProfile: '/profile', // student-profile.html
  resumeBuilder: '/resume-builder', // resume-builder.html
  aiAnalyzer: '/ai-analyzer', // ai-analyzer.html
  selfAssessment: '/self-assessment', // self-assessment.html
  readinessDashboard: '/readiness', // readiness-dashboard.html
  notifications: '/notifications', // notifications.html
  settings: '/settings', // settings.html

  // Dept Admin
  adminHome: '/admin/home', // admin-home.html — first page after admin login
  adminDashboard: '/admin/students', // admin-dashboard.html
  addStudent: '/admin/students/add', // add-student.html
  excelUpload: '/admin/students/import', // excel-upload.html
  postDrive: '/admin/drives', // post-drive.html
  announcements: '/admin/announcements', // announcements.html
  reportsAnalytics: '/admin/reports', // reports-analytics.html

  // Super Admin
  superAdminDashboard: '/super-admin', // super-admin-dashboard.html — first page after TPO login
  superAdminStudents: '/super-admin/students', // super-admin-students.html
  superAdminDrives: '/super-admin/drives', // super-admin-drives.html
  departmentManagement: '/super-admin/departments', // department-management.html
  adminAccounts: '/super-admin/admin-accounts', // admin-accounts.html
  globalReports: '/super-admin/reports', // global-reports.html
  auditLog: '/super-admin/audit-log', // audit-log.html
  systemSettings: '/super-admin/settings', // system-settings.html
};
