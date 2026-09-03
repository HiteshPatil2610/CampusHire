import { AxiosError } from 'axios'

/** Extract a readable message from an Axios error response */
export function getErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data
    if (typeof data === 'string') return data
    if (data?.detail) {
      if (typeof data.detail === 'string') return data.detail
      if (Array.isArray(data.detail)) return data.detail.map((d: { msg: string }) => d.msg).join(', ')
    }
    if (data?.message) return data.message
  }
  if (err instanceof Error) return err.message
  return fallback
}
