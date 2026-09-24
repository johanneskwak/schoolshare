import { useMemo } from 'react';
import { indexTiles, key, TERRAIN, UNIT_TYPES, unitTargets } from '../lib/rules';
import { useGameStore } from '../store/gameStore';
import { FACTIONS, type GameSnapshot } from '../types/game';

const S = 44; // 타일 한 변(px, viewBox 단위)

const IMPROVEMENT_ICON = { farm: '🌾', port: '⚓', railway: '🛤️', factory: '🏭' } as const;

/** SVG 타일 맵. 클릭 규칙: 내 유닛 → 선택, 선택 중 이동/공격 가능 칸 → 명령, 그 외 칸 → 칸 선택. */
export function GameMap({ snapshot, userId, canAct }: { snapshot: GameSnapshot; userId: string; canAct: boolean }) {
  const { room, tiles, units, players } = snapshot;
  const selection = useGameStore((s) => s.selection);
  const pending = useGameStore((s) => s.pending);
  const select = useGameStore((s) => s.select);
  const queueAction = useGameStore((s) => s.queueAction);

  const tileIndex = useMemo(() => indexTiles(tiles), [tiles]);
  const colorOf = useMemo(
    () => new Map(players.map((p) => [p.user_id, FACTIONS[p.faction].color])),
    [players],
  );
  const unitAt = useMemo(() => new Map(units.map((u) => [key(u.x, u.y), u])), [units]);
  const selectedUnit = selection?.kind === 'unit' ? units.find((u) => u.id === selection.id) : undefined;
  const targets = useMemo(
    () => (selectedUnit && canAct ? unitTargets(selectedUnit, tileIndex, units) : null),
    [selectedUnit, canAct, tileIndex, units],
  );

  // 지난 턴 전투가 난 칸 (정산 결과 표시)
  const combatTiles = useMemo(
    () =>
      new Set(
        (snapshot.last_log ?? [])
          .filter((e) => e.type === 'combat')
          .map((e) => key(e.x as number, e.y as number)),
      ),
    [snapshot.last_log],
  );

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

  const unitById = new Map(units.map((u) => [u.id, u]));

  return (
    <svg
      viewBox={`0 0 ${room.map_width * S} ${room.map_height * S}`}
      className="h-auto w-full select-none rounded-lg"
      role="grid"
      aria-label="게임 맵"
    >
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#fde047" />
        </marker>
      </defs>

      {tiles.map((t) => {
        const k = key(t.x, t.y);
        const owner = t.owner_id ? colorOf.get(t.owner_id) : undefined;
        const isSelTile = selection?.kind === 'tile' && selection.x === t.x && selection.y === t.y;
        return (
          <g key={k} transform={`translate(${t.x * S},${t.y * S})`} onClick={() => onTileClick(t.x, t.y)} className="cursor-pointer">
            <rect width={S} height={S} fill={TERRAIN[t.terrain].color} stroke="#00000033" strokeWidth={1} />
            {owner && <rect x={2} y={2} width={S - 4} height={S - 4} fill={owner} fillOpacity={0.18} stroke={owner} strokeWidth={2} strokeOpacity={0.8} />}
            {t.terrain === 'mountain' && <text x={S / 2} y={S / 2 + 6} textAnchor="middle" fontSize={18}>⛰️</text>}
            {t.terrain === 'hills' && <text x={6} y={14} fontSize={10} opacity={0.7}>⌒</text>}
            {t.terrain === 'forest' && <text x={4} y={14} fontSize={10}>🌲</text>}
            {t.improvement && !t.is_city && <text x={S - 14} y={14} fontSize={10}>{IMPROVEMENT_ICON[t.improvement]}</text>}
            {t.is_city && (
              <>
                <rect x={6} y={6} width={S - 12} height={S - 12} rx={4} fill={owner ?? '#555'} stroke="#fff" strokeWidth={2} />
                <text x={S / 2} y={S / 2 + 5} textAnchor="middle" fontSize={14}>{t.is_capital ? '★' : '🏠'}</text>
                <text x={S / 2} y={S - 2} textAnchor="middle" fontSize={8} fill="#fff" stroke="#000" strokeWidth={2} paintOrder="stroke">
                  {t.city_name} {t.city_pop}
                </text>
              </>
            )}
            {combatTiles.has(k) && <rect width={S} height={S} fill="none" stroke="#ef4444" strokeWidth={3} strokeDasharray="4 3" />}
            {targets?.moves.has(k) && <rect width={S} height={S} fill="#facc15" fillOpacity={0.35} />}
            {targets?.attacks.has(k) && <rect width={S} height={S} fill="#ef4444" fillOpacity={0.45} />}
            {isSelTile && <rect x={1} y={1} width={S - 2} height={S - 2} fill="none" stroke="#fff" strokeWidth={3} />}
          </g>
        );
      })}

      {units.map((u) => {
        const t = UNIT_TYPES[u.kind];
        const color = colorOf.get(u.owner_id) ?? '#999';
        const sel = selectedUnit?.id === u.id;
        return (
          <g
            key={u.id}
            transform={`translate(${u.x * S + S / 2},${u.y * S + S / 2})`}
            onClick={() => onTileClick(u.x, u.y)}
            className="cursor-pointer"
          >
            <circle r={15} fill={color} stroke={sel ? '#fde047' : '#fff'} strokeWidth={sel ? 4 : 2} />
            <text y={5} textAnchor="middle" fontSize={15}>{t.icon}</text>
            <rect x={-14} y={16} width={28} height={4} fill="#000" fillOpacity={0.6} />
            <rect x={-14} y={16} width={(28 * u.hp) / 100} height={4} fill={u.hp > 50 ? '#22c55e' : '#ef4444'} />
            {u.owner_id === userId && u.moves_left === 0 && <circle cx={13} cy={-13} r={4} fill="#6b7280" />}
          </g>
        );
      })}

      {/* 이번 턴에 내린 명령 */}
      {pending.map((a, i) => {
        if (a.type === 'move') {
          const u = unitById.get(a.unit_id);
          if (!u) return null;
          const attack = unitAt.get(key(a.x, a.y))?.owner_id !== undefined && unitAt.get(key(a.x, a.y))?.owner_id !== userId;
          return (
            <line
              key={i}
              x1={u.x * S + S / 2}
              y1={u.y * S + S / 2}
              x2={a.x * S + S / 2}
              y2={a.y * S + S / 2}
              stroke={attack ? '#ef4444' : '#fde047'}
              strokeWidth={3}
              strokeDasharray={attack ? '6 3' : undefined}
              markerEnd="url(#arrow)"
              pointerEvents="none"
            />
          );
        }
        if (a.type === 'found_city') {
          const u = unitById.get(a.unit_id);
          if (!u) return null;
          return <text key={i} x={u.x * S + S - 10} y={u.y * S + 12} fontSize={12} pointerEvents="none">🏗️</text>;
        }
        if (a.type === 'produce' || a.type === 'build') {
          return <text key={i} x={a.x * S + 2} y={a.y * S + S - 4} fontSize={11} pointerEvents="none">{a.type === 'produce' ? '🔨' : '🧱'}</text>;
        }
        return null;
      })}
    </svg>
  );
}
