import { CalendarDays, Check } from 'lucide-react';
import ProblemText from '../components/ProblemText.jsx';
import { EmptyState } from '../components/ui.jsx';
import { formatKo } from '../lib/schedule.js';
import { reviewsByDate } from '../lib/store.js';

export default function Planner({ state, todayStr, onToggle, onOpen }) {
  const byId = Object.fromEntries(state.problems.map((p) => [p.id, p]));
  const groups = reviewsByDate(state);
  return (
    <div className="space-y-4">
      <h1 className="font-serif text-2xl">플래너</h1>
      {groups.length === 0 ? (
        <EmptyState icon={CalendarDays} title="플래너 일정이 없어요" hint="문제 풀이 화면에서 '복습 일정 등록'을 눌러 보세요." />
      ) : groups.map(([date, items]) => (
        <section key={date}>
          <h2 className={`mb-2 text-sm ${date < todayStr ? 'text-bad' : date === todayStr ? 'text-coral' : 'text-mute'}`}>
            {date === todayStr ? '오늘 · ' : ''}{formatKo(date)}
          </h2>
          <ul className="space-y-2">
            {items.map((r) => {
              const p = byId[r.problemId];
              if (!p) return null;
              return (
                <li key={r.id} className="card flex items-center gap-3">
                  <button onClick={() => onToggle(r.id)} aria-pressed={r.done} aria-label={`${r.round}차 복습 ${r.done ? '완료 취소' : '완료'}`}
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border ${r.done ? 'border-coral bg-coral text-white' : 'border-line'}`}>
                    {r.done && <Check size={14} />}
                  </button>
                  <button onClick={() => onOpen(p.id)} className={`min-w-0 flex-1 text-left ${r.done ? 'opacity-50' : ''}`}>
                    <p className="line-clamp-2 text-sm leading-6"><ProblemText text={p.latex} /></p>
                    <p className="mt-1 text-xs text-mute">{p.topic} · {r.round}차 복습</p>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
