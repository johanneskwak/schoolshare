import { useEffect, useMemo, useState } from 'react';
import { GLOSSARY, type ConceptId } from '../lib/glossary';
import type { GameSnapshot, RoomPlayer } from '../types/game';

const SEEN_KEY = 'history-civ:seen-concepts';

function readSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}
function writeSeen(seen: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch {
    /* 저장 불가 환경은 무시 */
  }
}

/** 지금 상황에서 "처음 열린" 개념들 (우선순위 순) */
export function unlockedConcepts(s: GameSnapshot, me: RoomPlayer): ConceptId[] {
  const out: ConceptId[] = ['turn'];
  if (s.units.some((u) => u.owner_id === me.user_id && u.kind !== 'settler')) out.push('combat');
  if (me.ideology > 0) out.push('ideology');
  if (me.researched.length > 0 || me.research_target) out.push('innovation', 'science_victory');
  if (me.stability !== 60) out.push('stability');
  if (s.leaders.some((l) => l.player_id === me.user_id)) out.push('leaders');
  if (s.my_events.length > 0) out.push('events');
  if (me.ideology >= 30) out.push('culture_victory');
  if (me.researched.includes('enlightenment') || s.scholars.some((x) => x.player_id === me.user_id)) out.push('scholars');
  if (me.researched.includes('steam_engine') || s.wonders.length > 0) out.push('wonder_victory');
  return out;
}

/** 새 개념이 처음 열리면 왼쪽 아래에 1~2줄 요약 카드를 띄운다. 한 번 닫으면 다시 안 나온다. */
export function ConceptHint({ snapshot, me }: { snapshot: GameSnapshot; me: RoomPlayer }) {
  const [seen, setSeen] = useState(readSeen);
  const next = useMemo(
    () => unlockedConcepts(snapshot, me).find((c) => !seen.has(c)) ?? null,
    [snapshot, me, seen],
  );

  // 12초 뒤 자동으로 넘어간다
  useEffect(() => {
    if (!next) return;
    const t = setTimeout(() => dismiss(next), 12_000);
    return () => clearTimeout(t);
  }, [next]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = (id: ConceptId) => {
    const s = new Set(seen);
    s.add(id);
    writeSeen(s);
    setSeen(s);
  };

  if (!next) return null;
  const c = GLOSSARY[next];
  return (
    <div className="fixed bottom-4 left-4 z-40 w-80 rounded-xl border border-sky-500/70 bg-stone-900/95 p-3 shadow-2xl" role="status">
      <div className="flex items-start gap-2">
        <div className="text-2xl">{c.icon}</div>
        <div className="flex-1">
          <div className="text-[11px] font-bold tracking-wider text-sky-400">처음 보는 개념</div>
          <div className="font-bold">{c.title}</div>
          <p className="mt-0.5 text-sm text-stone-300">{c.intro}</p>
          <p className="mt-1 text-[11px] text-stone-500">자원 이름에 마우스를 올리면 자세한 설명을 볼 수 있어요.</p>
        </div>
        <button onClick={() => dismiss(next)} className="text-stone-400 hover:text-white" aria-label="닫기">
          ✕
        </button>
      </div>
    </div>
  );
}
