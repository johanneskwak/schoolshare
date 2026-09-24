import { describe, expect, it } from 'vitest';
import { estimateSkew, formatClock, remainingMs } from './time';

describe('remainingMs', () => {
  const deadline = '2026-01-01T00:01:00.000Z';
  const now = Date.parse('2026-01-01T00:00:00.000Z');

  it('서버 시각 기준으로 남은 시간을 계산한다', () => {
    expect(remainingMs(deadline, 0, now)).toBe(60_000);
  });
  it('기기 시계가 10초 느리면(skew +10s) 그만큼 덜 남는다', () => {
    expect(remainingMs(deadline, 10_000, now)).toBe(50_000);
  });
  it('마감이 지나면 0, 마감이 없으면 null', () => {
    expect(remainingMs(deadline, 0, now + 90_000)).toBe(0);
    expect(remainingMs(null, 0, now)).toBeNull();
  });
});

describe('estimateSkew', () => {
  it('왕복 시간의 중간 지점 기준으로 오차를 추정한다', () => {
    const t0 = Date.parse('2026-01-01T00:00:00.000Z');
    expect(estimateSkew('2026-01-01T00:00:05.100Z', t0, t0 + 200)).toBe(5_000);
  });
});

describe('formatClock', () => {
  it('초를 올림해서 m:ss로 표시한다', () => {
    expect(formatClock(59_001)).toBe('1:00');
    expect(formatClock(9_000)).toBe('0:09');
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(null)).toBe('--:--');
  });
});
