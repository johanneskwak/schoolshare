import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

if (!url || !key) {
  throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY를 .env.local에 설정하세요.');
}

/**
 * 개발 전용: `?player=2`처럼 붙이면 같은 브라우저에서도 별도 익명 계정으로 접속한다(혼자 멀티플레이 테스트용).
 * 프로덕션에서는 항상 빈 문자열.
 */
export const devPlayerSuffix = (() => {
  if (!import.meta.env.DEV) return '';
  const p = new URLSearchParams(location.search).get('player');
  return p && /^\w{1,10}$/.test(p) ? `:${p}` : '';
})();

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    ...(devPlayerSuffix ? { storageKey: `history-civ-auth${devPlayerSuffix}` } : {}),
  },
  realtime: { params: { eventsPerSecond: 20 } },
});
