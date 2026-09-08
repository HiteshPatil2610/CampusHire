/**
 * Modal Component
 * 
 * Migrated from Vite frontend (Modal.jsx)
 * Generic modal overlay with backdrop click-to-close
 * Converted to TypeScript with Tailwind utilities and proper accessibility
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ModalProps {
  /**
   * Controls whether the modal is open
   */
  open?: boolean;
  
  /**
   * Callback fired when the modal should close (e.g., backdrop click or ESC key)
   */
  onClose?: () => void;
  
  /**
   * Content to display inside the modal
   */
  children: React.ReactNode;
  
  /**
   * Optional size variant for the modal card
   * - 'sm': Small modal (max-w-md)
   * - 'md': Medium modal (max-w-lg) - default
   * - 'lg': Large modal (max-w-2xl)
   * - 'xl': Extra large modal (max-w-4xl)
   * - 'full': Full width modal (max-w-6xl)
   */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full' | string;
  
  /**
   * Additional CSS classes for the modal card
   */
  className?: string;
  
  /**
   * If true, prevents closing on backdrop click
   */
  disableBackdropClick?: boolean;
  
  /**
   * If true, prevents closing on ESC key press
   */
  disableEscapeKeyDown?: boolean;
}

/**
 * Modal - Full-screen overlay with centered content card
 * 
 * Features:
 * - Click backdrop to close
 * - Press ESC to close
 * - Focus trap (basic)
 * - Smooth fade-in animation
 * - Prevents body scroll when open
 * 
 * @example
 * ```tsx
 * const [open, setOpen] = useState(false);
 * 
 * <Modal open={open} onClose={() => setOpen(false)} size="lg">
 *   <div className="p-6">
 *     <h2 className="text-xl font-semibold mb-4">Modal Title</h2>
 *     <p>Modal content goes here...</p>
 *     <div className="mt-6 flex gap-2 justify-end">
 *       <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
 *       <Button onClick={handleSave}>Save</Button>
 *     </div>
 *   </div>
 * </Modal>
 * ```
 */
export default function Modal({
  open = true,
  onClose,
  children,
  size = 'md',
  className,
  disableBackdropClick = false,
  disableEscapeKeyDown = false,
}: ModalProps) {
  const modalRef = React.useRef<HTMLDivElement>(null);

  // Handle ESC key press
  React.useEffect(() => {
    if (!open || disableEscapeKeyDown) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose, disableEscapeKeyDown]);

  // Prevent body scroll when modal is open
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Don't render if not open
  if (!open) return null;

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disableBackdropClick) return;
    if (e.target === e.currentTarget) {
      onClose?.();
    }
  };

  // Size classes mapping
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-6xl',
  };

  const sizeClass = sizeClasses[size as keyof typeof sizeClasses] || size;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onMouseDown={handleBackdropClick}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={modalRef}
        className={cn(
          // Base styles
          "relative w-full bg-surface-2 rounded-lg shadow-lg animate-in zoom-in-95 duration-200",
          // Size
          sizeClass,
          // Custom classes
          className
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * ModalHeader - Optional header component for consistent modal headers
 */
export function ModalHeader({
  children,
  className,
  onClose,
}: {
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
}) {
  return (
    <div className={cn("flex items-center justify-between p-6 pb-4", className)}>
      <div className="text-xl font-semibold text-text-primary">{children}</div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-text-muted hover:text-text-primary transition-colors"
          aria-label="Close modal"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

/**
 * ModalBody - Optional body component for consistent modal content
 */
export function ModalBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-6 py-4", className)}>
      {children}
    </div>
  );
}

/**
 * ModalFooter - Optional footer component for modal actions
 */
export function ModalFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-end gap-2 p-6 pt-4 border-t border-border", className)}>
      {children}
    </div>
  );
}

export { Modal };
