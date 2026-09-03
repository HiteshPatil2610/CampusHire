import { create } from 'zustand'
import { authApi } from '@/api/auth'

interface AuthUser {
  id: string
  email: string
  role: 'STUDENT' | 'DEPT_ADMIN' | 'SUPER_ADMIN'
  status: string
  email_verified: boolean
  must_change_password: boolean
}

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
  isLoading: boolean
  isAuthenticated: boolean

  initAuth: () => void
  setTokens: (access: string, refresh: string) => void
  setUser: (user: AuthUser) => void
  logout: () => void
  refreshAccessToken: () => Promise<string>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: localStorage.getItem('access_token'),
  refreshToken: localStorage.getItem('refresh_token'),
  isLoading: true,
  isAuthenticated: false,

  initAuth: async () => {
    const access = localStorage.getItem('access_token')
    const refresh = localStorage.getItem('refresh_token')
    if (!access || !refresh) {
      set({ isLoading: false, isAuthenticated: false })
      return
    }
    set({ accessToken: access, refreshToken: refresh })
    try {
      const res = await authApi.me()
      set({ user: res.data as AuthUser, isAuthenticated: true, isLoading: false })
    } catch {
      // Token likely expired — try refresh
      try {
        const newToken = await get().refreshAccessToken()
        const res = await authApi.me()
        set({ user: res.data as AuthUser, isAuthenticated: true, isLoading: false })
      } catch {
        get().logout()
        set({ isLoading: false })
      }
    }
  },

  setTokens: (access, refresh) => {
    localStorage.setItem('access_token', access)
    localStorage.setItem('refresh_token', refresh)
    set({ accessToken: access, refreshToken: refresh, isAuthenticated: true })
  },

  setUser: (user) => set({ user }),

  logout: () => {
    const refresh = get().refreshToken
    if (refresh) {
      authApi.logout(refresh).catch(() => {})
    }
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
  },

  refreshAccessToken: async () => {
    const refresh = get().refreshToken
    if (!refresh) throw new Error('No refresh token')
    const res = await authApi.refresh(refresh)
    const { access_token, refresh_token } = res.data
    localStorage.setItem('access_token', access_token)
    localStorage.setItem('refresh_token', refresh_token)
    set({ accessToken: access_token, refreshToken: refresh_token })
    return access_token
  },
}))
