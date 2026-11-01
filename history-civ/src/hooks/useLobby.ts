import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { usePresence } from './usePresence';
import type { Faction, Room, RoomPlayer } from '../types/game';

/**
 * 대기실 상태. rooms / room_players 변경을 postgres_changes로 받아 다시 읽는다.
 * 준비 여부는 DB가 기준이고, 접속 표시는 Presence로 한다.
 */
export function useLobby(roomId: string, userId: string) {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const online = usePresence(roomId, userId);
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    const [r, p] = await Promise.all([
      supabase.from('hc_rooms').select('*').eq('id', roomId).maybeSingle(),
      supabase.from('hc_room_players').select('*').eq('room_id', roomId).order('seat'),
    ]);
    if (seq !== loadSeq.current) return; // 더 최신 요청이 있으면 버림
    if (r.error || p.error) {
      setError((r.error ?? p.error)!.message);
      return;
    }
    setRoom(r.data as Room | null);
    setPlayers((p.data ?? []) as RoomPlayer[]);
  }, [roomId]);

  useEffect(() => {
    const channel = supabase
      .channel(`lobby:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hc_rooms', filter: `id=eq.${roomId}` }, () => void load())
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hc_room_players', filter: `room_id=eq.${roomId}` },
        () => void load(),
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void load(); // 구독 직후/재연결 시 놓친 변경 복구
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId, load]);

  const me = players.find((p) => p.user_id === userId) ?? null;
  const isHost = room?.host_id === userId;
  const canStart = useMemo(
    () => isHost && players.length >= 2 && players.every((p) => p.user_id === room?.host_id || p.is_ready),
    [isHost, players, room?.host_id],
  );

  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      setError(null);
      try {
        await fn();
        await load();
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [load],
  );

  return {
    room,
    players,
    online,
    me,
    isHost,
    canStart,
    error,
    setReady: (ready: boolean) => run(() => api.updateLobbyState(roomId, ready)),
    setFaction: (faction: Faction) => run(() => api.updateLobbyState(roomId, me?.is_ready ?? false, faction)),
    start: () => run(() => api.startGame(roomId)),
    leave: () => run(() => api.leaveRoom(roomId)),
  };
}
