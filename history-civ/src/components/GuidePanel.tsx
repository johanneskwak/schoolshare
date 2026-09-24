import type { Guide } from '../lib/guide';
import type { RoomPlayer } from '../types/game';

/** 우측 패널 최상단: 지금 할 일(CTA) + 체크리스트 + 턴 종료 버튼 */
export function GuidePanel({
  guide,
  me,
  canAct,
  onFocus,
  onEndTurn,
  onCancelEndTurn,
}: {
  guide: Guide;
  me: RoomPlayer;
  canAct: boolean;
  onFocus: () => void;
  onEndTurn: () => void;
  onCancelEndTurn: () => void;
}) {
  const allDone = guide.checklist.filter((c) => c.id !== 'end').every((c) => c.done);
  return (
    <div className="space-y-3 rounded-lg border border-amber-500/60 bg-gradient-to-b from-amber-950/60 to-stone-800 p-3 shadow-lg">
      <div className="space-y-1">
        <div className="text-[11px] font-bold tracking-wider text-amber-400">지금 할 일</div>
        <div className="text-base font-bold leading-snug">{guide.title}</div>
        <p className="text-xs leading-relaxed text-stone-300">{guide.detail}</p>
        {guide.focus && canAct && (
          <button onClick={onFocus} className="mt-1 rounded bg-amber-500/90 px-3 py-1 text-xs font-bold text-stone-900">
            📍 바로 가기
          </button>
        )}
      </div>

      <ul className="space-y-1 text-sm">
        {guide.checklist.map((c) => (
          <li key={c.id} className={`flex items-center gap-2 ${c.done ? 'text-stone-500' : 'text-stone-100'}`}>
            <span className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${c.done ? 'border-emerald-500 bg-emerald-600 text-white' : 'border-stone-500'}`}>
              {c.done ? '✓' : ''}
            </span>
            <span className={c.done ? 'line-through' : ''}>{c.label}</span>
          </li>
        ))}
      </ul>

      {me.is_eliminated ? (
        <p className="text-center text-sm text-red-400">문명이 멸망했습니다. 관전 중…</p>
      ) : me.has_ended_turn ? (
        <button onClick={onCancelEndTurn} className="w-full rounded border border-stone-500 py-2 text-sm">
          턴 종료 취소
        </button>
      ) : (
        <button
          onClick={onEndTurn}
          disabled={!canAct}
          title="모든 문명의 명령이 동시에 실행됩니다 (단축키 E)"
          className={`w-full rounded py-2.5 text-base font-bold text-stone-900 disabled:opacity-50 ${allDone ? 'animate-pulse bg-amber-400' : 'bg-amber-500'}`}
        >
          턴 종료 <span className="text-xs font-normal">(E)</span>
        </button>
      )}
      <p className="text-center text-[11px] text-stone-500">단축키 · N 다음 유닛 · B 도시 건설 · Esc 선택 해제</p>
    </div>
  );
}
