import { useMemo } from 'react';
import {
  buildableImprovements,
  canFoundCity,
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
export function CommandPanel({ snapshot, me, canAct }: { snapshot: GameSnapshot; me: RoomPlayer; canAct: boolean }) {
  const selection = useGameStore((s) => s.selection);
  const pending = useGameStore((s) => s.pending);
  const queueAction = useGameStore((s) => s.queueAction);
  const cancelUnitAction = useGameStore((s) => s.cancelUnitAction);
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
    if (u) {
      const t = UNIT_TYPES[u.kind];
      const ordered = pending.some((a) => 'unit_id' in a && a.unit_id === u.id);
      body = (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-lg font-bold">
            <img src={`/sprites/unit_${u.kind}.png`} alt="" className="h-12 w-12 object-contain" />
            {t.name}
          </div>
          <div className="text-xs text-stone-300">
            공격 {t.attack} · 방어 {t.defense} · 이동 {u.moves_left}/{t.moves} · 사거리 {t.range} · 선제 {t.initiative} · HP {u.hp}
          </div>
          <p className="text-xs text-stone-400">노란 칸: 이동 · 빨간 칸: 공격</p>
          {u.kind === 'settler' && (
            <button
              disabled={!canAct || !canFoundCity(u, tileIndex)}
              onClick={() => queueAction({ type: 'found_city', unit_id: u.id })}
              title="개척자가 서 있는 칸에 새 도시를 세웁니다. 주변 1칸이 영토가 되고, 턴 종료 때 건설됩니다. (단축키 B)"
              className="w-full rounded bg-emerald-600 px-3 py-2.5 text-base font-bold shadow ring-2 ring-emerald-300/60 disabled:opacity-40 disabled:ring-0"
            >
              🏗️ 도시 건설 <span className="text-xs font-normal">(B)</span>
            </button>
          )}
          {u.kind === 'settler' && !canFoundCity(u, tileIndex) && (
            <p className="text-xs text-stone-400">다른 도시와 3칸 이상 떨어진 빈 땅이어야 해요.</p>
          )}
          {ordered && (
            <button onClick={() => cancelUnitAction(u.id)} className="w-full rounded border border-stone-500 px-3 py-1.5 text-sm">
              이 유닛 명령 취소
            </button>
          )}
        </div>
      );
    }
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
        <div className="mb-1 text-sm font-bold">이번 턴 명령 {pending.length}개</div>
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
