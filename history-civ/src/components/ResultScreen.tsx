import { finalRanking, VICTORY_DESC } from '../lib/victory';
import { FACTIONS, TECHS, VICTORY_NAMES, type GameSnapshot } from '../types/game';

const MEDAL = ['🥇', '🥈', '🥉'];

export function ResultScreen({
  snapshot,
  userId,
  onLeaderboard,
  onExit,
}: {
  snapshot: GameSnapshot;
  userId: string;
  onLeaderboard: () => void;
  onExit: () => void;
}) {
  const { room, players, tiles } = snapshot;
  const winner = players.find((p) => p.user_id === room.winner_id);
  const iWon = room.winner_id === userId;
  const ranking = finalRanking(players, room.winner_id);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-12">
      <div className="space-y-2 text-center">
        <div className="text-5xl">{iWon ? '🏆' : '🏳️'}</div>
        <h1 className="text-3xl font-bold">{room.victory ? VICTORY_NAMES[room.victory] : '게임 종료'}</h1>
        {winner ? (
          <p className="text-xl">
            <span style={{ color: FACTIONS[winner.faction].color }}>{winner.nickname}</span> ({FACTIONS[winner.faction].name}) 승리!
          </p>
        ) : (
          <p className="text-xl">승자 없음</p>
        )}
        {room.victory && <p className="text-stone-400">{VICTORY_DESC[room.victory]}</p>}
        <p className="text-sm text-stone-500">
          {room.turn_number}턴 진행 · 승자 보너스 +50점
          {room.is_solo && ' · AI 대전은 리더보드에 기록되지 않아요'}
        </p>
      </div>

      <table className="w-full text-sm">
        <thead className="text-stone-400">
          <tr className="border-b border-stone-700">
            <th className="py-2 text-left">순위</th>
            <th className="text-left">문명</th>
            <th className="text-right">도시</th>
            <th className="text-right">연구</th>
            <th className="text-right">이념</th>
            <th className="text-right">승점</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((p, i) => (
            <tr key={p.user_id} className={`border-b border-stone-800 ${p.user_id === userId ? 'bg-stone-800' : ''}`}>
              <td className="py-2">{MEDAL[i] ?? i + 1}</td>
              <td>
                {p.is_ai && <span title="AI">🤖 </span>}
                <span style={{ color: FACTIONS[p.faction].color }}>{p.nickname}</span>
                <span className="ml-1 text-xs text-stone-500">{FACTIONS[p.faction].name}</span>
                {p.is_eliminated && <span className="ml-1 text-xs text-red-400">멸망</span>}
              </td>
              <td className="text-right">{tiles.filter((t) => t.is_city && t.owner_id === p.user_id).length}</td>
              <td className="text-right" title={p.researched.map((t) => TECHS[t].name).join(', ')}>
                {p.researched.length}
              </td>
              <td className="text-right">{p.ideology}</td>
              <td className="text-right font-bold">{p.score}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-center gap-3">
        <button onClick={onLeaderboard} className="rounded bg-sky-600 px-6 py-2 font-bold">
          🏅 리더보드
        </button>
        <button onClick={onExit} className="rounded bg-amber-500 px-6 py-2 font-bold text-stone-900">
          로비로
        </button>
      </div>
    </div>
  );
}
