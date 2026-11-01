import { CalendarCheck, Check, Camera } from 'lucide-react';
import ProblemText from '../components/ProblemText.jsx';
import { EmptyState } from '../components/ui.jsx';
import { formatKo } from '../lib/schedule.js';

export default function Home({ state, todayStr, onToggle, onOpen, onScan }) {
  const byId = Object.fromEntries(state.problems.map((p) => [p.id, p]));
  const due = state.reviews.filter((r) => r.dueDate <= todayStr && !r.done && byId[r.problemId]);
  const doneToday = state.reviews.filter((r) => r.dueDate <= todayStr && r.done).length;
  const total = due.length + doneToday;

  return (
    <div className="space-y-4">
      <section className="card bg-coral-soft/60">
        <p className="text-sm text-mute">{formatKo(todayStr)}</p>
        <h1 className="mt-1 font-serif text-2xl">오늘의 복습</h1>
        <p className="mt-2 text-sm">
          {total === 0 ? '오늘 예정된 복습이 없어요.' : <><b className="text-coral">{due.length}개</b> 남음 · {doneToday}개 완료</>}
        </p>
        {total > 0 && (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/70" role="progressbar" aria-valuenow={doneToday} aria-valuemax={total}>
            <div className="h-full rounded-full bg-coral" style={{ width: `${(doneToday / total) * 100}%` }} />
          </div>
        )}
      </section>

      {state.problems.length === 0 ? (
        <EmptyState
          icon={Camera} title="등록된 문제가 없어요"
          hint="틀린 문제를 사진으로 찍으면 유사 문제와 복습 일정이 만들어져요."
          action={<button className="btn-primary mt-2" onClick={onScan}>첫 문제 스캔하기</button>}
        />
      ) : due.length === 0 ? (
        <EmptyState icon={CalendarCheck} title="플래너 일정이 없어요" hint="문제를 푼 뒤 '복습 일정 등록'을 누르면 1·3·7일 뒤 복습이 잡혀요." />
      ) : (
        <ul className="space-y-2">
          {due.map((r) => {
            const p = byId[r.problemId];
            const overdue = r.dueDate < todayStr;
            return (
              <li key={r.id} className="card flex items-center gap-3">
                <button onClick={() => onToggle(r.id)} aria-label={`${r.round}차 복습 완료 체크`} className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line hover:border-coral">
                  <Check size={14} className="text-transparent hover:text-coral" />
                </button>
                <button onClick={() => onOpen(p.id)} className="min-w-0 flex-1 text-left">
                  <p className="line-clamp-2 text-sm leading-6"><ProblemText text={p.latex} /></p>
                  <p className="mt-1 text-xs text-mute">{p.topic} · {r.round}차 복습{overdue && <span className="ml-1 text-bad">· 기한 지남</span>}</p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
