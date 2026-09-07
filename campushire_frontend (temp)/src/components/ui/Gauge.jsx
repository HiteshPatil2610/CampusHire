// Circular readiness gauge — ui-context.md §2.7
export default function Gauge({ score = 78, caption = 'Readiness' }) {
  return (
    <div className="gauge" style={{ '--pct': score }}>
      <div className="gauge-inner">
        <div className="gauge-score">{score}</div>
        <div className="gauge-caption">{caption}</div>
      </div>
    </div>
  );
}

