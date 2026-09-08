'use client';

import { useState, useRef, useEffect } from 'react';
import { Calendar } from 'lucide-react';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
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

function parseISO(iso: string | Date | null): ParsedDate | null {
  if (!iso) return null;
  
  if (typeof iso === 'string') {
    const parts = iso.split('-').map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
      return { year: parts[0], month: parts[1] - 1, day: parts[2] };
    }
  }
  
  const d = iso instanceof Date ? iso : new Date(iso);
  if (!isNaN(d.getTime())) {
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
  }
  
  return null;
}

function formatDisplay(iso: string | Date | null): string | null {
  if (!iso) return null;
  const p = parseISO(iso);
  if (!p) return null;
  return `${p.day} ${MONTH_NAMES[p.month]?.slice(0, 3) || ''} ${p.year}`;
}

interface DayCell {
  day: number;
  other: boolean;
}

export interface DatePickerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
}

export default function DatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  disabled = false,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const parsed = value ? parseISO(value) : null;
  const now = new Date();
  const [viewYear, setViewYear] = useState(
    parsed ? parsed.year : now.getFullYear()
  );
  const [viewMonth, setViewMonth] = useState(
    parsed ? parsed.month : now.getMonth()
  );
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const p = value ? parseISO(value) : null;
    if (p) {
      setViewYear(p.year);
      setViewMonth(p.month);
    }
  }, [value]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (
        wrapRef.current &&
        !wrapRef.current.contains(e.target as Node)
      ) {
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

  const cells: DayCell[] = [];
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
    if (m < 0) {
      m = 11;
      y -= 1;
    }
    if (m > 11) {
      m = 0;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
  }

  function pick(day: number) {
    const selectedDate = new Date(viewYear, viewMonth, day);
    onChange(selectedDate);
    setOpen(false);
  }

  const yearOptions = YEARS.includes(viewYear)
    ? YEARS
    : [...YEARS, viewYear].sort((a, b) => a - b);

  const displayValue = value ? formatDisplay(value) : null;

  return (
    <div className="dp-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`dp-trigger ${open ? 'open' : ''} ${
          !value ? 'placeholder' : ''
        }`}
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
      >
        <span>{displayValue || placeholder}</span>
        <Calendar size={16} />
      </button>

      {open && (
        <div className="dp-panel">
          <div className="dp-header">
            <button
              type="button"
              className="dp-nav-btn"
              onClick={() => changeMonth(-1)}
              title="Previous month"
              aria-label="Previous month"
            >
              ‹
            </button>

            <div className="dp-my-selectors">
              <select
                className="dp-select dp-select-month"
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
                className="dp-select dp-select-year"
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
              className="dp-nav-btn"
              onClick={() => changeMonth(1)}
              title="Next month"
              aria-label="Next month"
            >
              ›
            </button>
          </div>
          <div className="dp-dow-row">
            {DOW.map((d, i) => (
              <div className="dp-dow" key={i}>
                {d}
              </div>
            ))}
          </div>
          <div className="dp-days">
            {cells.map((c, i) => {
              const isToday =
                !c.other &&
                viewYear === today.getFullYear() &&
                viewMonth === today.getMonth() &&
                c.day === today.getDate();
              const isSelected =
                !c.other &&
                value &&
                value.getFullYear() === viewYear &&
                value.getMonth() === viewMonth &&
                value.getDate() === c.day;
              return (
                <button
                  key={i}
                  type="button"
                  className={[
                    'dp-day',
                    c.other ? 'dp-day-other' : '',
                    isToday ? 'dp-day-today' : '',
                    isSelected ? 'dp-day-selected' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={c.other}
                  onClick={() => !c.other && pick(c.day)}
                >
                  {c.day}
                </button>
              );
            })}
          </div>
          <div className="dp-footer">
            <button
              type="button"
              className="dp-clear"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              Clear
            </button>
            <button
              type="button"
              className="dp-today-btn"
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
