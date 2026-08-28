interface RadarItem {
  id: string;
  label: string;
  score: number | null;
}

const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = 104;

function point(index: number, count: number, ratio = 1) {
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / count;
  return `${CENTER + Math.cos(angle) * RADIUS * ratio},${CENTER + Math.sin(angle) * RADIUS * ratio}`;
}

function shortLabel(label: string) {
  return label.length > 8 ? `${label.slice(0, 8)}…` : label;
}

export function RatingRadar({ items }: { items: RadarItem[] }) {
  if (items.length !== 6) {
    return <p className="muted">레이더 그래프는 활성 평가 질문이 6개일 때 표시됩니다.</p>;
  }

  const valuePoints = items.map((item, index) => point(index, items.length, (item.score ?? 0) / 5)).join(" ");

  return (
    <figure className="rating-radar" aria-label="질문별 평균 별점 레이더 그래프">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img">
        {[1, 2, 3, 4, 5].map((level) => (
          <polygon key={level} points={items.map((_, i) => point(i, items.length, level / 5)).join(" ")} className="radar-grid" />
        ))}
        {items.map((_, i) => <line key={i} x1={CENTER} y1={CENTER} x2={point(i, items.length).split(",")[0]} y2={point(i, items.length).split(",")[1]} className="radar-axis" />)}
        <polygon points={valuePoints} className="radar-value" />
        {items.map((item, i) => {
          const [x, y] = point(i, items.length, 1.3).split(",").map(Number);
          return <text key={item.id} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="radar-label">{shortLabel(item.label)}</text>;
        })}
      </svg>
      <figcaption className="radar-legend">
        {items.map((item) => <span key={item.id}>{item.label}: <strong>{item.score == null ? "평가 없음" : item.score.toFixed(1)}</strong></span>)}
      </figcaption>
    </figure>
  );
}
