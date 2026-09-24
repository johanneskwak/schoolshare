import { useEffect, useMemo, useRef, useState } from 'react';
import { indexTiles, key, unitTargets } from '../lib/rules';
import { useGameStore } from '../store/gameStore';
import { FACTIONS, type GameSnapshot, type Tile, type Unit } from '../types/game';

// 2:1 아이소메트릭 투영 (문명2 / 조조전 방식)
//   screenX = (x - y) * TW/2,  screenY = (x + y) * TH/2
const TW = 64;
const TH = 32;
const TOP_PAD = 44; // 맨 윗줄 유닛·도시가 잘리지 않도록
const UNIT_H = 40;
const CITY_W = 62;
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

const IMPROVEMENT_ICON = { farm: '🌾', port: '⚓', railway: '🛤️', factory: '🏭' } as const;
const sprite = (name: string) => `/sprites/${name}.png`;

function isoCenter(x: number, y: number, mapH: number) {
  return { cx: (x - y + mapH) * (TW / 2), cy: (x + y) * (TH / 2) + TH / 2 + TOP_PAD };
}

const diamond = (cx: number, cy: number, s = 0) =>
  `${cx},${cy - TH / 2 + s} ${cx + TW / 2 - s * 2},${cy} ${cx},${cy + TH / 2 - s} ${cx - TW / 2 + s * 2},${cy}`;

// 격자 이웃 방향 → 마름모의 해당 변 (영토 경계선을 이웃 소유자가 다를 때만 그린다)
const EDGES: [dx: number, dy: number, from: 'T' | 'R' | 'B' | 'L', to: 'T' | 'R' | 'B' | 'L'][] = [
  [-1, 0, 'L', 'T'],
  [0, -1, 'T', 'R'],
  [1, 0, 'R', 'B'],
  [0, 1, 'B', 'L'],
];
const vertex = (cx: number, cy: number, v: 'T' | 'R' | 'B' | 'L', inset = 1.2) =>
  v === 'T' ? [cx, cy - TH / 2 + inset] : v === 'B' ? [cx, cy + TH / 2 - inset] : v === 'R' ? [cx + TW / 2 - inset * 2, cy] : [cx - TW / 2 + inset * 2, cy];

export function GameMap({
  snapshot,
  userId,
  canAct,
  idleUnitIds = [],
}: {
  snapshot: GameSnapshot;
  userId: string;
  canAct: boolean;
  idleUnitIds?: string[];
}) {
  const { room, tiles, units, players } = snapshot;
  const selection = useGameStore((s) => s.selection);
  const pending = useGameStore((s) => s.pending);
  const select = useGameStore((s) => s.select);
  const queueAction = useGameStore((s) => s.queueAction);
  const [zoom, setZoomState] = useState(readZoom);
  const scroller = useRef<HTMLDivElement>(null);

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
  const idle = useMemo(() => new Set(canAct ? idleUnitIds : []), [idleUnitIds, canAct]);
  const selectedUnit = selection?.kind === 'unit' ? unitById.get(selection.id) : undefined;
  const targets = useMemo(
    () => (selectedUnit && canAct ? unitTargets(selectedUnit, tileIndex, units) : null),
    [selectedUnit, canAct, tileIndex, units],
  );
  const combatTiles = useMemo(
    () => new Set((snapshot.last_log ?? []).filter((e) => e.type === 'combat').map((e) => key(e.x as number, e.y as number))),
    [snapshot.last_log],
  );

  const H = room.map_height;
  const c = (x: number, y: number) => isoCenter(x, y, H);
  const width = (room.map_width + room.map_height) * (TW / 2);
  const height = (room.map_width + room.map_height) * (TH / 2) + TOP_PAD + 10;

  // Y-sort: 뒤쪽(x+y가 작은 칸)부터 그려야 앞쪽 스프라이트가 자연스럽게 겹친다
  const sortedTiles = useMemo(
    () => [...tiles].sort((a, b) => a.x + a.y - (b.x + b.y) || a.x - b.x),
    [tiles],
  );
  const drawables = useMemo(() => {
    const items: ({ kind: 'city'; t: Tile } | { kind: 'unit'; u: Unit })[] = [];
    for (const t of tiles) if (t.is_city) items.push({ kind: 'city', t });
    for (const u of units) items.push({ kind: 'unit', u });
    const pos = (d: (typeof items)[number]) => (d.kind === 'city' ? d.t : d.u);
    return items.sort((a, b) => {
      const pa = pos(a), pb = pos(b);
      return pa.x + pa.y - (pb.x + pb.y) || pa.x - pb.x || (a.kind === 'city' ? -1 : 1);
    });
  }, [tiles, units]);

  // 선택한 유닛/칸이 화면 밖이면 스크롤해서 보여 준다 (가이드의 "바로 가기")
  const focus = selectedUnit ? { x: selectedUnit.x, y: selectedUnit.y } : selection?.kind === 'tile' ? selection : null;
  useEffect(() => {
    const el = scroller.current;
    if (!el || !focus) return;
    const { cx, cy } = isoCenter(focus.x, focus.y, H);
    const px = cx * zoom, py = cy * zoom;
    const inView = px > el.scrollLeft + 40 && px < el.scrollLeft + el.clientWidth - 40 && py > el.scrollTop + 40 && py < el.scrollTop + el.clientHeight - 40;
    if (!inView) el.scrollTo({ left: px - el.clientWidth / 2, top: py - el.clientHeight / 2, behavior: 'smooth' });
  }, [focus?.x, focus?.y, zoom, H]); // eslint-disable-line react-hooks/exhaustive-deps

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
      <div ref={scroller} className="max-h-[72vh] overflow-auto rounded-lg">
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
            <radialGradient id="foot-shadow">
              <stop offset="0%" stopColor="#000" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#000" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="select-glow">
              <stop offset="0%" stopColor="#fde047" stopOpacity="0.75" />
              <stop offset="70%" stopColor="#fde047" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#fde047" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* 1) 지형: 격자선 없이, 1px씩 겹쳐 그려 이음새를 없앤다 */}
          {sortedTiles.map((t) => {
            const { cx, cy } = c(t.x, t.y);
            return (
              <image
                key={`t${t.x},${t.y}`}
                href={sprite(`terrain_${t.terrain}`)}
                x={cx - TW / 2 - 1}
                y={cy - TH / 2 - 0.5}
                width={TW + 2}
                height={TH + 1}
                preserveAspectRatio="none"
              />
            );
          })}

          {/* 2) 영토(옅은 채색 + 국경선) · 시설 · 바닥 하이라이트. 클릭은 투명 마름모가 받는다 */}
          {sortedTiles.map((t) => {
            const { cx, cy } = c(t.x, t.y);
            const k = key(t.x, t.y);
            const owner = t.owner_id ? colorOf.get(t.owner_id) : undefined;
            const isSel = selection?.kind === 'tile' && selection.x === t.x && selection.y === t.y;
            return (
              <g key={`o${k}`} onClick={() => onTileClick(t.x, t.y)} className="cursor-pointer">
                <polygon points={diamond(cx, cy)} fill={owner ?? '#000'} fillOpacity={owner ? 0.13 : 0} />
                {owner &&
                  EDGES.filter(([dx, dy]) => tileIndex.get(key(t.x + dx, t.y + dy))?.owner_id !== t.owner_id).map(([, , a, b]) => {
                    const [x1, y1] = vertex(cx, cy, a), [x2, y2] = vertex(cx, cy, b);
                    return (
                      <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} stroke={owner} strokeWidth={1.8} strokeLinecap="round" strokeDasharray="5 2" pointerEvents="none" />
                    );
                  })}
                {t.improvement && !t.is_city && (
                  <text x={cx} y={cy + 4} textAnchor="middle" fontSize={10} pointerEvents="none">
                    {IMPROVEMENT_ICON[t.improvement]}
                  </text>
                )}
                {combatTiles.has(k) && (
                  <polygon points={diamond(cx, cy, 3)} fill="#ef4444" fillOpacity={0.18} stroke="#ef4444" strokeOpacity={0.6} strokeWidth={1} pointerEvents="none" />
                )}
                {targets?.moves.has(k) && <polygon points={diamond(cx, cy, 2)} fill="#facc15" fillOpacity={0.3} pointerEvents="none" />}
                {targets?.attacks.has(k) && <polygon points={diamond(cx, cy, 2)} fill="#ef4444" fillOpacity={0.42} pointerEvents="none" />}
                {isSel && <polygon points={diamond(cx, cy, 1)} fill="#fff" fillOpacity={0.22} pointerEvents="none" />}
              </g>
            );
          })}

          {/* 3) 도시 · 유닛 (Y-sort, 타일 바닥 위에 서 있도록 발밑 기준으로 위로 올려 그린다) */}
          {drawables.map((d) => {
            if (d.kind === 'city') {
              const t = d.t;
              const { cx, cy } = c(t.x, t.y);
              const owner = t.owner_id ? colorOf.get(t.owner_id) : '#888';
              const w = t.is_capital ? CITY_W + 6 : CITY_W;
              return (
                <g key={`c${t.x},${t.y}`} pointerEvents="none">
                  <ellipse cx={cx} cy={cy + 3} rx={TW / 2.3} ry={TH / 2.6} fill="url(#foot-shadow)" />
                  <image href={sprite(t.is_capital ? 'capital' : 'city')} x={cx - w / 2} y={cy - w * 0.8 + 4} width={w} height={w} />
                  <g transform={`translate(${cx},${cy + TH / 2 - 1})`}>
                    <rect x={-25} y={-8} width={50} height={11} rx={2} fill={owner} fillOpacity={0.92} stroke="#1c1917" strokeWidth={0.6} />
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
            // 도시 위의 수비대는 오른쪽 앞으로 비켜 선다
            const ox = onCity ? 14 : 0, oy = onCity ? 5 : 2;
            return (
              <g key={u.id} transform={`translate(${cx + ox},${cy + oy})`} pointerEvents="none">
                {/* 발밑: 선택 시 빛나는 타원, 평소엔 옅은 그림자 */}
                {sel ? (
                  <ellipse cx={0} cy={0} rx={17} ry={7} fill="url(#select-glow)" stroke="#fde047" strokeWidth={1} strokeOpacity={0.9} />
                ) : (
                  <ellipse cx={0} cy={0} rx={12} ry={4.5} fill="url(#foot-shadow)" />
                )}
                {/* 명령 대기 중인 내 유닛: 발밑 펄스 */}
                {idle.has(u.id) && !sel && (
                  <ellipse cx={0} cy={0} rx={12} ry={5} fill="none" stroke="#fde047" strokeWidth={1.4}>
                    <animate attributeName="rx" values="10;17;10" dur="1.6s" repeatCount="indefinite" />
                    <animate attributeName="ry" values="4;7;4" dur="1.6s" repeatCount="indefinite" />
                    <animate attributeName="stroke-opacity" values="0.9;0;0.9" dur="1.6s" repeatCount="indefinite" />
                  </ellipse>
                )}
                <image href={sprite(`unit_${u.kind}`)} x={-UNIT_H / 2} y={-UNIT_H + 3} width={UNIT_H} height={UNIT_H} />
                {/* 진영 깃발 */}
                <line x1={-13} y1={-4} x2={-13} y2={-27} stroke="#3f3f46" strokeWidth={1} />
                <path d="M-13,-27 h9 l-2.5,3.5 l2.5,3.5 h-9 z" fill={color} stroke="#1c1917" strokeWidth={0.5} />
                {/* 체력 */}
                {u.hp < 100 && (
                  <>
                    <rect x={-10} y={4} width={20} height={2.6} rx={1} fill="#000" fillOpacity={0.7} />
                    <rect x={-10} y={4} width={(20 * u.hp) / 100} height={2.6} rx={1} fill={u.hp > 50 ? '#22c55e' : u.hp > 25 ? '#f59e0b' : '#ef4444'} />
                  </>
                )}
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
              return <text key={i} x={cx + 10} y={cy - 22} fontSize={11} pointerEvents="none">🏗️</text>;
            }
            if (a.type === 'produce' || a.type === 'build') {
              const { cx, cy } = c(a.x, a.y);
              return (
                <text key={i} x={cx - 22} y={cy + 4} fontSize={10} pointerEvents="none">
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
