import axios from 'axios'

const client = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
})

// Attach access token from localStorage on every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Refresh-token interceptor — wired in authStore after store is created
export let attachRefreshInterceptor: (refreshFn: () => Promise<string>) => void

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const { useAuthStore } = await import('@/store/authStore')
        const newToken = await useAuthStore.getState().refreshAccessToken()
        original.headers.Authorization = `Bearer ${newToken}`
        return client(original)
      } catch {
        const { useAuthStore } = await import('@/store/authStore')
        useAuthStore.getState().logout()
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default client
