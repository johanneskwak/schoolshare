import { LEADER_ORDER, LEADERS } from '../lib/leaders';
import { FACTIONS, type LeaderHolder, type RoomPlayer } from '../types/game';
import { InfoTooltip } from './InfoTooltip';

/** LeaderSystem: 역사적 인물 4명의 합류 현황과 효과 */
export function LeaderPanel({ holders, players, meId }: { holders: LeaderHolder[]; players: RoomPlayer[]; meId: string }) {
  const byId = new Map(holders.map((h) => [h.leader_id, h]));
  const playerOf = new Map(players.map((p) => [p.user_id, p]));
  return (
    <div className="space-y-2 rounded-lg bg-stone-800 p-3">
      <div className="text-sm font-bold">
        <InfoTooltip concept="leaders">역사적 인물</InfoTooltip>
      </div>
      {LEADER_ORDER.map((id) => {
        const def = LEADERS[id];
        const holder = byId.get(id);
        const owner = holder ? playerOf.get(holder.player_id) : undefined;
        const mine = holder?.player_id === meId;
        return (
          <div
            key={id}
            className={`flex gap-2 rounded p-2 text-xs ${mine ? 'bg-amber-900/50 ring-1 ring-amber-500' : holder ? 'bg-stone-900/60' : 'bg-stone-900/30 opacity-70'}`}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-stone-700 text-xl">
              {def.portrait ? <img src={def.portrait} alt="" className="h-9 w-9 object-contain" /> : def.icon}
            </div>
            <div className="min-w-0">
              <div className="font-bold">
                {def.name} <span className="font-normal text-stone-400">· {def.era}</span>
              </div>
              <div className="text-stone-300">{def.effect}</div>
              <div className="mt-0.5">
                {owner ? (
                  <span style={{ color: FACTIONS[owner.faction].color }}>
                    {mine ? '★ 우리 문명에 합류' : `${owner.nickname}에 합류`} (턴 {holder!.joined_turn})
                  </span>
                ) : (
                  <span className="text-stone-500">등장 조건: {def.condition}</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
