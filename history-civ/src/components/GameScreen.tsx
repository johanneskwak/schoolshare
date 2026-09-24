import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGameSync } from '../hooks/useGameSync';
import { usePresence } from '../hooks/usePresence';
import { useTurnTimer } from '../hooks/useTurnTimer';
import { api } from '../lib/api';
import { computeGuide, type Guide } from '../lib/guide';
import { LEADERS } from '../lib/leaders';
import { canFoundCity, indexTiles } from '../lib/rules';
import { formatClock } from '../lib/time';
import { useGameStore } from '../store/gameStore';
import { FACTIONS, TECHS, type LeaderId, type TechId } from '../types/game';
import { CommandPanel } from './CommandPanel';
import { EventModal } from './EventModal';
import { GameMap } from './GameMap';
import { GuidePanel } from './GuidePanel';
import { LeaderPanel } from './LeaderPanel';
import { ResultScreen } from './ResultScreen';
import { VictoryPanel } from './VictoryPanel';

const FLUSH_BEFORE_MS = 3000;

const EVENT_TEXT: Record<string, string> = {
  combat: '⚔️ 전투',
  unit_destroyed: '💀 유닛 격파',
  city_founded: '🏗️ 도시 건설',
  city_captured: '🏳️ 도시 점령',
  capital_captured: '👑 수도 함락!',
  unit_produced: '🔨 유닛 생산',
  tech_researched: '💡 연구 완료',
  leader_joined: '⭐ 역사적 인물 합류',
  historic_event: '📜 역사적 사건 발생',
  event_resolved: '📜 역사적 사건 결정',
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
  const selection = useGameStore((s) => s.selection);
  const queueAction = useGameStore((s) => s.queueAction);
  const select = useGameStore((s) => s.select);
  const researchRef = useRef<HTMLSelectElement>(null);
  const [eventHiddenId, setEventHiddenId] = useState<number | null>(null);

  // 마감 3초 전: 디바운스 중인 명령을 즉시 저장 (턴당 1회)
  const flushedTurn = useRef(0);
  const turn = snapshot?.room.turn_number ?? 0;
  useEffect(() => {
    if (left !== null && left <= FLUSH_BEFORE_MS && flushedTurn.current !== turn) {
      flushedTurn.current = turn;
      void flush();
    }
  }, [left, turn, flush]);

  const guide: Guide | null = useMemo(
    () => (snapshot && me ? computeGuide(snapshot, me, pending) : null),
    [snapshot, me, pending],
  );

  const focusGuide = useCallback(() => {
    const f = guide?.focus;
    if (!f) return;
    if (f.kind === 'research') researchRef.current?.focus();
    else if (f.kind === 'event') setEventHiddenId(null);
    else select(f);
  }, [guide, select]);

  // 단축키: E 턴 종료 · N 다음 대기 유닛 · B 도시 건설 · Esc 선택 해제
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (!snapshot || !me || !guide) return;
      const k = e.key.toLowerCase();
      if (k === 'escape') select(null);
      if (!canAct) return;
      if (k === 'e') void endTurn();
      if (k === 'n' && guide.idleUnitIds.length) {
        const cur = selection?.kind === 'unit' ? guide.idleUnitIds.indexOf(selection.id) : -1;
        select({ kind: 'unit', id: guide.idleUnitIds[(cur + 1) % guide.idleUnitIds.length]! });
      }
      if (k === 'b' && selection?.kind === 'unit') {
        const u = snapshot.units.find((x) => x.id === selection.id);
        if (u?.kind === 'settler' && canFoundCity(u, indexTiles(snapshot.tiles))) queueAction({ type: 'found_city', unit_id: u.id });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [snapshot, me, guide, canAct, selection, select, endTurn, queueAction]);

  if (!snapshot || !me || !guide) return <p className="p-8 text-stone-400">게임 상태를 불러오는 중…</p>;
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
  const event = snapshot.my_events.find((e) => e.pe_id !== eventHiddenId) ?? null;
  const stabilityColor = me.stability < 30 ? 'text-red-400' : me.stability >= 70 ? 'text-emerald-400' : '';
  const nameOf = (id: unknown) => players.find((p) => p.user_id === id)?.nickname ?? '';

  return (
    <div className="mx-auto max-w-[1500px] space-y-3 px-4 py-4">
      <header className="space-y-2 rounded-lg bg-stone-800 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="text-lg font-bold">
            턴 {room.turn_number}
            <span className="text-sm text-stone-400">/{room.max_turns}</span>
          </div>
          <div className={`font-mono text-2xl ${urgent ? 'animate-pulse text-red-400' : 'text-amber-400'}`}>{formatClock(left)}</div>
          <div className="text-sm text-stone-300">
            턴 종료 {endedCount}/{alive.length}
          </div>
          <div className="ml-auto flex flex-wrap gap-3 text-sm">
            <span title="골드">💰 {me.gold}</span>
            <span title="식량">🌾 {me.food}</span>
            <span title="망치(생산력)">🔨 {me.hammer}</span>
            <span title="혁신(턴당 연구)">💡 +{me.innovation}</span>
            <span title="혁명 이념 (200 이상 1위 → 문화 승리)">🕊️ {me.ideology}</span>
            <span title="안정도: 30 미만이면 폭동으로 골드 손실, 70 이상이면 이념 +1" className={stabilityColor}>
              ⚖️ {me.stability}
            </span>
            <span title="승점">⭐ {me.score}</span>
          </div>
        </div>
        <div className="h-1.5 overflow-hidden rounded bg-stone-700">
          <div className={`h-full transition-[width] duration-300 ${urgent ? 'bg-red-500' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} />
        </div>
      </header>

      <div className="grid gap-3 lg:grid-cols-[1fr_22rem]">
        <section className="min-w-0 space-y-2">
          <GameMap snapshot={snapshot} userId={userId} canAct={canAct} idleUnitIds={guide.idleUnitIds} />
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm">
              💡 연구{' '}
              <select
                ref={researchRef}
                disabled={!canAct}
                className={`rounded bg-stone-700 px-2 py-1 ${guide.focus?.kind === 'research' ? 'ring-2 ring-amber-400' : ''}`}
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
          <GuidePanel
            guide={guide}
            me={me}
            canAct={canAct}
            onFocus={focusGuide}
            onEndTurn={() => void endTurn()}
            onCancelEndTurn={() => void cancelEndTurn()}
          />

          <ul className="space-y-1 rounded-lg bg-stone-800 p-3">
            {players.map((p) => (
              <li key={p.user_id} className={`flex items-center gap-2 text-sm ${p.is_eliminated ? 'line-through opacity-50' : ''}`}>
                {p.is_ai ? (
                  <span title="AI">🤖</span>
                ) : (
                  <span className={`h-2 w-2 rounded-full ${online.has(p.user_id) ? 'bg-green-400' : 'bg-stone-500'}`} />
                )}
                <span style={{ color: FACTIONS[p.faction].color }}>{p.nickname}</span>
                <span className="text-xs text-stone-400">
                  ⭐{p.score} 🕊️{p.ideology} ⚖️{p.stability}
                </span>
                <span className="ml-auto">{p.has_ended_turn && !p.is_eliminated ? '✅' : '⏳'}</span>
              </li>
            ))}
          </ul>

          <CommandPanel snapshot={snapshot} me={me} canAct={canAct} />
          <LeaderPanel holders={snapshot.leaders} players={players} meId={userId} />
          <VictoryPanel room={room} players={players} />

          {snapshot.last_log && snapshot.last_log.length > 0 && (
            <div className="max-h-44 overflow-y-auto rounded-lg bg-stone-800 p-3 text-xs text-stone-300">
              <div className="mb-1 font-bold text-stone-100">지난 턴 결과</div>
              {snapshot.last_log
                .filter((e) => EVENT_TEXT[e.type])
                .map((e, i) => (
                  <div key={i}>
                    {EVENT_TEXT[e.type]}
                    {e.type === 'tech_researched' && ` (${TECHS[e.tech as TechId]?.name})`}
                    {e.type === 'leader_joined' && ` · ${LEADERS[e.leader as LeaderId]?.name} → ${nameOf(e.player)}`}
                    {(e.type === 'historic_event' || e.type === 'event_resolved') && ` · ${nameOf(e.player)}`}
                  </div>
                ))}
            </div>
          )}
        </aside>
      </div>

      {event && canAct && (
        <EventModal
          key={event.pe_id}
          event={event}
          onChoose={async (choice) => {
            await api.chooseEvent(roomId, event.pe_id, choice);
            await refetch();
          }}
          onLater={() => setEventHiddenId(event.pe_id)}
        />
      )}
    </div>
  );
}
