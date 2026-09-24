import { useMemo, useState } from 'react';
import { indexTiles, key, unitTargets } from '../lib/rules';
import { useGameStore } from '../store/gameStore';
import { FACTIONS, type GameSnapshot, type Tile, type Unit } from '../types/game';

// 아이소메트릭 마름모 타일 (문명2 방식). 스프라이트는 Higgsfield로 생성 → public/sprites
const TW = 64; // 마름모 가로
const TH = 32; // 마름모 세로
const TOP_PAD = 40; // 맨 윗줄 유닛·도시가 잘리지 않도록
const UNIT_H = 38;
const CITY_W = 60;

const ZOOMS = [1, 1.3, 1.6, 2, 2.5];
const ZOOM_KEY = 'history-civ:map-zoom';

function readZoom(): number {
  try {
    const z = Number(localStorage.getItem(ZOOM_KEY));
    return ZOOMS.includes(z) ? z : 1.6;
  } catch {
    return 1.6;
  }
}

const IMPROVEMENT_ICON ={ farm: '🌾', port: '⚓', railway: '🛤️', factory: '🏭' } as const;

const sprite = (name: string) => `/sprites/${name}.png`;

/** 격자 좌표 → 마름모 중심 (화면 좌표) */
function isoCenter(x: number, y: number, mapH: number) {
  return { cx: (x - y + mapH) * (TW / 2), cy: (x + y) * (TH / 2) + TH / 2 + TOP_PAD };
}

const diamond = (cx: number, cy: number, shrink = 0) =>
  `${cx},${cy - TH / 2 + shrink} ${cx + TW / 2 - shrink * 2},${cy} ${cx},${cy + TH / 2 - shrink} ${cx - TW / 2 + shrink * 2},${cy}`;

/**
 * 아이소메트릭 타일 맵. 클릭 규칙은 이전과 같다:
 * 내 유닛 → 선택, 선택 중 이동/공격 가능 칸 → 명령, 그 외 칸 → 칸 선택.
 * 그리기 순서: 지형 → 영토/강조 → 도시·유닛(뒤쪽부터) → 명령 화살표
 */
export function GameMap({ snapshot, userId, canAct }: { snapshot: GameSnapshot; userId: string; canAct: boolean }) {
  const { room, tiles, units, players } = snapshot;
  const selection = useGameStore((s) => s.selection);
  const pending = useGameStore((s) => s.pending);
  const select = useGameStore((s) => s.select);
  const queueAction = useGameStore((s) => s.queueAction);
  const [zoom, setZoomState] = useState(readZoom);
  const setZoom = (dir: 1 | -1) => {
    const next = ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, ZOOMS.indexOf(zoom) + dir))]!;
    setZoomState(next);
    try {
      localStorage.setItem(ZOOM_KEY, String(next));
    } catch {
      /* 저장 불가 환경은 무시 */
    }
  };

  const tileIndex = useMemo(() => indexTiles(tiles), [tiles]);
  const colorOf = useMemo(() => new Map(players.map((p) => [p.user_id, FACTIONS[p.faction].color])), [players]);
  const unitAt = useMemo(() => new Map(units.map((u) => [key(u.x, u.y), u])), [units]);
  const unitById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);
  const selectedUnit = selection?.kind === 'unit' ? unitById.get(selection.id) : undefined;
  const targets = useMemo(
    () => (selectedUnit && canAct ? unitTargets(selectedUnit, tileIndex, units) : null),
    [selectedUnit, canAct, tileIndex, units],
  );
  const combatTiles = useMemo(
    () =>
      new Set(
        (snapshot.last_log ?? []).filter((e) => e.type === 'combat').map((e) => key(e.x as number, e.y as number)),
      ),
    [snapshot.last_log],
  );

  const H = room.map_height;
  const c = (x: number, y: number) => isoCenter(x, y, H);
  const width = (room.map_width + room.map_height) * (TW / 2);
  const height = (room.map_width + room.map_height) * (TH / 2) + TOP_PAD + 8;

  // 뒤쪽(x+y 작은 칸)부터 그려야 앞쪽 스프라이트가 위에 겹친다
  const byDepth = <T extends { x: number; y: number }>(arr: T[]) => [...arr].sort((a, b) => a.x + a.y - (b.x + b.y) || a.x - b.x);
  const sortedTiles = useMemo(() => byDepth(tiles), [tiles]);
  const drawables = useMemo(() => {
    const items: ({ kind: 'city'; t: Tile } | { kind: 'unit'; u: Unit })[] = [];
    for (const t of tiles) if (t.is_city) items.push({ kind: 'city', t });
    for (const u of units) items.push({ kind: 'unit', u });
    const pos = (d: (typeof items)[number]) => (d.kind === 'city' ? d.t : d.u);
    // 같은 칸이면 도시를 먼저(아래), 유닛을 나중(위)에
    return items.sort((a, b) => {
      const pa = pos(a), pb = pos(b);
      return pa.x + pa.y - (pb.x + pb.y) || pa.x - pb.x || (a.kind === 'city' ? -1 : 1);
    });
  }, [tiles, units]);

  const onTileClick = (x: number, y: number) => {
    const k = key(x, y);
    const u = unitAt.get(k);
    if (selectedUnit && targets && (targets.moves.has(k) || targets.attacks.has(k))) {
      queueAction({ type: 'move', unit_id: selectedUnit.id, x, y });
      return;
    }
    if (u && u.owner_id === userId) select(selectedUnit?.id === u.id ? { kind: 'tile', x, y } : { kind: 'unit', id: u.id });
    else select({ kind: 'tile', x, y });
  };

  return (
    <div className="relative rounded-lg bg-[#0b1a2e] shadow-inner">
      <div className="absolute right-2 top-2 z-10 flex gap-1">
        <button onClick={() => setZoom(-1)} className="h-7 w-7 rounded bg-stone-800/90 font-bold" aria-label="축소">
          −
        </button>
        <button onClick={() => setZoom(1)} className="h-7 w-7 rounded bg-stone-800/90 font-bold" aria-label="확대">
          +
        </button>
      </div>
      <div className="max-h-[72vh] overflow-auto rounded-lg">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width * zoom}
        height={height * zoom}
        className="block select-none"
        role="grid"
        aria-label="게임 맵"
      >
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#fde047" />
          </marker>
          <marker id="arrow-red" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#ef4444" />
          </marker>
          <filter id="unit-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="1" dy="1.5" stdDeviation="1" floodOpacity="0.6" />
          </filter>
        </defs>

        {/* 1) 지형 */}
        {sortedTiles.map((t) => {
          const { cx, cy } = c(t.x, t.y);
          return (
            <image
              key={`t${t.x},${t.y}`}
              href={sprite(`terrain_${t.terrain}`)}
              x={cx - TW / 2}
              y={cy - TH / 2}
              width={TW}
              height={TH}
              preserveAspectRatio="none"
              style={{ imageRendering: 'auto' }}
            />
          );
        })}

        {/* 2) 영토 · 시설 · 강조 (클릭은 이 마름모가 받는다) */}
        {sortedTiles.map((t) => {
          const { cx, cy } = c(t.x, t.y);
          const k = key(t.x, t.y);
          const owner = t.owner_id ? colorOf.get(t.owner_id) : undefined;
          const isSel = selection?.kind === 'tile' && selection.x === t.x && selection.y === t.y;
          return (
            <g key={`o${k}`} onClick={() => onTileClick(t.x, t.y)} className="cursor-pointer">
              <polygon
                points={diamond(cx, cy, 1)}
                fill={owner ?? 'transparent'}
                fillOpacity={owner ? 0.16 : 0}
                stroke={owner ?? '#00000022'}
                strokeOpacity={owner ? 0.85 : 1}
                strokeWidth={owner ? 1.4 : 0.5}
              />
              {t.improvement && !t.is_city && (
                <text x={cx} y={cy + 4} textAnchor="middle" fontSize={10} pointerEvents="none">
                  {IMPROVEMENT_ICON[t.improvement]}
                </text>
              )}
              {combatTiles.has(k) && (
                <polygon points={diamond(cx, cy, 2)} fill="none" stroke="#ef4444" strokeWidth={2} strokeDasharray="4 3" pointerEvents="none" />
              )}
              {targets?.moves.has(k) && <polygon points={diamond(cx, cy)} fill="#facc15" fillOpacity={0.4} pointerEvents="none" />}
              {targets?.attacks.has(k) && <polygon points={diamond(cx, cy)} fill="#ef4444" fillOpacity={0.5} pointerEvents="none" />}
              {isSel && <polygon points={diamond(cx, cy, 1)} fill="none" stroke="#fff" strokeWidth={2.2} pointerEvents="none" />}
            </g>
          );
        })}

        {/* 3) 도시 · 유닛 (뒤쪽부터) */}
        {drawables.map((d) => {
          if (d.kind === 'city') {
            const t = d.t;
            const { cx, cy } = c(t.x, t.y);
            const owner = t.owner_id ? colorOf.get(t.owner_id) : '#888';
            const w = t.is_capital ? CITY_W + 6 : CITY_W;
            return (
              <g key={`c${t.x},${t.y}`} pointerEvents="none">
                <image href={sprite(t.is_capital ? 'capital' : 'city')} x={cx - w / 2} y={cy - w * 0.78} width={w} height={w} />
                <g transform={`translate(${cx},${cy + TH / 2 - 2})`}>
                  <rect x={-24} y={-8} width={48} height={11} rx={2} fill={owner} stroke="#000" strokeWidth={0.6} />
                  <text y={0.5} textAnchor="middle" fontSize={7.5} fontWeight={700} fill="#fff">
                    {t.is_capital ? '★ ' : ''}
                    {t.city_name} {t.city_pop}
                  </text>
                </g>
              </g>
            );
          }
          const u = d.u;
          const { cx, cy } = c(u.x, u.y);
          const color = colorOf.get(u.owner_id) ?? '#999';
          const sel = selectedUnit?.id === u.id;
          const onCity = tileIndex.get(key(u.x, u.y))?.is_city;
          // 도시 위의 수비대는 오른쪽 아래로 살짝 비켜 그린다
          const ox = onCity ? 12 : 0, oy = onCity ? 6 : 0;
          return (
            <g key={u.id} transform={`translate(${cx + ox},${cy + oy})`} pointerEvents="none">
              <ellipse cx={0} cy={4} rx={13} ry={5} fill={color} fillOpacity={0.85} stroke={sel ? '#fde047' : '#000'} strokeWidth={sel ? 2 : 0.8} />
              <image
                href={sprite(`unit_${u.kind}`)}
                x={-UNIT_H / 2}
                y={-UNIT_H + 6}
                width={UNIT_H}
                height={UNIT_H}
                filter="url(#unit-shadow)"
              />
              {/* 소유 진영 방패 */}
              <path d="M-16,-26 h8 v6 l-4,3 l-4,-3 z" fill={color} stroke="#000" strokeWidth={0.6} />
              {/* 체력 */}
              <rect x={-11} y={7} width={22} height={3} fill="#000" fillOpacity={0.7} />
              <rect x={-11} y={7} width={(22 * u.hp) / 100} height={3} fill={u.hp > 50 ? '#22c55e' : u.hp > 25 ? '#f59e0b' : '#ef4444'} />
              {u.owner_id === userId && u.moves_left === 0 && <circle cx={13} cy={-22} r={3} fill="#6b7280" stroke="#000" strokeWidth={0.5} />}
            </g>
          );
        })}

        {/* 4) 이번 턴 명령 */}
        {pending.map((a, i) => {
          if (a.type === 'move') {
            const u = unitById.get(a.unit_id);
            if (!u) return null;
            const from = c(u.x, u.y), to = c(a.x, a.y);
            const target = unitAt.get(key(a.x, a.y));
            const attack = !!target && target.owner_id !== userId;
            return (
              <line
                key={i}
                x1={from.cx}
                y1={from.cy}
                x2={to.cx}
                y2={to.cy}
                stroke={attack ? '#ef4444' : '#fde047'}
                strokeWidth={2.2}
                strokeDasharray={attack ? '5 3' : undefined}
                markerEnd={attack ? 'url(#arrow-red)' : 'url(#arrow)'}
                pointerEvents="none"
              />
            );
          }
          if (a.type === 'found_city') {
            const u = unitById.get(a.unit_id);
            if (!u) return null;
            const { cx, cy } = c(u.x, u.y);
            return <text key={i} x={cx + 12} y={cy - 18} fontSize={11} pointerEvents="none">🏗️</text>;
          }
          if (a.type === 'produce' || a.type === 'build') {
            const { cx, cy } = c(a.x, a.y);
            return (
              <text key={i} x={cx - 20} y={cy + 4} fontSize={10} pointerEvents="none">
                {a.type === 'produce' ? '🔨' : '🧱'}
              </text>
            );
          }
          return null;
        })}
      </svg>
      </div>
    </div>
  );
}
