import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'warning' | 'default'

export interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastState {
  toasts: Toast[]
  show: (message: string, type?: ToastType, duration?: number) => void
  remove: (id: string) => void
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  show: (message, type = 'default', duration = 3500) => {
    const id = Math.random().toString(36).slice(2)
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => get().remove(id), duration)
  },

  remove: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

// Convenience helper — call anywhere without hooks
export const toast = {
  success: (msg: string) => useToastStore.getState().show(msg, 'success'),
  error:   (msg: string) => useToastStore.getState().show(msg, 'error'),
  warning: (msg: string) => useToastStore.getState().show(msg, 'warning'),
  info:    (msg: string) => useToastStore.getState().show(msg, 'default'),
}
