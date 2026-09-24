import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Row {
  user_id: string;
  nickname: string;
  games_played: number;
  wins: number;
  total_score: number;
  best_score: number;
  rank: number;
}

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

/** 전체 리더보드: 승리 수 → 누적 승점 순 (hc_leaderboard_ranked 뷰) */
export function LeaderboardScreen({ userId, onBack }: { userId: string | null; onBack: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('hc_leaderboard_ranked')
      .select('*')
      .order('rank')
      .order('best_score', { ascending: false })
      .limit(50)
      .then(({ data, error: e }) => {
        if (e) setError(e.message);
        else setRows((data ?? []) as Row[]);
      });
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">🏅 리더보드</h1>
        <button onClick={onBack} className="rounded border border-stone-600 px-4 py-1.5 text-sm">
          돌아가기
        </button>
      </div>
      <p className="text-sm text-stone-400">순위: 승리 수 → 누적 승점. 게임이 끝날 때마다 자동으로 기록됩니다.</p>

      {error && <p className="text-red-400">{error}</p>}
      {!rows && !error && <p className="text-stone-400">불러오는 중…</p>}
      {rows?.length === 0 && <p className="text-stone-400">아직 끝난 게임이 없어요.</p>}

      {rows && rows.length > 0 && (
        <table className="w-full text-sm">
          <thead className="text-stone-400">
            <tr className="border-b border-stone-700">
              <th className="py-2 text-left">순위</th>
              <th className="text-left">닉네임</th>
              <th className="text-right">승리</th>
              <th className="text-right">판수</th>
              <th className="text-right">승률</th>
              <th className="text-right">누적 승점</th>
              <th className="text-right">최고</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.user_id} className={`border-b border-stone-800 ${r.user_id === userId ? 'bg-amber-900/40' : ''}`}>
                <td className="py-2">{MEDAL[r.rank] ?? r.rank}</td>
                <td>
                  {r.nickname}
                  {r.user_id === userId && <span className="ml-1 text-xs text-amber-400">나</span>}
                </td>
                <td className="text-right">{r.wins}</td>
                <td className="text-right">{r.games_played}</td>
                <td className="text-right">{Math.round((r.wins / Math.max(1, r.games_played)) * 100)}%</td>
                <td className="text-right font-bold">{r.total_score}</td>
                <td className="text-right">{r.best_score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
