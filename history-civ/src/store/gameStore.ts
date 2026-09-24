import { create } from 'zustand';
import { removeUnitActions, upsertAction } from '../lib/actions';
import type { Action, GameEvent, GameSnapshot, Room, RoomPlayer } from '../types/game';

/** 맵에서 선택한 대상: 내 유닛 또는 칸(도시/시설 건설) */
export type Selection = { kind: 'unit'; id: string } | { kind: 'tile'; x: number; y: number } | null;

interface GameState {
  snapshot: GameSnapshot | null;
  clockSkewMs: number;
  /** 이번 턴에 입력 중인 명령. 서버에는 디바운스로 자동 저장된다. */
  pending: Action[];
  /** 서버에 아직 저장하지 않은 로컬 변경이 있는지 */
  pendingDirty: boolean;
  /** 정산 결과 이벤트 (4단계 맵 애니메이션이 소비) */
  events: GameEvent[];
  selection: Selection;

  setSnapshot: (s: GameSnapshot, clockSkewMs: number) => void;
  patchRoom: (r: Partial<Room>) => void;
  patchPlayer: (p: Partial<RoomPlayer> & { user_id: string }) => void;
  queueEvents: (e: GameEvent[]) => void;
  clearEvents: () => void;
  queueAction: (a: Action) => void;
  cancelUnitAction: (unitId: string) => void;
  removeActionAt: (index: number) => void;
  markSaved: () => void;
  select: (sel: Selection) => void;
  reset: () => void;
}

const initial = {
  snapshot: null,
  clockSkewMs: 0,
  pending: [],
  pendingDirty: false,
  events: [],
  selection: null as Selection,
};

export const useGameStore = create<GameState>()((set) => ({
  ...initial,

  setSnapshot: (s, clockSkewMs) =>
    set((st) => {
      const turnChanged = st.snapshot?.room.turn_number !== s.room.turn_number;
      // 같은 턴의 재조회(재연결 등)에서는 아직 저장 안 된 로컬 입력을 덮어쓰지 않는다.
      const keepLocal = !turnChanged && st.pendingDirty;
      return {
        snapshot: s,
        clockSkewMs,
        pending: keepLocal ? st.pending : (s.my_actions ?? []),
        pendingDirty: keepLocal,
        selection: turnChanged ? null : st.selection,
      };
    }),

  patchRoom: (r) =>
    set((st) => (st.snapshot ? { snapshot: { ...st.snapshot, room: { ...st.snapshot.room, ...r } } } : {})),

  patchPlayer: (p) =>
    set((st) =>
      st.snapshot
        ? {
            snapshot: {
              ...st.snapshot,
              players: st.snapshot.players.map((x) => (x.user_id === p.user_id ? { ...x, ...p } : x)),
            },
          }
        : {},
    ),

  queueEvents: (e) => set((st) => ({ events: [...st.events, ...e] })),
  clearEvents: () => set({ events: [] }),

  queueAction: (a) => set((st) => ({ pending: upsertAction(st.pending, a), pendingDirty: true })),
  cancelUnitAction: (unitId) =>
    set((st) => ({ pending: removeUnitActions(st.pending, unitId), pendingDirty: true })),
  removeActionAt: (index) => set((st) => ({ pending: st.pending.filter((_, i) => i !== index), pendingDirty: true })),
  markSaved: () => set({ pendingDirty: false }),

  select: (selection) => set({ selection }),
  reset: () => set(initial),
}));
