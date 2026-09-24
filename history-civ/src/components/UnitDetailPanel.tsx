import type { UnitActions } from '../hooks/useUnitActions';
import { indexTiles, key, UNIT_TYPES } from '../lib/rules';
import { canUpgrade, UNIT_INFO, UPGRADES, upgradeChain } from '../lib/units';
import { FACTIONS, TECHS, type GameSnapshot, type RoomPlayer, type Unit } from '../types/game';
import { UnitActionButtons } from './UnitActionButtons';

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded bg-stone-900/70 px-1.5 py-1 text-center" title={hint}>
      <div className="text-[10px] text-stone-400">{label}</div>
      <div className="text-sm font-bold">{value}</div>
    </div>
  );
}

/** 유닛 상세 카드: 스탯 · 특성 · 상성 · 업그레이드 경로 · 행동 */
export function UnitDetailPanel({
  unit,
  snapshot,
  me,
  actions,
  canAct,
}: {
  unit: Unit;
  snapshot: GameSnapshot;
  me: RoomPlayer;
  actions: UnitActions;
  canAct: boolean;
}) {
  const t = UNIT_TYPES[unit.kind];
  const info = UNIT_INFO[unit.kind];
  const mine = unit.owner_id === me.user_id;
  const owner = snapshot.players.find((p) => p.user_id === unit.owner_id);
  const tile = indexTiles(snapshot.tiles).get(key(unit.x, unit.y));
  const chain = upgradeChain(unit.kind);
  const check = mine ? canUpgrade(unit, me, tile) : null;
  const next = UPGRADES[unit.kind];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-stone-900 ${unit.acted ? 'grayscale' : ''}`}>
          <img src={`/sprites/unit_${unit.kind}.png`} alt="" className="h-14 w-14 object-contain" />
        </div>
        <div className="min-w-0">
          <div className="text-lg font-bold leading-tight">{t.name}</div>
          <div className="text-xs text-stone-400">
            {info.role}
            {owner && (
              <span className="ml-1" style={{ color: FACTIONS[owner.faction].color }}>
                · {mine ? '우리 유닛' : owner.nickname}
              </span>
            )}
          </div>
          <div className="mt-1 h-1.5 w-32 overflow-hidden rounded bg-stone-700">
            <div className={`h-full ${unit.hp > 50 ? 'bg-emerald-500' : unit.hp > 25 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${unit.hp}%` }} />
          </div>
          <div className="text-[11px] text-stone-400">
            HP {unit.hp}/100 {unit.fortified && '· 🛡️ 요새화'} {unit.acted && '· 행동 완료'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-1">
        <Stat label="이동" value={`${unit.moves_left}/${t.moves}`} hint="남은 이동력 / 최대" />
        <Stat label="공격" value={t.attack} />
        <Stat label="방어" value={t.defense} />
        <Stat label="사거리" value={t.range} hint="2 이상이면 반격 없이 원거리 공격" />
        <Stat label="시야" value={info.vision} />
        <Stat label="선제" value={t.initiative} hint="동시에 움직일 때 먼저 행동하는 순서" />
      </div>

      <div className="space-y-1 text-xs">
        {info.traits.map((tr) => (
          <div key={tr} className="text-stone-300">
            • {tr}
          </div>
        ))}
        {info.strongVs.length > 0 && <div className="text-emerald-300">▲ 강함: {info.strongVs.join(', ')}</div>}
        {info.weakVs.length > 0 && <div className="text-red-300">▼ 약함: {info.weakVs.join(', ')}</div>}
      </div>

      {/* 업그레이드 경로 */}
      <div className="rounded bg-stone-900/60 p-2">
        <div className="mb-1 text-xs font-bold text-stone-300">업그레이드 경로</div>
        {chain.length === 1 ? (
          <div className="text-xs text-stone-500">업그레이드 경로가 없는 유닛이에요.</div>
        ) : (
          <div className="flex flex-wrap items-center gap-1">
            {chain.map((k, i) => {
              const up = i > 0 ? UPGRADES[chain[i - 1]!] : undefined;
              const current = k === unit.kind;
              return (
                <div key={k} className="flex items-center gap-1">
                  {i > 0 && (
                    <div className="text-center text-[10px] leading-tight text-stone-400">
                      →
                      <br />
                      {up?.tech ? TECHS[up.tech].name : '기술 없음'}·💰{up?.gold}
                    </div>
                  )}
                  <div className={`flex flex-col items-center rounded px-1.5 py-1 ${current ? 'bg-amber-700/60 ring-1 ring-amber-400' : 'bg-stone-800'}`}>
                    <img src={`/sprites/unit_${k}.png`} alt="" className="h-7 w-7 object-contain" />
                    <span className="text-[10px]">{UNIT_TYPES[k].name}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {mine && next && (
          <button
            disabled={!canAct || !check?.ok || actions.busy}
            onClick={() => void actions.upgrade(unit)}
            className="mt-2 w-full rounded bg-violet-700 px-2 py-1.5 text-xs font-bold hover:bg-violet-600 disabled:opacity-40"
            title="우리 영토 안에서, 필요한 기술과 골드가 있으면 업그레이드할 수 있어요. 업그레이드한 턴에는 행동이 끝납니다."
          >
            ⬆ {UNIT_TYPES[next.to].name}(으)로 업그레이드 · 💰{next.gold}
            {next.tech && ` · ${TECHS[next.tech].name} 필요`}
            {check && !check.ok && <span className="block font-normal text-violet-200">({check.reason})</span>}
          </button>
        )}
      </div>

      {mine && <UnitActionButtons unit={unit} snapshot={snapshot} actions={actions} canAct={canAct} />}
      {actions.error && <p className="text-xs text-red-400">{actions.error}</p>}
    </div>
  );
}
