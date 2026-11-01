/**
 * clockSkewMs = 서버시각 − 클라이언트시각. 학생 기기 시계가 틀려도 모두 같은 마감을 본다.
 * 마감이 없으면 null.
 */
export function remainingMs(deadline: string | null, clockSkewMs: number, nowMs = Date.now()): number | null {
  if (!deadline) return null;
  return Math.max(0, Date.parse(deadline) - (nowMs + clockSkewMs));
}

/** RPC 왕복 시간의 중간 지점을 클라이언트 기준 시각으로 보고 오차를 추정한다. */
export function estimateSkew(serverNowIso: string, sentAtMs: number, receivedAtMs: number): number {
  return Date.parse(serverNowIso) - (sentAtMs + receivedAtMs) / 2;
}

export function formatClock(ms: number | null): string {
  if (ms === null) return '--:--';
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
