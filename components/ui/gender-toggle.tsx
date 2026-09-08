/**
 * GenderToggle Component
 * 
 * Migrated from Vite frontend (GenderToggle.jsx)
 * Toggle button group for gender selection
 * Converted to TypeScript with Tailwind utilities
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const OPTIONS = ['Male', 'Female', 'Other'] as const;

export type Gender = typeof OPTIONS[number];

export interface GenderToggleProps {
  value?: Gender | string;
  onChange: (value: Gender) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * GenderToggle - Toggle button group for gender selection
 * 
 * @example
 * ```tsx
 * <GenderToggle
 *   value={gender}
 *   onChange={(value) => setGender(value)}
 * />
 * ```
 */
export default function GenderToggle({
  value,
  onChange,
  disabled = false,
  className,
}: GenderToggleProps) {
  return (
    <div className={cn("inline-flex rounded-lg border border-border bg-surface-1 p-1", className)}>
      {OPTIONS.map((opt) => {
        const isActive = value === opt;
        
        return (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-md transition-all",
              "focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2",
              isActive
                ? "bg-accent text-white shadow-sm"
                : "text-text-secondary hover:text-text-primary hover:bg-surface-2",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            onClick={() => !disabled && onChange(opt)}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
