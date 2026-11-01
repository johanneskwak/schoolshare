import { useCallback, useEffect, useState } from 'react';
import { devPlayerSuffix, supabase } from '../lib/supabase';
import { api } from '../lib/api';

const NICK_KEY = `history-civ:nickname${devPlayerSuffix}`;

function readNickname(): string | null {
  try {
    return localStorage.getItem(NICK_KEY);
  } catch {
    return null;
  }
}

// 앱 전체에서 로그인은 한 번만. StrictMode처럼 effect가 두 번 돌아도 익명 계정이 두 개 생기지 않게 한다.
let signInPromise: Promise<string> | null = null;

function ensureSignedIn(): Promise<string> {
  signInPromise ??= (async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) return data.session.user.id;
    const res = await supabase.auth.signInAnonymously();
    if (res.error || !res.data.user) throw new Error(`로그인 실패: ${res.error?.message ?? '사용자 없음'}`);
    return res.data.user.id;
  })().catch((e: Error) => {
    signInPromise = null; // 실패하면 다음 시도에서 다시 로그인
    throw e;
  });
  return signInPromise;
}

/** 익명 로그인 + 닉네임 프로필. 새로고침해도 같은 익명 계정이 유지된다. */
export function useAuth() {
  const [userId, setUserId] = useState<string | null>(null);
  const [nickname, setNicknameState] = useState<string | null>(readNickname);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    ensureSignedIn()
      .then((id) => !cancelled && setUserId(id))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, []);

  const setNickname = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 20) throw new Error('닉네임은 1~20자로 입력하세요.');
    await api.ensureProfile(trimmed);
    try {
      localStorage.setItem(NICK_KEY, trimmed);
    } catch {
      /* 저장 불가 환경은 무시 */
    }
    setNicknameState(trimmed);
  }, []);

  // 저장된 닉네임이 있으면 프로필이 서버에 있는지 보장 (DB 초기화 대비)
  useEffect(() => {
    if (userId && nickname) api.ensureProfile(nickname).catch(() => setNicknameState(null));
  }, [userId, nickname]);

  return { userId, nickname, setNickname, error };
}
