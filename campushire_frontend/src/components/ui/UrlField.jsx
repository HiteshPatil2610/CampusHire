// URL input with prefix label + open button — ui-context.md §5.5
export default function UrlField({
  prefix,
  value,
  onChange,
  placeholder = '',
  size = 'md',
  disabled = false,
  readOnly = false,
  className = '',
  id,
  name,
}) {
  function getFullUrl() {
    if (!value) return '#';
    const val = String(value).trim();
    if (val.startsWith('http://') || val.startsWith('https://')) return val;
    if (prefix) {
      const cleanPrefix = prefix.replace(/^https?:\/\//i, '');
      if (val.startsWith(cleanPrefix)) {
        return `https://${val}`;
      }
      return `https://${cleanPrefix}${val}`;
    }
    return `https://${val}`;
  }

  function handleInputChange(e) {
    let inputVal = e.target.value;
    // Smart paste/typing normalization: if user pastes full URL with prefix, strip prefix for clean display
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
    onChange?.(inputVal);
  }

  const hasValue = Boolean(value && String(value).trim().length > 0);
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
        ↗
      </button>
    </div>
  );
}

