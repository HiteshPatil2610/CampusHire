/**
 * Toast Hook
 * 
 * Migrated from Vite frontend (ToastContext.jsx)
 * Uses Zustand for state management instead of React Context
 * Provides imperative toast notifications
 */

"use client";

import { create } from "zustand";

export type ToastType = "success" | "error" | "warning" | "info" | "";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

/**
 * Zustand store for managing toast notifications
 */
export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  
  /**
   * Add a new toast notification
   * 
   * @param message - The message to display
   * @param type - Type of toast (success, error, warning, info, or empty string for default)
   * @param duration - How long to show the toast in milliseconds (default: 3000)
   */
  addToast: (message: string, type: ToastType = "", duration: number = 3000) => {
    const id = Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }));

    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }
  },
  
  /**
   * Remove a specific toast by ID
   */
  removeToast: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
  
  /**
   * Clear all toasts
   */
  clearAll: () => {
    set({ toasts: [] });
  },
}));

/**
 * Hook to show toast notifications
 * 
 * @example
 * ```tsx
 * const { showToast } = useToast();
 * 
 * // Show success toast
 * showToast("Profile updated successfully", "success");
 * 
 * // Show error toast
 * showToast("Failed to save changes", "error");
 * 
 * // Show warning toast
 * showToast("Please review your information", "warning");
 * 
 * // Show info toast
 * showToast("New drive available", "info");
 * 
 * // Show default toast
 * showToast("Something happened");
 * ```
 */
export function useToast() {
  const addToast = useToastStore((state) => state.addToast);
  
  return {
    showToast: addToast,
    toast: addToast, // Alias for convenience
  };
}
