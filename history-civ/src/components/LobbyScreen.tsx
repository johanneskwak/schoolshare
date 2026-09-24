import { useEffect } from 'react';
import { useLobby } from '../hooks/useLobby';
import { FACTIONS } from '../types/game';
import { FactionPicker } from './HomeScreen';

export function LobbyScreen({
  roomId,
  userId,
  onStarted,
  onLeft,
}: {
  roomId: string;
  userId: string;
  onStarted: () => void;
  onLeft: () => void;
}) {
  const lobby = useLobby(roomId, userId);
  const { room, players, online, me, isHost, canStart, error } = lobby;

  useEffect(() => {
    if (room && room.status !== 'waiting') onStarted();
  }, [room, onStarted]);

  if (!room) return <p className="p-8 text-stone-400">방 정보를 불러오는 중…</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">대기실</h1>
        <div className="text-right">
          <div className="text-xs text-stone-400">참가 코드</div>
          <div className="font-mono text-3xl tracking-widest text-amber-400">{room.code}</div>
        </div>
      </div>

      <ul className="space-y-2">
        {players.map((p) => (
          <li key={p.user_id} className="flex items-center gap-3 rounded bg-stone-800 px-4 py-2">
            <span
              title={online.has(p.user_id) ? '접속 중' : '오프라인'}
              className={`h-2.5 w-2.5 rounded-full ${online.has(p.user_id) ? 'bg-green-400' : 'bg-stone-500'}`}
            />
            <span className="font-bold">{p.nickname}</span>
            {p.user_id === room.host_id && <span className="text-xs text-amber-400">방장</span>}
            <span className="text-sm" style={{ color: FACTIONS[p.faction].color }}>
              {FACTIONS[p.faction].name}
            </span>
            <span className="ml-auto text-sm">
              {p.user_id === room.host_id ? '' : p.is_ready ? '✅ 준비 완료' : '⏳ 대기 중'}
            </span>
          </li>
        ))}
        {Array.from({ length: room.max_players - players.length }, (_, i) => (
          <li key={`empty-${i}`} className="rounded border border-dashed border-stone-700 px-4 py-2 text-stone-500">
            빈 자리
          </li>
        ))}
      </ul>

      {me && <FactionPicker value={me.faction} onChange={(f) => void lobby.setFaction(f)} />}

      <div className="flex gap-3">
        {isHost ? (
          <button
            disabled={!canStart}
            onClick={() => void lobby.start()}
            className="rounded bg-amber-500 px-6 py-2 font-bold text-stone-900 disabled:opacity-40"
          >
            게임 시작
          </button>
        ) : (
          <button
            onClick={() => void lobby.setReady(!me?.is_ready)}
            className="rounded bg-sky-600 px-6 py-2 font-bold"
          >
            {me?.is_ready ? '준비 취소' : '준비'}
          </button>
        )}
        <button
          onClick={() => void lobby.leave().then(onLeft)}
          className="rounded border border-stone-600 px-4 py-2"
        >
          나가기
        </button>
      </div>
      {isHost && !canStart && <p className="text-sm text-stone-400">2명 이상이 모두 준비하면 시작할 수 있어요.</p>}
      {error && <p className="text-red-400">{error}</p>}
    </div>
  );
}
