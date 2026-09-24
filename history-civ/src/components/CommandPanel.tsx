import { useMemo } from 'react';
import {
  buildableImprovements,
  IMPROVEMENTS,
  indexTiles,
  key,
  producibleUnits,
  TERRAIN,
  UNIT_TYPES,
} from '../lib/rules';
import { useGameStore } from '../store/gameStore';
import { leadersOf, unitCost } from '../lib/leaders';
import type { Action, GameSnapshot, RoomPlayer } from '../types/game';
import type { UnitActions } from '../hooks/useUnitActions';
import { UnitDetailPanel } from './UnitDetailPanel';

function describe(a: Action, snapshot: GameSnapshot): string {
  const unit = 'unit_id' in a ? snapshot.units.find((u) => u.id === a.unit_id) : undefined;
  const uname = unit ? UNIT_TYPES[unit.kind].name : '유닛';
  switch (a.type) {
    case 'move':
      return `${uname} → (${a.x},${a.y})`;
    case 'found_city':
      return `${uname} 도시 건설`;
    case 'produce':
      return `(${a.x},${a.y}) ${UNIT_TYPES[a.unit_kind].name} 생산`;
    case 'build':
      return `(${a.x},${a.y}) ${IMPROVEMENTS[a.improvement].name} 건설`;
    case 'research':
      return `연구 변경`;
    case 'spread':
      return '이념 전파 (골드 10)';
  }
}

/** 선택한 유닛/칸에 따라 가능한 명령을 보여 주고, 이번 턴 명령 목록을 관리한다. */
export function CommandPanel({
  snapshot,
  me,
  canAct,
  actions,
}: {
  snapshot: GameSnapshot;
  me: RoomPlayer;
  canAct: boolean;
  actions: UnitActions;
}) {
  const selection = useGameStore((s) => s.selection);
  const pending = useGameStore((s) => s.pending);
  const queueAction = useGameStore((s) => s.queueAction);
  const removeActionAt = useGameStore((s) => s.removeActionAt);
  const tileIndex = useMemo(() => indexTiles(snapshot.tiles), [snapshot.tiles]);
  const myUnits = useMemo(() => snapshot.units.filter((u) => u.owner_id === me.user_id), [snapshot.units, me.user_id]);
  const myLeaders = useMemo(() => leadersOf(snapshot.leaders, me.user_id), [snapshot.leaders, me.user_id]);

  // 이번 턴에 이미 예약한 망치/골드 (서버는 처리 순서대로 차감하므로 초과분은 무시됨)
  const hammerReserved = pending.reduce((s, a) => s + (a.type === 'produce' ? unitCost(a.unit_kind, myLeaders) : 0), 0);
  const goldReserved = pending.reduce(
    (s, a) => s + (a.type === 'build' ? IMPROVEMENTS[a.improvement].cost : a.type === 'spread' ? 10 : 0),
    0,
  );

  let body: React.ReactNode = <p className="text-stone-400">맵에서 유닛이나 칸을 선택하세요.</p>;

  if (selection?.kind === 'unit') {
    const u = snapshot.units.find((x) => x.id === selection.id);
    if (u) body = <UnitDetailPanel unit={u} snapshot={snapshot} me={me} actions={actions} canAct={canAct} />;
  } else if (selection?.kind === 'tile') {
    const tile = tileIndex.get(key(selection.x, selection.y));
    if (tile) {
      const owner = snapshot.players.find((p) => p.user_id === tile.owner_id);
      const mine = tile.owner_id === me.user_id;
      const builds = mine ? buildableImprovements(tile, me, tileIndex) : [];
      const produceOrder = pending.find((a) => a.type === 'produce' && a.x === tile.x && a.y === tile.y);
      body = (
        <div className="space-y-2">
          <div className="font-bold">
            {tile.is_city ? `${tile.is_capital ? '★ ' : ''}${tile.city_name} (인구 ${tile.city_pop})` : TERRAIN[tile.terrain].name}
            <span className="ml-2 text-xs font-normal text-stone-400">
              ({tile.x},{tile.y}) {owner ? `· ${owner.nickname}` : '· 무주지'}
            </span>
          </div>
          <div className="text-xs text-stone-300">
            {TERRAIN[tile.terrain].yields}
            {tile.improvement && ` · ${IMPROVEMENTS[tile.improvement].name}`}
          </div>

          {mine && tile.is_city && (
            <div className="space-y-1">
              <div className="text-sm font-bold">생산 (🔨 {me.hammer - hammerReserved} 남음)</div>
              <div className="grid grid-cols-2 gap-1">
                {producibleUnits(me, myUnits, myLeaders).map((k) => {
                  const ut = UNIT_TYPES[k];
                  const chosen = produceOrder?.type === 'produce' && produceOrder.unit_kind === k;
                  const cost = unitCost(k, myLeaders);
                  const afford = cost <= me.hammer - hammerReserved + (produceOrder?.type === 'produce' ? unitCost(produceOrder.unit_kind, myLeaders) : 0);
                  return (
                    <button
                      key={k}
                      disabled={!canAct || !afford}
                      onClick={() => queueAction({ type: 'produce', x: tile.x, y: tile.y, unit_kind: k })}
                      className={`rounded px-2 py-1 text-left text-xs disabled:opacity-40 ${chosen ? 'bg-amber-600' : 'bg-stone-700 hover:bg-stone-600'}`}
                    >
                      <img src={`/sprites/unit_${k}.png`} alt="" className="mr-1 inline h-5 w-5 object-contain" />
                      {ut.name} <span className="text-stone-300">🔨{cost}{cost < ut.cost && <s className="ml-1 text-stone-500">{ut.cost}</s>}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {builds.length > 0 && (
            <div className="space-y-1">
              <div className="text-sm font-bold">시설 (💰 {me.gold - goldReserved} 남음)</div>
              {builds.map((i) => (
                <button
                  key={i}
                  disabled={!canAct || IMPROVEMENTS[i].cost > me.gold - goldReserved}
                  onClick={() => queueAction({ type: 'build', x: tile.x, y: tile.y, improvement: i })}
                  className="block w-full rounded bg-stone-700 px-2 py-1 text-left text-xs hover:bg-stone-600 disabled:opacity-40"
                >
                  {IMPROVEMENTS[i].name} 💰{IMPROVEMENTS[i].cost} · {IMPROVEMENTS[i].desc}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-stone-800 p-3">{body}</div>

      <button
        disabled={!canAct || me.gold - goldReserved < 10}
        onClick={() => queueAction({ type: 'spread' })}
        className="w-full rounded bg-indigo-600 px-3 py-1.5 text-sm font-bold disabled:opacity-40"
      >
        🕊️ 혁명 이념 전파 (골드 10 → 이념 +3)
      </button>

      <div className="rounded-lg bg-stone-800 p-3">
        <div className="mb-1 text-sm font-bold">턴 종료 때 처리할 명령 {pending.length}개</div>
        <p className="mb-1 text-[11px] text-stone-500">생산·연구·시설·이념 전파는 턴 종료 때 모든 문명이 함께 정산돼요.</p>
        {pending.length === 0 && <p className="text-xs text-stone-400">아직 없음</p>}
        <ul className="space-y-1">
          {pending.map((a, i) => (
            <li key={i} className="flex items-center gap-2 text-xs">
              <span className="flex-1">{describe(a, snapshot)}</span>
              {canAct && (
                <button onClick={() => removeActionAt(i)} className="text-stone-400 hover:text-red-400" aria-label="명령 삭제">
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
