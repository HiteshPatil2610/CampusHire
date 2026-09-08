'use client';

const OPTIONS = ['Male', 'Female', 'Other', 'Prefer not to say'] as const;

export interface GenderToggleProps {
  value: string;
  onChange: (value: string) => void;
}

export default function GenderToggle({ value, onChange }: GenderToggleProps) {
  return (
    <div className="gender-toggle">
      {OPTIONS.map((opt) => (
        <button
          key={opt}
          type="button"
          className={`gender-btn ${value === opt ? 'active' : ''}`}
          onClick={() => onChange(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
