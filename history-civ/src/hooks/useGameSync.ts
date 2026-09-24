import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { estimateSkew } from '../lib/time';
import { useGameStore } from '../store/gameStore';
import type { GameEvent, Room, RoomPlayer } from '../types/game';

const AUTOSAVE_DELAY_MS = 800;

/**
 * 게임 상태 동기화.
 *  - rooms UPDATE에서 턴/상태가 바뀌면 get_game_state 스냅샷을 다시 받는다 (신호 → 스냅샷).
 *  - room_players UPDATE는 부분 반영한다 (누가 턴을 끝냈는지 즉시 표시).
 *  - turn_logs INSERT는 이벤트 큐에 넣는다 (전투/점령 애니메이션).
 *  - 입력 중인 명령은 디바운스해서 submit_actions로 자동 저장한다.
 */
export function useGameSync(roomId: string, userId: string) {
  const store = useGameStore;
  const snapshot = useGameStore((s) => s.snapshot);
  const pending = useGameStore((s) => s.pending);
  const pendingDirty = useGameStore((s) => s.pendingDirty);
  const [syncError, setSyncError] = useState<string | null>(null);

  // 동시에 여러 신호가 와도 fetch는 하나만 돌고, 도중에 온 신호는 한 번 더 받는 것으로 합친다.
  // 진행 중이면 같은 Promise를 돌려줘서, 호출한 쪽이 "최신 스냅샷이 반영될 때까지" 기다릴 수 있게 한다.
  const inflight = useRef<Promise<void> | null>(null);
  const again = useRef(false);

  const refetch = useCallback((): Promise<void> => {
    if (inflight.current) {
      again.current = true;
      return inflight.current;
    }
    const run = (async () => {
      try {
        do {
          again.current = false;
          const sentAt = Date.now();
          const snap = await api.getGameState(roomId);
          store.getState().setSnapshot(snap, estimateSkew(snap.server_now, sentAt, Date.now()));
          setSyncError(null);
        } while (again.current);
      } catch (e) {
        setSyncError((e as Error).message);
      } finally {
        inflight.current = null;
      }
    })();
    inflight.current = run;
    return run;
  }, [roomId, store]);

  useEffect(() => {
    store.getState().reset();
    const channel = supabase
      .channel(`game:${roomId}`)
      .on<Room>(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'hc_rooms', filter: `id=eq.${roomId}` },
        ({ new: r }) => {
          const cur = store.getState().snapshot?.room;
          // 턴·상태가 바뀌었거나 누군가 유닛을 즉시 행동시켰으면(action_seq) 스냅샷을 다시 받는다
          if (!cur || cur.turn_number !== r.turn_number || cur.status !== r.status || cur.action_seq !== r.action_seq)
            void refetch();
          else store.getState().patchRoom(r);
        },
      )
      .on<RoomPlayer>(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'hc_room_players', filter: `room_id=eq.${roomId}` },
        ({ new: p }) => store.getState().patchPlayer(p),
      )
      .on<{ events: GameEvent[] }>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'hc_turn_logs', filter: `room_id=eq.${roomId}` },
        ({ new: log }) => store.getState().queueEvents(log.events),
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void refetch(); // 최초 진입 + 재연결 복구
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setSyncError('실시간 연결이 끊겼어요. 재연결 중…');
      });

    // 탭이 백그라운드에 있다 돌아오면 소켓이 멈췄을 수 있으므로 스냅샷으로 맞춘다.
    const onVisible = () => document.visibilityState === 'visible' && void refetch();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      void supabase.removeChannel(channel);
    };
  }, [roomId, refetch, store]);

  const me = snapshot?.players.find((p) => p.user_id === userId) ?? null;
  const canAct = snapshot?.room.status === 'playing' && !!me && !me.has_ended_turn && !me.is_eliminated;

  // 명령 초안 자동 저장 (새로고침/기기 전환해도 입력 유지, 타이머 만료 시 저장된 명령으로 정산)
  useEffect(() => {
    if (!pendingDirty || !canAct) return;
    const t = setTimeout(() => {
      api
        .submitActions(roomId, pending)
        .then(() => {
          if (store.getState().pending === pending) store.getState().markSaved();
        })
        .catch((e: Error) => setSyncError(e.message));
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [pending, pendingDirty, canAct, roomId, store]);

  /** 마감 직전에 디바운스를 기다리지 않고 즉시 저장 (마지막 1초 입력도 정산에 반영) */
  const flush = useCallback(async () => {
    const { pending: actions, pendingDirty: dirty } = store.getState();
    if (!dirty || !canAct) return;
    try {
      await api.submitActions(roomId, actions);
      if (store.getState().pending === actions) store.getState().markSaved();
    } catch (e) {
      setSyncError((e as Error).message);
    }
  }, [roomId, canAct, store]);

  const endTurn = useCallback(async () => {
    const { pending: actions, snapshot: snap } = store.getState();
    if (!snap) return;
    store.getState().patchPlayer({ user_id: userId, has_ended_turn: true }); // 낙관적 반영
    try {
      const newTurn = await api.endTurn(roomId, actions);
      store.getState().markSaved();
      if (newTurn !== snap.room.turn_number) void refetch(); // 내가 마지막이었으면 바로 다음 턴
    } catch (e) {
      store.getState().patchPlayer({ user_id: userId, has_ended_turn: false });
      setSyncError((e as Error).message);
    }
  }, [roomId, userId, refetch, store]);

  const cancelEndTurn = useCallback(async () => {
    try {
      await api.cancelEndTurn(roomId);
      store.getState().patchPlayer({ user_id: userId, has_ended_turn: false });
    } catch (e) {
      setSyncError((e as Error).message);
    }
  }, [roomId, userId, store]);

  return { snapshot, me, canAct, refetch, flush, endTurn, cancelEndTurn, syncError };
}
