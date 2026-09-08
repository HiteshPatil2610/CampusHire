/**
 * DatePicker Component
 * 
 * Migrated from Vite frontend (DatePicker.jsx)
 * Custom calendar with month/year dropdowns for easy navigation
 * Converted to TypeScript with Tailwind utilities
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const START_YEAR = 1950;
const END_YEAR = 2040;
const YEARS: number[] = [];
for (let y = START_YEAR; y <= END_YEAR; y++) {
  YEARS.push(y);
}

interface ParsedDate {
  year: number;
  month: number;
  day: number;
}

function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function parseISO(iso: string | null | undefined): ParsedDate | null {
  if (!iso) return null;
  const parts = String(iso).split('-').map(Number);
  if (parts.length === 3 && !parts.some(isNaN)) {
    return { year: parts[0], month: parts[1] - 1, day: parts[2] };
  }
  const d = new Date(iso);
  if (!isNaN(d.getTime())) {
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
  }
  return null;
}

function formatDisplay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const p = parseISO(iso);
  if (!p) return null;
  return `${p.day} ${MONTH_NAMES[p.month]?.slice(0, 3) || ''} ${p.year}`;
}

export interface DatePickerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * DatePicker - Custom calendar input component
 * 
 * @example
 * ```tsx
 * <DatePicker
 *   value={dateOfBirth}
 *   onChange={(date) => setDateOfBirth(date)}
 *   placeholder="Select date of birth"
 * />
 * ```
 */
export default function DatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  disabled = false,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const parsed = parseISO(value);
  const now = new Date();
  const [viewYear, setViewYear] = React.useState(parsed ? parsed.year : now.getFullYear());
  const [viewMonth, setViewMonth] = React.useState(parsed ? parsed.month : now.getMonth());
  const wrapRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const p = parseISO(value);
    if (p) {
      setViewYear(p.year);
      setViewMonth(p.month);
    }
  }, [value]);

  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const today = new Date();
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startOffset = firstOfMonth.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const cells: { day: number; other: boolean }[] = [];
  for (let i = startOffset - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, other: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, other: false });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: cells.length - startOffset - daysInMonth + 1, other: true });
  }

  function changeMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  }

  function pick(day: number) {
    const iso = toISO(viewYear, viewMonth, day);
    onChange(iso);
    setOpen(false);
  }

  // Ensure current viewYear is included in dropdown list
  const yearOptions = YEARS.includes(viewYear) ? YEARS : [...YEARS, viewYear].sort((a, b) => a - b);

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 text-sm border border-border rounded-lg",
          "bg-surface-2 hover:bg-surface-1 transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent",
          !value && "text-text-muted",
          disabled && "opacity-50 cursor-not-allowed",
          open && "ring-2 ring-accent border-accent"
        )}
        onClick={() => !disabled && setOpen((o) => !o)}
      >
        <span>{formatDisplay(value) || placeholder}</span>
        <span aria-hidden="true">📅</span>
      </button>

      {open && !disabled && (
        <div className="absolute z-50 mt-2 w-80 bg-surface-2 border border-border rounded-lg shadow-lg p-4">
          {/* Header with navigation */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              className="p-2 hover:bg-surface-1 rounded transition-colors"
              onClick={() => changeMonth(-1)}
              title="Previous month"
              aria-label="Previous month"
            >
              <span className="text-lg">‹</span>
            </button>

            <div className="flex gap-2">
              <select
                className="px-2 py-1 text-sm border border-border rounded bg-surface-2 hover:bg-surface-1 focus:outline-none focus:ring-2 focus:ring-accent"
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                aria-label="Select month"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx}>
                    {name}
                  </option>
                ))}
              </select>

              <select
                className="px-2 py-1 text-sm border border-border rounded bg-surface-2 hover:bg-surface-1 focus:outline-none focus:ring-2 focus:ring-accent"
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                aria-label="Select year"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="p-2 hover:bg-surface-1 rounded transition-colors"
              onClick={() => changeMonth(1)}
              title="Next month"
              aria-label="Next month"
            >
              <span className="text-lg">›</span>
            </button>
          </div>

          {/* Days of week header */}
          <div className="grid grid-cols-7 mb-2">
            {DOW.map((d, i) => (
              <div key={i} className="text-center text-xs font-semibold text-text-secondary py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar days grid */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((c, i) => {
              const isToday =
                !c.other &&
                viewYear === today.getFullYear() &&
                viewMonth === today.getMonth() &&
                c.day === today.getDate();
              const isSelected =
                !c.other && value === toISO(viewYear, viewMonth, c.day);
              
              return (
                <button
                  key={i}
                  type="button"
                  disabled={c.other}
                  className={cn(
                    "h-8 text-sm rounded transition-colors",
                    c.other && "text-text-muted opacity-40 cursor-not-allowed",
                    !c.other && "hover:bg-surface-1",
                    isToday && "font-bold border border-accent",
                    isSelected && "bg-accent text-white hover:bg-accent-dark"
                  )}
                  onClick={() => !c.other && pick(c.day)}
                >
                  {c.day}
                </button>
              );
            })}
          </div>

          {/* Footer with Clear and Today buttons */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
            <button
              type="button"
              className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-1 rounded transition-colors"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
            >
              Clear
            </button>
            <button
              type="button"
              className="px-3 py-1.5 text-xs bg-accent text-white hover:bg-accent-dark rounded transition-colors font-medium"
              onClick={() => {
                const t = new Date();
                setViewYear(t.getFullYear());
                setViewMonth(t.getMonth());
                pick(t.getDate());
              }}
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
