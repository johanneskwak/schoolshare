import { useMemo } from 'react';
import type { UnitActions } from '../hooks/useUnitActions';
import { leadersOf } from '../lib/leaders';
import { canFoundCity, indexTiles, key, UNIT_TYPES, unitTargets } from '../lib/rules';
import { previewCombat } from '../lib/units';
import { useGameStore } from '../store/gameStore';
import type { GameSnapshot, Unit } from '../types/game';

/**
 * 선택한 유닛이 지금 할 수 있는 행동 (이동 후 행동 메뉴 · 명령 패널 공용).
 * 공격 모드에서는 사거리 안의 적과 예상 피해를 보여 준다.
 */
export function UnitActionButtons({
  unit,
  snapshot,
  actions,
  canAct,
  compact = false,
  inline = false,
}: {
  unit: Unit;
  snapshot: GameSnapshot;
  actions: UnitActions;
  canAct: boolean;
  compact?: boolean;
  /** 맵 아래 HUD용 가로 배치 */
  inline?: boolean;
}) {
  const unitMode = useGameStore((s) => s.unitMode);
  const setUnitMode = useGameStore((s) => s.setUnitMode);
  const tiles = useMemo(() => indexTiles(snapshot.tiles), [snapshot.tiles]);
  const t = UNIT_TYPES[unit.kind];
  const targets = useMemo(() => unitTargets(unit, tiles, snapshot.units), [unit, tiles, snapshot.units]);
  const enemies = snapshot.units.filter((e) => targets.attacks.has(key(e.x, e.y)));
  const myLeaders = leadersOf(snapshot.leaders, unit.owner_id);
  const moved = unit.moves_left < t.moves;
  const disabled = !canAct || unit.acted || actions.busy;

  if (unit.acted) return <p className="text-xs text-stone-400">✔ 이번 턴 행동 완료 — 다음 턴에 다시 움직일 수 있어요.</p>;

  const btn = `rounded px-2 ${compact ? 'py-1 text-xs' : 'py-1.5 text-sm'} font-bold disabled:opacity-40`;

  if (unitMode === 'attack') {
    return (
      <div className={inline ? 'flex flex-wrap items-center gap-1.5' : 'space-y-1.5'}>
        <div className="text-xs font-bold text-red-300">⚔️ 공격할 적을 고르세요 (맵의 빨간 칸도 가능)</div>
        {enemies.map((e) => {
          const p = previewCombat(unit, e, tiles.get(key(e.x, e.y))!, myLeaders);
          return (
            <button
              key={e.id}
              disabled={disabled}
              onClick={() => void actions.attack(unit, e.x, e.y)}
              className={`${inline ? '' : 'block w-full'} rounded border border-red-700 bg-red-950/60 px-2 py-1.5 text-left text-xs hover:bg-red-900 disabled:opacity-40`}
            >
              <span className="font-bold">{UNIT_TYPES[e.kind].name}</span> (HP {e.hp}) — 적 <b className="text-red-300">-{p.dmgDef}</b>
              {p.defenderDies && ' 💀격파'} / 아군 <b className="text-amber-300">-{p.dmgAtt}</b>
              {p.bonusNotes.length > 0 && <span className="block text-stone-400">{p.bonusNotes.join(' · ')}</span>}
            </button>
          );
        })}
        <button onClick={() => setUnitMode('menu')} className={`${btn} ${inline ? '' : 'w-full'} border border-stone-500 font-normal`}>
          ← 돌아가기
        </button>
      </div>
    );
  }

  const canBuild = unit.kind === 'settler' && canFoundCity(unit, tiles);
  return (
    <div className={inline ? 'flex flex-wrap gap-1.5' : 'grid grid-cols-2 gap-1.5'}>
      {t.attack > 0 && (
        <button
          disabled={disabled || enemies.length === 0}
          onClick={() => setUnitMode('attack')}
          title={enemies.length ? '사거리 안의 적을 공격합니다 (A)' : '사거리 안에 적이 없어요'}
          className={`${btn} bg-red-700 hover:bg-red-600`}
        >
          ⚔️ 공격 {enemies.length > 0 && `(${enemies.length})`}
        </button>
      )}
      {unit.kind === 'settler' && (
        <button
          disabled={disabled || !canBuild}
          onClick={() => void actions.foundCity(unit)}
          title={canBuild ? '지금 이 자리에 도시를 세웁니다 (B)' : '다른 도시와 3칸 이상 떨어진 빈 땅이어야 해요'}
          className={`${btn} ${inline ? '' : 'col-span-2 py-2 text-base'} bg-emerald-600 ring-2 ring-emerald-300/60 hover:bg-emerald-500 disabled:ring-0`}
        >
          🏗️ 도시 건설 (B)
        </button>
      )}
      {t.attack > 0 && (
        <button
          disabled={disabled}
          onClick={() => void actions.rest(unit, 'fortify')}
          title="제자리에서 방어 태세: 방어 +2 (움직이면 풀림) (F)"
          className={`${btn} bg-stone-600 hover:bg-stone-500`}
        >
          🛡️ 요새화 (F)
        </button>
      )}
      <button
        disabled={disabled || moved || unit.hp >= 100}
        onClick={() => void actions.rest(unit, 'heal')}
        title={moved ? '이번 턴에 움직이면 휴식할 수 없어요' : unit.hp >= 100 ? '체력이 가득해요' : '체력 회복: 우리 영토 +25, 그 외 +15 (H)'}
        className={`${btn} bg-teal-700 hover:bg-teal-600`}
      >
        💤 휴식·치유 (H)
      </button>
      <button
        disabled={disabled}
        onClick={() => void actions.rest(unit, 'wait')}
        title="이번 턴 행동을 마칩니다 (W)"
        className={`${btn} bg-stone-700 hover:bg-stone-600`}
      >
        ⏸ 대기 (W)
      </button>
    </div>
  );
}
