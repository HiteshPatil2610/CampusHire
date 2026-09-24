'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { searchSkills, type SkillOption } from '@/features/skills/queries/search-skills';

/** One skill on the form: the name shown, and whether it is still pending review. */
export interface SkillTag {
  name: string;
  pending: boolean;
}

export interface SkillPickerProps {
  skillType: 'TECHNICAL' | 'SOFT';
  value: SkillTag[];
  onChange: (value: SkillTag[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

const DEBOUNCE_MS = 200;

/**
 * The master-list autocomplete (Item 3): searches approved skills of this
 * type as the student types, and falls back to free text when nothing on
 * the list matches — which the student sees marked "pending review" right
 * away, not as a rejection.
 *
 * "Pending" here is a client-side guess — a tag committed without being
 * picked from a live suggestion. It is corrected the moment the profile
 * reloads after saving, when the server's own status is known: exact text a
 * student happens to type without clicking the suggestion still matches the
 * approved entry server-side, so a tag shown pending for a few seconds can
 * turn out to already be approved, never the other way round.
 */
export default function SkillPicker({
  skillType,
  value,
  onChange,
  placeholder = 'Type to search, or add your own…',
  disabled = false,
}: SkillPickerProps) {
  const [draft, setDraft] = useState('');
  const [suggestions, setSuggestions] = useState<SkillOption[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const names = new Set(value.map((tag) => tag.name.toLowerCase()));

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      searchSkills({ query: draft, skillType })
        .then((results) => {
          if (!cancelled) setSuggestions(results.filter((r) => !names.has(r.name.toLowerCase())));
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, skillType, value.length]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function addTag(name: string, pending: boolean) {
    const trimmed = name.trim();
    if (!trimmed || names.has(trimmed.toLowerCase())) {
      setDraft('');
      setOpen(false);
      return;
    }
    onChange([...value, { name: trimmed, pending }]);
    setDraft('');
    setOpen(false);
    setHighlighted(0);
  }

  function commitDraft() {
    if (!draft.trim()) return;
    // An exact match (case-insensitive) among what is on the list right now
    // is a pick, not a new request — everything else is free-text fallback.
    const exact = suggestions.find((s) => s.name.toLowerCase() === draft.trim().toLowerCase());
    addTag(draft, !exact);
  }

  function removeTag(name: string) {
    onChange(value.filter((tag) => tag.name !== name));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlighted((current) => Math.min(current + 1, suggestions.length - 1));
      setOpen(true);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlighted((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      if (open && suggestions[highlighted]) {
        addTag(suggestions[highlighted].name, false);
      } else {
        commitDraft();
      }
      return;
    }
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (event.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div className="tag-input-wrap">
        {value.map((tag) => (
          <span
            className="tag"
            key={tag.name}
            style={tag.pending ? { background: 'var(--amber-light)', border: '0.5px solid var(--amber)' } : undefined}
          >
            {tag.name}
            {tag.pending && (
              <span style={{ fontSize: 10, color: 'var(--amber)', fontWeight: 600 }} title="Not yet on the master list — a Super Admin will review it">
                pending
              </span>
            )}
            <button
              type="button"
              onClick={() => !disabled && removeTag(tag.name)}
              disabled={disabled}
              aria-label={`Remove ${tag.name}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          className="tag-input"
          value={draft}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => {
            setDraft(e.target.value);
            setOpen(true);
            setHighlighted(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // A short delay lets a suggestion click register before the list closes.
            setTimeout(() => commitDraft(), 120);
          }}
        />
      </div>

      {open && (suggestions.length > 0 || draft.trim()) && (
        <div
          style={{
            position: 'absolute',
            zIndex: 20,
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            background: 'var(--surface-0)',
            border: '0.5px solid var(--border-strong)',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          {suggestions.map((option, index) => (
            <button
              key={option.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addTag(option.name, false)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                fontSize: 13,
                border: 'none',
                background: index === highlighted ? 'var(--surface-hover)' : 'transparent',
                cursor: 'pointer',
              }}
            >
              {option.name}
            </button>
          ))}
          {draft.trim() && !suggestions.some((s) => s.name.toLowerCase() === draft.trim().toLowerCase()) && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addTag(draft, true)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                fontSize: 12,
                color: 'var(--text-secondary)',
                border: 'none',
                borderTop: suggestions.length > 0 ? '0.5px solid var(--border)' : undefined,
                background: 'transparent',
                cursor: 'pointer',
              }}
            >
              + Add &quot;{draft.trim()}&quot; — not on the list, will be submitted for review
            </button>
          )}
        </div>
      )}
    </div>
  );
}
