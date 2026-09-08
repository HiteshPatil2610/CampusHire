'use client';

import { ExternalLink } from 'lucide-react';

export interface UrlFieldProps {
  value: string;
  onChange: (value: string) => void;
  platform?: 'linkedin' | 'github' | 'portfolio' | 'url';
  placeholder?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  readOnly?: boolean;
  className?: string;
  id?: string;
  name?: string;
}

const PLATFORM_PREFIXES = {
  linkedin: 'linkedin.com/in/',
  github: 'github.com/',
  portfolio: 'https://',
  url: 'https://',
};

export default function UrlField({
  value,
  onChange,
  platform = 'url',
  placeholder = '',
  size = 'md',
  disabled = false,
  readOnly = false,
  className = '',
  id,
  name,
}: UrlFieldProps) {
  const prefix = PLATFORM_PREFIXES[platform] || 'https://';

  function getFullUrl(): string {
    if (!value) return '#';
    const val = value.trim();
    if (val.startsWith('http://') || val.startsWith('https://')) return val;
    
    const cleanPrefix = prefix.replace(/^https?:\/\//i, '');
    if (val.startsWith(cleanPrefix)) {
      return `https://${val}`;
    }
    return `https://${cleanPrefix}${val}`;
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    let inputVal = e.target.value;
    
    // Smart paste/typing normalization: strip prefix if user pastes full URL
    if (prefix && inputVal) {
      const trimmed = inputVal.trim();
      const cleanPrefix = prefix.replace(/^https?:\/\//i, '');
      
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const withoutProtocol = trimmed.replace(/^https?:\/\//i, '');
        if (withoutProtocol.toLowerCase().startsWith(cleanPrefix.toLowerCase())) {
          inputVal = withoutProtocol.slice(cleanPrefix.length);
        }
      } else if (trimmed.toLowerCase().startsWith(cleanPrefix.toLowerCase())) {
        inputVal = trimmed.slice(cleanPrefix.length);
      }
    }
    
    onChange(inputVal);
  }

  const hasValue = Boolean(value && value.trim().length > 0);
  const sizeClass = size === 'sm' ? 'url-field-sm' : '';

  return (
    <div className={`url-field-wrap ${sizeClass} ${className}`.trim()}>
      {prefix && <span className="url-prefix">{prefix}</span>}
      <input
        id={id}
        name={name}
        type="text"
        value={value || ''}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        onChange={handleInputChange}
        aria-label={placeholder || (prefix ? `${prefix} URL` : 'URL')}
      />
      <button
        type="button"
        className="url-open-btn"
        title={hasValue ? 'Open URL in new tab' : 'Enter a URL to open'}
        aria-label="Open URL in new tab"
        disabled={!hasValue || disabled}
        onClick={() => {
          if (hasValue && !disabled) {
            window.open(getFullUrl(), '_blank', 'noopener,noreferrer');
          }
        }}
      >
        <ExternalLink size={14} />
      </button>
    </div>
  );
}
