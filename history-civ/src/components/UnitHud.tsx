import type { UnitActions } from '../hooks/useUnitActions';
import { UNIT_TYPES } from '../lib/rules';
import { useGameStore } from '../store/gameStore';
import { FACTIONS, type GameSnapshot } from '../types/game';
import { UnitActionButtons } from './UnitActionButtons';

/**
 * 맵 아래 고정 명령 바 (HUD). 맵 위에 겹치지 않으므로 이동 가능한 칸을 가리지 않는다.
 * 선택한 내 유닛의 행동(공격·도시 건설·요새화·휴식·대기)을 여기서 고른다.
 */
export function UnitHud({
  snapshot,
  userId,
  canAct,
  actions,
}: {
  snapshot: GameSnapshot;
  userId: string;
  canAct: boolean;
  actions: UnitActions;
}) {
  const selection = useGameStore((s) => s.selection);
  const select = useGameStore((s) => s.select);
  const unit = selection?.kind === 'unit' ? snapshot.units.find((u) => u.id === selection.id) : undefined;

  if (!unit) {
    return (
      <div className="flex min-h-[3.5rem] items-center rounded-lg border border-stone-700 bg-stone-800/80 px-4 text-sm text-stone-400">
        🧭 유닛을 누르면 여기에 명령이 나타나요 · 노란 칸 = 이동, 빨간 칸 = 공격 (N: 다음 유닛)
      </div>
    );
  }

  const t = UNIT_TYPES[unit.kind];
  const owner = snapshot.players.find((p) => p.user_id === unit.owner_id);
  const mine = unit.owner_id === userId;
  return (
    <div className="flex min-h-[3.5rem] flex-wrap items-center gap-3 rounded-lg border border-amber-600/60 bg-stone-900/95 px-3 py-2 shadow-lg">
      <div className="flex items-center gap-2">
        <img src={`/sprites/unit_${unit.kind}.png`} alt="" className={`h-10 w-10 object-contain ${unit.acted ? 'grayscale' : ''}`} />
        <div className="leading-tight">
          <div className="font-bold">
            {t.name}
            {owner && (
              <span className="ml-1 text-xs font-normal" style={{ color: FACTIONS[owner.faction].color }}>
                {mine ? '우리 유닛' : owner.nickname}
              </span>
            )}
          </div>
          <div className="text-xs text-stone-400">
            HP {unit.hp} · 이동 {unit.moves_left}/{t.moves}
            {unit.fortified && ' · 🛡️'}
          </div>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        {mine ? (
          <UnitActionButtons unit={unit} snapshot={snapshot} actions={actions} canAct={canAct} compact inline />
        ) : (
          <span className="text-xs text-stone-400">적 유닛 — 우리 유닛을 고른 뒤 빨간 칸을 누르면 공격해요.</span>
        )}
      </div>
      {actions.error && <span className="text-xs text-red-400">{actions.error}</span>}
      <button onClick={() => select(null)} className="text-stone-400 hover:text-white" aria-label="선택 해제 (Esc)" title="선택 해제 (Esc)">
        ✕
      </button>
    </div>
  );
}
