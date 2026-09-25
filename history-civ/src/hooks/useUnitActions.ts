// UnitActionController: 유닛 즉시 행동 (이동 → 행동 메뉴 → 공격/도시 건설/요새화/휴식/대기/업그레이드)
import { useCallback, useMemo, useState } from 'react';
import { api, type AttackResult } from '../lib/api';
import { useGameStore, type CombatFx } from '../store/gameStore';
import type { BuildingId, Unit } from '../types/game';
import { BUILDINGS } from '../lib/chronicle';

export type RestMode = 'wait' | 'fortify' | 'heal';

export interface UnitActions {
  busy: boolean;
  error: string | null;
  clearError: () => void;
  move: (unit: Unit, x: number, y: number) => Promise<void>;
  attack: (unit: Unit, x: number, y: number) => Promise<void>;
  foundCity: (unit: Unit) => Promise<void>;
  rest: (unit: Unit, mode: RestMode) => Promise<void>;
  upgrade: (unit: Unit) => Promise<void>;
  /** 불가사의 즉시 건설 (망치) */
  buildWonder: (x: number, y: number, wonderId: string) => Promise<void>;
  /** 도시 건물 즉시 건설 (골드) — 도서관·위인 건물 */
  buildBuilding: (x: number, y: number, building: BuildingId) => Promise<void>;
}

const FX_MS = 1500;

/** 공격 결과 → 데미지 숫자·격파 연출 */
export function combatFx(r: Pick<AttackResult, 'from' | 'at' | 'dmg_att' | 'dmg_def' | 'attacker_hp' | 'defender_hp' | 'siege'>): Omit<CombatFx, 'id'>[] {
  const [ax, ay] = r.from, [dx, dy] = r.at;
  return [
    { x: dx, y: dy, text: r.dmg_def > 0 ? `${r.siege ? '🏰 ' : ''}-${r.dmg_def}` : '0', kind: 'damage' },
    ...(r.defender_hp <= 0
      ? [{ x: dx, y: dy, text: r.siege ? '성벽 붕괴! 입성하세요' : '격파!', kind: 'kill' as const }]
      : r.siege
        ? [{ x: dx, y: dy, text: `성벽 ${r.defender_hp}`, kind: 'info' as const }]
        : []),
    { x: ax, y: ay, text: r.dmg_att > 0 ? `-${r.dmg_att}` : '반격 없음', kind: r.dmg_att > 0 ? ('damage' as const) : ('miss' as const) },
    ...(r.attacker_hp <= 0 ? [{ x: ax, y: ay, text: '전사', kind: 'kill' as const }] : []),
  ];
}

export function useFxQueue() {
  const pushFx = useGameStore((s) => s.pushFx);
  const dropFx = useGameStore((s) => s.dropFx);
  return useCallback(
    (items: Omit<CombatFx, 'id'>[]) => {
      if (!items.length) return;
      pushFx(items);
      const ids = useGameStore.getState().fx.slice(-items.length).map((f) => f.id);
      setTimeout(() => dropFx(ids), FX_MS);
    },
    [pushFx, dropFx],
  );
}

/** 서버 RPC로 즉시 처리. 결과는 refetch로 스냅샷에 반영된다. */
export function useUnitActions(roomId: string, refetch: () => Promise<void>): UnitActions {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const select = useGameStore((s) => s.select);
  const setUnitMode = useGameStore((s) => s.setUnitMode);
  const showFx = useFxQueue();

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      if (busy) return;
      setBusy(true);
      setError(null);
      try {
        await fn();
      } catch (e) {
        setError((e as Error).message);
        await refetch();
      } finally {
        setBusy(false);
      }
    },
    [busy, refetch],
  );

  return useMemo<UnitActions>(
    () => ({
      busy,
      error,
      clearError: () => setError(null),
      move: (unit, x, y) =>
        run(async () => {
          await api.unitMove(roomId, unit.id, x, y);
          await refetch();
          // 이동 직후 행동 메뉴를 띄운다
          select({ kind: 'unit', id: unit.id });
          setUnitMode('menu');
        }),
      attack: (unit, x, y) =>
        run(async () => {
          const r = await api.unitAttack(roomId, unit.id, x, y);
          showFx(combatFx(r));
          await refetch();
          if (r.attacker_hp <= 0) select(null);
          else select({ kind: 'unit', id: unit.id });
        }),
      foundCity: (unit) =>
        run(async () => {
          await api.unitFoundCity(roomId, unit.id);
          showFx([{ x: unit.x, y: unit.y, text: '도시 건설!', kind: 'info' }]);
          await refetch();
          select({ kind: 'tile', x: unit.x, y: unit.y });
        }),
      rest: (unit, mode) =>
        run(async () => {
          await api.unitRest(roomId, unit.id, mode);
          if (mode !== 'wait') showFx([{ x: unit.x, y: unit.y, text: mode === 'fortify' ? '요새화' : '치유', kind: 'info' }]);
          await refetch();
          select(null);
        }),
      buildWonder: (x, y, wonderId) =>
        run(async () => {
          await api.buildWonder(roomId, x, y, wonderId);
          showFx([{ x, y, text: '불가사의 완공!', kind: 'info' }]);
          await refetch();
        }),
      buildBuilding: (x, y, building) =>
        run(async () => {
          await api.buildBuilding(roomId, x, y, building);
          showFx([{ x, y, text: `${BUILDINGS[building].icon} ${BUILDINGS[building].name} 완공!`, kind: 'info' }]);
          await refetch();
        }),
      upgrade: (unit) =>
        run(async () => {
          await api.unitUpgrade(roomId, unit.id);
          showFx([{ x: unit.x, y: unit.y, text: '업그레이드!', kind: 'info' }]);
          await refetch();
        }),
    }),
    [busy, error, run, roomId, refetch, select, setUnitMode, showFx],
  );
}
