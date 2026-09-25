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
import { TECHS, type Action, type GameSnapshot, type RoomPlayer } from '../types/game';
import { cycleCity, myCitiesOrdered, turnsLeft, WONDER_BUILD_TURNS, WONDER_DEFENSE_TURNS, wonderOptions, wonderRate } from '../lib/civ';
import { BUILDINGS, buildingUnlocked, PERSONS } from '../lib/chronicle';
import type { BuildingId } from '../types/game';
import { InfoTooltip } from './InfoTooltip';
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
  const select = useGameStore((s) => s.select);
  const myCityCount = useMemo(() => myCitiesOrdered(snapshot.tiles, me.user_id).length, [snapshot.tiles, me.user_id]);
  const removeActionAt = useGameStore((s) => s.removeActionAt);
  const tileIndex = useMemo(() => indexTiles(snapshot.tiles), [snapshot.tiles]);
  const myUnits = useMemo(() => snapshot.units.filter((u) => u.owner_id === me.user_id), [snapshot.units, me.user_id]);
  const myLeaders = useMemo(() => leadersOf(snapshot.leaders, me.user_id), [snapshot.leaders, me.user_id]);

  // 이번 턴에 이미 예약한 망치/골드 (서버는 처리 순서대로 차감하므로 초과분은 무시됨)
  const hammerReserved = pending.reduce((s, a) => s + (a.type === 'produce' ? unitCost(a.unit_kind, myLeaders, me.faction) : 0), 0);
  const goldReserved = pending.reduce(
    (s, a) => s + (a.type === 'build' ? IMPROVEMENTS[a.improvement].cost : a.type === 'spread' ? 10 : 0),
    0,
  );

  let body: React.ReactNode = <p className="text-stone-400">맵에서 유닛이나 칸을 선택하세요.</p>;

  if (selection?.kind === 'unit') {
    const u = snapshot.units.find((x) => x.id === selection.id);
    if (u) body = <UnitDetailPanel unit={u} snapshot={snapshot} me={me} actions={actions} canAct={canAct} showActions={false} />;
  } else if (selection?.kind === 'tile') {
    const tile = tileIndex.get(key(selection.x, selection.y));
    if (tile) {
      const owner = snapshot.players.find((p) => p.user_id === tile.owner_id);
      const mine = tile.owner_id === me.user_id;
      const builds = mine ? buildableImprovements(tile, me, tileIndex) : [];
      const cityArrow = (dir: 1 | -1) => (
        <button
          onClick={() => {
            const c = cycleCity(snapshot.tiles, me.user_id, tile, dir);
            if (c) select({ kind: 'tile', x: c.x, y: c.y });
          }}
          title={dir < 0 ? '이전 도시 ([ 키)' : '다음 도시 (] 키)'}
          aria-label={dir < 0 ? '이전 도시' : '다음 도시'}
          className="mx-1 h-6 w-6 rounded border border-amber-700 bg-stone-900 align-middle text-amber-300 hover:bg-amber-900"
        >
          {dir < 0 ? '‹' : '›'}
        </button>
      );
      const produceOrder = pending.find((a) => a.type === 'produce' && a.x === tile.x && a.y === tile.y);
      body = (
        <div className="space-y-2">
          <div className="font-bold">
            {mine && tile.is_city && myCityCount > 1 && cityArrow(-1)}
            {tile.is_city ? `${tile.is_capital ? '★ ' : ''}${tile.city_name} (인구 ${tile.city_pop} · 🏰 ${tile.city_hp ?? 100}/100)` : TERRAIN[tile.terrain].name}
            {mine && tile.is_city && myCityCount > 1 && cityArrow(1)}
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
                  const cost = unitCost(k, myLeaders, me.faction);
                  const afford = cost <= me.hammer - hammerReserved + (produceOrder?.type === 'produce' ? unitCost(produceOrder.unit_kind, myLeaders, me.faction) : 0);
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

          {tile.is_city && (() => {
            const built = new Set((snapshot.buildings ?? []).filter((b) => b.x === tile.x && b.y === tile.y).map((b) => b.building_id));
            const myPersons = new Set(snapshot.scholars.filter((p) => p.player_id === me.user_id).map((p) => p.id));
            if (!mine) {
              return built.size ? (
                <div className="text-xs text-stone-300">건물: {[...built].map((b) => `${BUILDINGS[b].icon} ${BUILDINGS[b].name}`).join(' · ')}</div>
              ) : null;
            }
            const ids = Object.keys(BUILDINGS) as BuildingId[];
            const open = ids.filter((b) => built.has(b) || buildingUnlocked(b, me, myPersons));
            const next = ids.find((b) => {
              const f = PERSONS.find((p) => p.id === BUILDINGS[b].person)?.factions;
              return !open.includes(b) && (!f || f.includes(me.faction));
            });
            return (
              <div className="space-y-1">
                <div className="text-sm font-bold">
                  <InfoTooltip concept="scholars">🏛️ 도시 건물 (즉시 완공 · 💰 {me.gold})</InfoTooltip>
                </div>
                {open.map((b) => {
                  const def = BUILDINGS[b];
                  const done = built.has(b);
                  return (
                    <button
                      key={b}
                      disabled={!canAct || done || actions.busy || me.gold < def.cost}
                      onClick={() => void actions.buildBuilding(tile.x, tile.y, b)}
                      className={`block w-full rounded px-2 py-1 text-left text-xs disabled:opacity-60 ${done ? 'bg-emerald-950/60 text-emerald-200' : 'bg-stone-700 hover:bg-stone-600'}`}
                    >
                      <span className="font-bold">{def.icon} {def.name}</span> {done ? '✓ 완공' : `💰${def.cost}`}
                      <span className="block text-stone-400">{def.desc}</span>
                    </button>
                  );
                })}
                {next && (
                  <p className="text-[11px] text-stone-500">
                    다음 해금: {BUILDINGS[next].icon} {BUILDINGS[next].name} —{' '}
                    {PERSONS.find((p) => p.id === BUILDINGS[next].person)?.name ?? ''}
                    {BUILDINGS[next].tech ? ` 또는 ${TECHS[BUILDINGS[next].tech!].name}` : ''} 필요
                  </p>
                )}
              </div>
            );
          })()}

          {tile.is_city && (() => {
            const here = snapshot.wonders.find((w) => w.x === tile.x && w.y === tile.y);
            if (here) {
              return (
                <div className="rounded border border-amber-600/60 bg-amber-950/40 p-2 text-xs">
                  <div className="font-bold text-amber-300">
                    {here.icon} {here.name_ko}
                  </div>
                  <div className="text-stone-300">
                    {here.turns_left > 0 ? `사수까지 ${here.turns_left}턴 남음 — 점령당하면 점령자에게 넘어가요.` : '방어 완료!'}
                  </div>
                </div>
              );
            }
            const projects = snapshot.wonder_projects ?? [];
            const project = projects.find((p) => p.x === tile.x && p.y === tile.y);
            if (project) {
              const left = turnsLeft(project);
              const pct = Math.min(100, (project.progress / project.cost) * 100);
              return (
                <div className="space-y-1 rounded border border-amber-600/60 bg-amber-950/30 p-2 text-xs">
                  <div className="font-bold text-amber-300">
                    🏗️ {project.icon} {project.name_ko} 건설 중 — 남은 턴: {left}턴
                  </div>
                  <div className="h-2 overflow-hidden rounded bg-stone-800">
                    <div className="h-full bg-amber-500 transition-[width]" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-stone-300">
                    🔨 {project.progress}/{project.cost} · 매 턴 +{project.rate} (문명 생산 ÷ 도시 수)
                  </div>
                  <div className="text-stone-400">완공 후 이 도시를 {WONDER_DEFENSE_TURNS}턴 지키면 불가사의 승리. 공사 중 도시를 빼앗기면 공사가 사라져요.</div>
                  {mine && (
                    <button
                      disabled={!canAct || actions.busy}
                      onClick={() => {
                        if (window.confirm('공사를 취소할까요? 투입한 망치는 돌려받지 못해요.')) void actions.cancelWonder(tile.x, tile.y);
                      }}
                      className="rounded border border-stone-600 px-2 py-0.5 text-stone-300 hover:bg-stone-800 disabled:opacity-40"
                    >
                      공사 취소
                    </button>
                  )}
                </div>
              );
            }
            if (!mine) return null;
            const cityCount = myCityCount || 1;
            const hasEinstein = snapshot.scholars.some((p) => p.player_id === me.user_id && p.id === 'einstein');
            return (
              <div className="space-y-1">
                <div className="text-sm font-bold">
                  <InfoTooltip concept="wonder_victory">🏛️ 불가사의 (약 {WONDER_BUILD_TURNS}턴 공사)</InfoTooltip>
                </div>
                {wonderOptions(me, tile, snapshot.wonders, projects).map((o) => (
                  <button
                    key={o.id}
                    disabled={!canAct || !o.ok || actions.busy}
                    onClick={() => void actions.buildWonder(tile.x, tile.y, o.id)}
                    title={o.def.desc}
                    className="block w-full rounded border border-amber-700/60 bg-stone-900 px-2 py-1.5 text-left text-xs hover:bg-amber-950 disabled:opacity-40"
                  >
                    <span className="font-bold">
                      {o.def.icon} {o.def.name}
                    </span>{' '}
                    🔨{o.def.hammer} · 공사 시작 (지금 속도면 약{' '}
                    {turnsLeft({ progress: 0, cost: o.def.hammer, rate: wonderRate(me, cityCount, o.id, hasEinstein) })}턴)
                    {o.def.tech && ` · ${TECHS[o.def.tech].name}`}
                    {!o.ok && <span className="block text-stone-400">({o.reason})</span>}
                  </button>
                ))}
                <p className="text-[11px] text-stone-500">매 턴 이 도시의 생산이 들어가 완공되면, 그 뒤 {WONDER_DEFENSE_TURNS}턴 동안 지켜야 불가사의 승리!</p>
              </div>
            );
          })()}

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
