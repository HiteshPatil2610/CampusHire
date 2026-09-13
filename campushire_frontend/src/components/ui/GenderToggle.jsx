const OPTIONS = ['Male', 'Female', 'Other'];

export default function GenderToggle({ value, onChange }) {
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
