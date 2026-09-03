import client from './client'

export interface RegisterPayload {
  email: string
  password: string
  full_name: string
  roll_number: string
  phone_number: string
  department_id: string
  current_year: number
  current_semester: number
  gender?: string
}

export interface LoginPayload { email: string; password: string }

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  role: string
  user_id: string
  must_change_password: boolean
}

export const authApi = {
  register: (data: RegisterPayload) =>
    client.post<{ user_id: string; message: string }>('/auth/register', data),

  verifyOtp: (user_id: string, otp: string, purpose = 'REGISTRATION') =>
    client.post<{ message: string }>('/auth/verify-otp', { user_id, otp, purpose }),

  resendOtp: (user_id: string, purpose = 'REGISTRATION') =>
    client.post<{ message: string }>('/auth/resend-otp', { user_id, purpose }),

  login: (data: LoginPayload) =>
    client.post<TokenResponse>('/auth/login', data),

  refresh: (refresh_token: string) =>
    client.post<TokenResponse>('/auth/refresh', { refresh_token }),

  logout: (refresh_token: string) =>
    client.post<{ message: string }>('/auth/logout', { refresh_token }),

  forgotPassword: (email: string) =>
    client.post<{ user_id: string; message: string }>('/auth/forgot-password', { email }),

  resetPassword: (user_id: string, otp: string, new_password: string) =>
    client.post<{ message: string }>('/auth/reset-password', { user_id, otp, new_password }),

  changePassword: (current_password: string, new_password: string) =>
    client.post<{ message: string }>('/auth/change-password', { current_password, new_password }),

  me: () => client.get<{ id: string; email: string; role: string; status: string; email_verified: boolean; must_change_password: boolean }>('/auth/me'),
}
