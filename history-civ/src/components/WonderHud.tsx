import { WONDER_DEFENSE_TURNS } from '../lib/civ';
import { FACTIONS, type GameSnapshot } from '../types/game';
import { InfoTooltip } from './InfoTooltip';

/** 상단 HUD: 완공된 불가사의의 방어 카운트다운 (10 → 9 → …) + 새로 완공되면 전역 공지 */
export function WonderHud({ snapshot, userId }: { snapshot: GameSnapshot; userId: string }) {
  const { wonders, players, last_log } = snapshot;
  const nameOf = (id: string) => players.find((p) => p.user_id === id);
  const justBuilt = (last_log ?? []).filter((e) => e.type === 'wonder_built' || e.type === 'wonder_captured');
  if (!wonders.length && !justBuilt.length) return null;

  return (
    <div className="space-y-1.5">
      {justBuilt.map((e, i) => {
        const w = wonders.find((x) => x.wonder_id === e.wonder);
        const p = nameOf(e.player as string);
        return (
          <div key={i} className="rounded-lg border border-amber-500 bg-gradient-to-r from-amber-900/80 to-stone-900 px-4 py-2 text-sm font-bold text-amber-100" role="status">
            📣 {p ? `${p.nickname}(${FACTIONS[p.faction].name})` : '어느 문명'}
            {e.type === 'wonder_built'
              ? ` 문명이 ${w?.icon ?? ''} ${w?.name_ko ?? '불가사의'} 완공! ${WONDER_DEFENSE_TURNS}턴간 사수하면 승리합니다.`
              : `이(가) ${w?.icon ?? ''} ${w?.name_ko ?? '불가사의'}를 점령! 카운트다운이 다시 시작됩니다.`}
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-2">
        <InfoTooltip concept="wonder_victory" className="text-xs font-bold text-amber-300">
          🏛️ 불가사의 방어
        </InfoTooltip>
        {wonders.map((w) => {
          const p = nameOf(w.player_id);
          const mine = w.player_id === userId;
          const danger = w.turns_left <= 3;
          return (
            <span
              key={w.wonder_id}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${mine ? 'border-emerald-500 bg-emerald-950/60' : danger ? 'animate-pulse border-red-500 bg-red-950/60' : 'border-amber-600 bg-stone-900'}`}
              title={`${w.name_ko} (${w.x},${w.y}) — ${w.turns_left}턴 더 지키면 ${p?.nickname ?? ''} 승리`}
            >
              {w.icon} {w.name_ko}
              {p && <span style={{ color: FACTIONS[p.faction].color }}>{p.nickname}</span>}
              <b className={mine ? 'text-emerald-300' : 'text-amber-300'}>{w.turns_left}턴</b>
            </span>
          );
        })}
      </div>
    </div>
  );
}
