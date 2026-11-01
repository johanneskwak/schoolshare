import { BookOpen, Trash2 } from 'lucide-react';
import ProblemText from '../components/ProblemText.jsx';
import { EmptyState } from '../components/ui.jsx';

export default function Records({ state, onOpen, onDelete }) {
  return (
    <div className="space-y-4">
      <h1 className="font-serif text-2xl">풀이 기록</h1>
      {state.problems.length === 0 ? (
        <EmptyState icon={BookOpen} title="등록된 문제가 없어요" hint="스캔한 문제와 풀이 결과가 여기에 쌓여요." />
      ) : (
        <ul className="space-y-2">
          {state.problems.map((p) => {
            const a = state.attempts.filter((x) => x.problemId === p.id);
            const right = a.filter((x) => x.correct).length;
            return (
              <li key={p.id} className="card flex items-center gap-3">
                <button onClick={() => onOpen(p.id)} className="min-w-0 flex-1 text-left">
                  <p className="line-clamp-2 text-sm leading-6"><ProblemText text={p.latex} /></p>
                  <p className="mt-1 text-xs text-mute">{p.topic} · 정답 {right}/{a.length || 0} · {new Date(p.createdAt).toLocaleDateString('ko-KR')}</p>
                </button>
                <button aria-label="문제 삭제" className="rounded-full p-2 text-mute hover:bg-sand hover:text-bad"
                  onClick={() => window.confirm('이 문제와 풀이 기록, 복습 일정을 삭제할까요?') && onDelete(p.id)}>
                  <Trash2 size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
