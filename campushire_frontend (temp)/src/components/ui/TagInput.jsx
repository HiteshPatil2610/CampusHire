import { useState } from 'react';

// Tag chip input — ui-context.md §5.3. Controlled: tags + onChange(tags[])
export default function TagInput({ tags, onChange, placeholder = 'Type and press Enter…' }) {
  const [draft, setDraft] = useState('');

  function commit(val) {
    const v = (val !== undefined ? val : draft).trim().replace(/^,|,$/g, '');
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setDraft('');
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && !draft && tags.length) {
      onChange(tags.slice(0, -1));
    }
  }

  function handleChange(e) {
    const val = e.target.value;
    if (val.includes(',')) {
      const parts = val.split(',').map((p) => p.trim()).filter(Boolean);
      const newTags = [...tags];
      parts.forEach((p) => {
        if (!newTags.includes(p)) newTags.push(p);
      });
      onChange(newTags);
      setDraft('');
    } else {
      setDraft(val);
    }
  }

  return (
    <div className="tag-input-wrap">
      {tags.map((tag) => (
        <span className="tag" key={tag}>
          {tag}
          <button type="button" onClick={() => onChange(tags.filter((t) => t !== tag))}>
            ×
          </button>
        </span>
      ))}
      <input
        className="tag-input"
        value={draft}
        placeholder={placeholder}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => commit()}
      />
    </div>
  );
}
