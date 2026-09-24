import { CULTURE_GOAL, victoryProgress } from '../lib/victory';
import { FACTIONS, type Room, type RoomPlayer } from '../types/game';

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded bg-stone-700">
      <div className="h-full" style={{ width: `${Math.round(value * 100)}%`, background: color }} />
    </div>
  );
}

/** 문명별 승리 조건 진행도 (정복 · 과학 · 문화 · 점수) */
export function VictoryPanel({ room, players }: { room: Room; players: RoomPlayer[] }) {
  const progress = new Map(victoryProgress(players).map((v) => [v.userId, v]));
  const alive = players.filter((p) => !p.is_eliminated).length;
  return (
    <div className="space-y-2 rounded-lg bg-stone-800 p-3 text-xs">
      <div className="flex justify-between text-sm font-bold">
        <span>승리 경쟁</span>
        <span className="font-normal text-stone-400">
          생존 {alive}/{players.length} · {room.max_turns - room.turn_number}턴 남음
        </span>
      </div>
      {players.map((p) => {
        const v = progress.get(p.user_id)!;
        return (
          <div key={p.user_id} className={`space-y-1 ${p.is_eliminated ? 'opacity-40' : ''}`}>
            <div className="flex justify-between">
              <span style={{ color: FACTIONS[p.faction].color }}>
                {p.nickname} {p.is_eliminated && '(멸망)'}
              </span>
              <span className="text-stone-400">⭐{p.score}</span>
            </div>
            <div className="grid grid-cols-[3.5rem_1fr] items-center gap-x-2 gap-y-1">
              <span className="text-stone-400">💡 과학</span>
              <Bar value={v.science} color="#38bdf8" />
              <span className="text-stone-400">🕊️ 문화</span>
              <div className="flex items-center gap-1">
                <Bar value={v.culture} color="#a78bfa" />
                <span className="w-14 text-right text-stone-400">
                  {p.ideology}/{CULTURE_GOAL}
                  {v.cultureLeader && ' 👑'}
                </span>
              </div>
            </div>
          </div>
        );
      })}
      <p className="text-stone-500">정복: 상대 수도(★)를 모두 함락 · {room.max_turns}턴 종료 시 승점 1위</p>
    </div>
  );
}
