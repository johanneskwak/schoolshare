import { BUILDINGS } from '../lib/chronicle';
import { LEADER_ORDER, LEADERS } from '../lib/leaders';
import { FACTIONS, type LeaderHolder, type RoomPlayer, type ScholarHolder } from '../types/game';
import { FigureIcon } from './FigureIcon';
import { InfoTooltip } from './InfoTooltip';

/** LeaderSystem: 역사적 인물 4명의 합류 현황과 효과 */
export function LeaderPanel({
  holders,
  players,
  meId,
  scholars = [],
}: {
  holders: LeaderHolder[];
  players: RoomPlayer[];
  meId: string;
  scholars?: ScholarHolder[];
}) {
  const byId = new Map(holders.map((h) => [h.leader_id, h]));
  const playerOf = new Map(players.map((p) => [p.user_id, p]));
  return (
    <div className="max-h-[32rem] space-y-2 overflow-y-auto rounded-lg bg-stone-800 p-3">
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
      <div className="border-t border-stone-700 pt-2 text-sm font-bold">
        <InfoTooltip concept="scholars">🌟 연대기 위인</InfoTooltip>
      </div>
      {scholars.length === 0 && <p className="text-xs text-stone-500">아직 없음 — 위인이 활약한 연도가 되면 자동으로 합류해요.</p>}
      {scholars.map((s) => {
        const owner = playerOf.get(s.player_id);
        const mine = s.player_id === meId;
        return (
          <div key={s.id} className={`flex gap-2 rounded p-2 text-xs ${mine ? 'bg-sky-900/40 ring-1 ring-sky-500' : 'bg-stone-900/60'}`}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-700 text-lg">
              <FigureIcon id={s.id} fallback={s.icon} />
            </div>
            <div className="min-w-0">
              <InfoTooltip concept={{ icon: s.icon, title: `${s.name} · ${s.era}`, body: [`대표작: ${s.works}`, s.significance, `효과: ${s.effect}`, ...(s.unlock_building ? [`해금: ${BUILDINGS[s.unlock_building].icon} ${BUILDINGS[s.unlock_building].name}`] : [])] }}>
                <span className="font-bold">{s.name}</span>
              </InfoTooltip>
              <div className="truncate text-stone-300">{s.works}</div>
              {owner && (
                <div style={{ color: FACTIONS[owner.faction].color }}>
                  {mine ? '★ 우리 문명' : owner.nickname} ({s.year ? `${s.year}년` : `턴 ${s.joined_turn}`})
                  {mine && s.quiz_result === 'correct' && ' · 퀴즈 ✓'}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
