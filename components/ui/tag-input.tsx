'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

export interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  disabled?: boolean;
}

export default function TagInput({
  value,
  onChange,
  placeholder = 'Type and press Enter…',
  maxTags,
  disabled = false,
}: TagInputProps) {
  const [draft, setDraft] = useState('');

  function commit(val?: string) {
    const v = (val !== undefined ? val : draft)
      .trim()
      .replace(/^,|,$/g, '');
    
    if (v && !value.includes(v)) {
      if (maxTags && value.length >= maxTags) {
        return; // Don't add if max tags reached
      }
      onChange([...value, v]);
    }
    setDraft('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    
    if (val.includes(',')) {
      const parts = val
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      const newTags = [...value];
      
      parts.forEach((p) => {
        if (!newTags.includes(p)) {
          if (!maxTags || newTags.length < maxTags) {
            newTags.push(p);
          }
        }
      });
      
      onChange(newTags);
      setDraft('');
    } else {
      setDraft(val);
    }
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  const isMaxReached = maxTags ? value.length >= maxTags : false;

  return (
    <div className="tag-input-wrap">
      {value.map((tag) => (
        <span className="tag" key={tag}>
          {tag}
          <button
            type="button"
            onClick={() => !disabled && removeTag(tag)}
            disabled={disabled}
            aria-label={`Remove ${tag}`}
          >
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        className="tag-input"
        value={draft}
        placeholder={
          isMaxReached
            ? `Max ${maxTags} tags reached`
            : placeholder
        }
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => commit()}
        disabled={disabled || isMaxReached}
      />
    </div>
  );
}
