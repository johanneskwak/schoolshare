import { useEffect, useRef } from 'react';
import { useGameSync } from '../hooks/useGameSync';
import { usePresence } from '../hooks/usePresence';
import { useTurnTimer } from '../hooks/useTurnTimer';
import { formatClock } from '../lib/time';
import { useGameStore } from '../store/gameStore';
import { FACTIONS, TECHS, type TechId } from '../types/game';
import { GameMap } from './GameMap';
import { CommandPanel } from './CommandPanel';
import { ResultScreen } from './ResultScreen';
import { VictoryPanel } from './VictoryPanel';

const FLUSH_BEFORE_MS = 3000;

const EVENT_TEXT: Record<string, string> = {
  combat: '⚔️ 전투',
  unit_destroyed: '💀 유닛 격파',
  move: '👣 이동',
  city_founded: '🏗️ 도시 건설',
  city_captured: '🏳️ 도시 점령',
  capital_captured: '👑 수도 함락!',
  unit_produced: '🔨 유닛 생산',
  tech_researched: '💡 연구 완료',
};

export function GameScreen({
  roomId,
  userId,
  onExit,
  onLeaderboard,
}: {
  roomId: string;
  userId: string;
  onExit: () => void;
  onLeaderboard: () => void;
}) {
  const { snapshot, me, canAct, refetch, flush, endTurn, cancelEndTurn, syncError } = useGameSync(roomId, userId);
  const left = useTurnTimer(roomId, () => void refetch());
  const online = usePresence(roomId, userId);
  const pending = useGameStore((s) => s.pending);
  const queueAction = useGameStore((s) => s.queueAction);

  // 마감 3초 전: 디바운스 중인 명령을 즉시 저장 (턴당 1회)
  const flushedTurn = useRef(0);
  const turn = snapshot?.room.turn_number ?? 0;
  useEffect(() => {
    if (left !== null && left <= FLUSH_BEFORE_MS && flushedTurn.current !== turn) {
      flushedTurn.current = turn;
      void flush();
    }
  }, [left, turn, flush]);

  if (!snapshot || !me) return <p className="p-8 text-stone-400">게임 상태를 불러오는 중…</p>;
  const { room, players } = snapshot;

  if (room.status === 'finished')
    return <ResultScreen snapshot={snapshot} userId={userId} onLeaderboard={onLeaderboard} onExit={onExit} />;

  const researchable = (Object.keys(TECHS) as TechId[]).filter((t) => {
    const prereq = TECHS[t].prereq;
    return !me.researched.includes(t) && (prereq === null || me.researched.includes(prereq));
  });
  const researchAction = pending.find((a) => a.type === 'research');
  const alive = players.filter((p) => !p.is_eliminated);
  const endedCount = alive.filter((p) => p.has_ended_turn).length;
  const pct = left === null ? 0 : Math.min(100, (left / (room.turn_seconds * 1000)) * 100);
  const urgent = left !== null && left < 10_000;

  return (
    <div className="mx-auto max-w-7xl space-y-3 px-4 py-4">
      <header className="space-y-2 rounded-lg bg-stone-800 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="text-lg font-bold">
            턴 {room.turn_number}<span className="text-sm text-stone-400">/{room.max_turns}</span>
          </div>
          <div className={`font-mono text-2xl ${urgent ? 'animate-pulse text-red-400' : 'text-amber-400'}`}>
            {formatClock(left)}
          </div>
          <div className="text-sm text-stone-300">
            턴 종료 {endedCount}/{alive.length}
          </div>
          <div className="ml-auto flex flex-wrap gap-3 text-sm">
            <span title="골드">💰 {me.gold}</span>
            <span title="식량">🌾 {me.food}</span>
            <span title="망치">🔨 {me.hammer}</span>
            <span title="혁신(턴당)">💡 +{me.innovation}</span>
            <span title="혁명 이념 (100 이상 1위 → 문화 승리)">🕊️ {me.ideology}</span>
            <span title="승점">⭐ {me.score}</span>
          </div>
        </div>
        <div className="h-1.5 overflow-hidden rounded bg-stone-700">
          <div
            className={`h-full transition-[width] duration-300 ${urgent ? 'bg-red-500' : 'bg-amber-400'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </header>

      <div className="grid gap-3 lg:grid-cols-[1fr_20rem]">
        <section className="space-y-2">
          <GameMap snapshot={snapshot} userId={userId} canAct={canAct} />
          <div className="flex flex-wrap items-center gap-3">
            {me.is_eliminated ? (
              <p className="text-red-400">문명이 멸망했습니다. 관전 중…</p>
            ) : me.has_ended_turn ? (
              <button onClick={() => void cancelEndTurn()} className="rounded border border-stone-500 px-6 py-2">
                턴 종료 취소 (다른 플레이어 대기 중)
              </button>
            ) : (
              <button onClick={() => void endTurn()} className="rounded bg-amber-500 px-6 py-2 font-bold text-stone-900">
                턴 종료 ({pending.length}개 명령)
              </button>
            )}
            <label className="text-sm">
              💡 연구{' '}
              <select
                disabled={!canAct}
                className="rounded bg-stone-700 px-2 py-1"
                value={researchAction?.type === 'research' ? researchAction.tech : (me.research_target ?? '')}
                onChange={(e) => queueAction({ type: 'research', tech: e.target.value as TechId })}
              >
                <option value="" disabled>
                  선택
                </option>
                {researchable.map((t) => (
                  <option key={t} value={t}>
                    {TECHS[t].name} ({TECHS[t].cost})
                  </option>
                ))}
              </select>
              {me.research_target && (
                <span className="ml-2 text-stone-400">
                  {TECHS[me.research_target].name} {me.research_progress}/{TECHS[me.research_target].cost}
                </span>
              )}
            </label>
            {me.researched.length > 0 && (
              <span className="text-xs text-stone-400">완료: {me.researched.map((t) => TECHS[t].name).join(', ')}</span>
            )}
          </div>
          {syncError && <p className="text-sm text-red-400">{syncError}</p>}
        </section>

        <aside className="space-y-3">
          <ul className="space-y-1 rounded-lg bg-stone-800 p-3">
            {players.map((p) => (
              <li key={p.user_id} className={`flex items-center gap-2 text-sm ${p.is_eliminated ? 'line-through opacity-50' : ''}`}>
                <span className={`h-2 w-2 rounded-full ${online.has(p.user_id) ? 'bg-green-400' : 'bg-stone-500'}`} />
                <span style={{ color: FACTIONS[p.faction].color }}>{p.nickname}</span>
                <span className="text-xs text-stone-400">⭐{p.score} 🕊️{p.ideology}</span>
                <span className="ml-auto">{p.has_ended_turn && !p.is_eliminated ? '✅' : '⏳'}</span>
              </li>
            ))}
          </ul>

          <CommandPanel snapshot={snapshot} me={me} canAct={canAct} />

          <VictoryPanel room={room} players={players} />

          {snapshot.last_log && snapshot.last_log.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-lg bg-stone-800 p-3 text-xs text-stone-300">
              <div className="mb-1 font-bold text-stone-100">지난 턴 결과</div>
              {snapshot.last_log
                .filter((e) => e.type !== 'move')
                .map((e, i) => (
                  <div key={i}>{EVENT_TEXT[e.type] ?? e.type}{e.type === 'tech_researched' ? ` (${TECHS[e.tech as TechId]?.name})` : ''}</div>
                ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
