import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { remainingMs } from '../lib/time';
import { useGameStore } from '../store/gameStore';

const TICK_MS = 250;
const RETRY_MS = 3000;
const MAX_ATTEMPTS = 5;

/**
 * 서버 시각 기준 남은 시간(ms). 0이 되면 try_resolve_turn을 호출한다.
 * 여러 클라이언트가 동시에 불러도 서버가 턴 번호로 한 번만 정산하므로 안전하다.
 * 부하를 나누려고 0~1.5초 무작위 지연을 주고, 기기 시계 오차로 서버가 아직 거절하면 재시도한다.
 */
export function useTurnTimer(roomId: string, onResolved: () => void): number | null {
  const deadline = useGameStore((s) => s.snapshot?.room.turn_deadline ?? null);
  const turn = useGameStore((s) => s.snapshot?.room.turn_number ?? 0);
  const status = useGameStore((s) => s.snapshot?.room.status);
  const skew = useGameStore((s) => s.clockSkewMs);
  const [left, setLeft] = useState<number | null>(() => remainingMs(deadline, skew));
  const onResolvedRef = useRef(onResolved);
  onResolvedRef.current = onResolved;

  useEffect(() => {
    if (status !== 'playing') {
      setLeft(null);
      return;
    }
    let attempts = 0;
    let nextTryAt = 0;
    let cancelled = false;

    const tick = () => {
      const ms = remainingMs(deadline, skew);
      setLeft(ms);
      if (ms !== 0 || cancelled || attempts >= MAX_ATTEMPTS) return;
      const now = Date.now();
      if (nextTryAt === 0) nextTryAt = now + Math.random() * 1500;
      if (now < nextTryAt) return;
      attempts++;
      nextTryAt = now + RETRY_MS;
      api
        .tryResolveTurn(roomId, turn)
        .then((resolved) => {
          if (!cancelled && resolved) onResolvedRef.current();
        })
        .catch(() => {
          /* 다음 재시도에서 처리. 다른 클라이언트나 pg_cron이 정산할 수도 있다. */
        });
    };

    tick();
    const id = setInterval(tick, TICK_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [roomId, deadline, skew, turn, status]);

  return left;
}
