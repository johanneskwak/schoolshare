import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * 방 접속자 추적 (Supabase Presence). 표시 전용이며 게임 판정에는 쓰지 않는다.
 * 반환값: 현재 이 방 페이지를 열어 둔 user_id 집합.
 */
export function usePresence(roomId: string | null, userId: string | null): Set<string> {
  const [online, setOnline] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!roomId || !userId) return;
    const channel = supabase.channel(`presence:${roomId}`, { config: { presence: { key: userId } } });
    channel
      .on('presence', { event: 'sync' }, () => setOnline(new Set(Object.keys(channel.presenceState()))))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void channel.track({ online_at: new Date().toISOString() });
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId, userId]);

  return online;
}
