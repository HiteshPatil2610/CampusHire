/* ============================================================
   authService — TODO(real-data): wire these to your real auth
   endpoints. Each function currently documents the expected
   request/response shape so the UI layer doesn't need to change
   when the backend lands. See DUMMY_DATA.md.
   ============================================================ */
import { api } from './client';

export const authService = {
  // POST /api/auth/login { email, password } -> { token, role, user }
  login: (email, password) => api.post('/auth/login', { email, password }),

  // POST /api/auth/register { name, rollNo, email, password, phone, dob, department, year, gender }
  // -> { otpSent: true, email }
  register: (payload) => api.post('/auth/register', payload),

  // POST /api/auth/verify-otp { email, code } -> { token, role, user }
  verifyOtp: (email, code) => api.post('/auth/verify-otp', { email, code }),

  // POST /api/auth/resend-otp { email } -> { sent: true }
  resendOtp: (email) => api.post('/auth/resend-otp', { email }),

  // POST /api/auth/request-reset { email } -> { sent: true }
  requestPasswordReset: (email) => api.post('/auth/request-reset', { email }),

  // POST /api/auth/reset-password { token, newPassword } -> { success: true }
  resetPassword: (token, newPassword) => api.post('/auth/reset-password', { token, newPassword }),

  // POST /api/auth/logout -> { success: true }
  logout: () => api.post('/auth/logout'),
};
