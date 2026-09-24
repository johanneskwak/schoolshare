// 개발 전용(?demo): 로그인/서버 없이 맵과 명령 UI를 확인하는 화면. 프로덕션 빌드에는 포함되지 않는다.
import { useEffect } from 'react';
import { GameMap } from '../components/GameMap';
import { CommandPanel } from '../components/CommandPanel';
import { useGameStore } from '../store/gameStore';
import type { GameSnapshot, Terrain, Tile, Unit } from '../types/game';

const ME = 'demo-me';
const FOE = 'demo-foe';

function buildSnapshot(): GameSnapshot {
  const W = 16, H = 12;
  const terrains: Terrain[] = ['plains', 'grassland', 'forest', 'hills', 'plains', 'grassland', 'water', 'mountain'];
  const tiles: Tile[] = [];
  for (let x = 0; x < W; x++)
    for (let y = 0; y < H; y++) {
      const t = terrains[(x * 7 + y * 13 + x * y) % terrains.length]!;
      const mine = Math.max(Math.abs(x - 2), Math.abs(y - 2)) <= 1;
      const foe = Math.max(Math.abs(x - 13), Math.abs(y - 9)) <= 1;
      tiles.push({
        x, y,
        terrain: mine || foe ? 'plains' : t,
        owner_id: mine ? ME : foe ? FOE : null,
        is_city: (x === 2 && y === 2) || (x === 13 && y === 9),
        is_capital: (x === 2 && y === 2) || (x === 13 && y === 9),
        city_name: x === 2 && y === 2 ? '파리' : x === 13 && y === 9 ? '런던' : null,
        city_pop: (x === 2 && y === 2) || (x === 13 && y === 9) ? 1 : 0,
        improvement: x === 3 && y === 3 ? 'farm' : null,
      });
    }
  const u = (id: string, owner: string, kind: Unit['kind'], x: number, y: number, moves: number, hp = 100): Unit =>
    ({ id, owner_id: owner, kind, x, y, hp, moves_left: moves, created_turn: 1 });
  const units = [
    u('00000000-0000-0000-0000-000000000001', ME, 'settler', 3, 2, 2),
    u('00000000-0000-0000-0000-000000000002', ME, 'militia', 2, 2, 2),
    u('00000000-0000-0000-0000-000000000003', ME, 'cavalry', 10, 8, 3),
    u('00000000-0000-0000-0000-000000000004', ME, 'artillery', 11, 9, 1),
    u('00000000-0000-0000-0000-000000000005', FOE, 'line_infantry', 13, 9, 1, 60),
    u('00000000-0000-0000-0000-000000000006', FOE, 'line_infantry', 12, 8, 1),
  ];
  const now = new Date();
  return {
    server_now: now.toISOString(),
    room: {
      id: 'demo', code: 'DEMO01', host_id: ME, status: 'playing', max_players: 2, map_width: W, map_height: H,
      turn_number: 3, turn_seconds: 60, turn_deadline: new Date(now.getTime() + 45_000).toISOString(), max_turns: 60,
      winner_id: null, victory: null, is_solo: false, created_at: '', updated_at: '',
    },
    players: [
      { room_id: 'demo', user_id: ME, nickname: '나', seat: 0, faction: 'france', is_ready: true, has_ended_turn: false,
        is_eliminated: false, is_ai: false, gold: 40, food: 3, hammer: 45, innovation: 4, ideology: 12, research_target: 'enlightenment',
        research_progress: 8, researched: ['steam_engine'], score: 20, joined_at: '' },
      { room_id: 'demo', user_id: FOE, nickname: '상대', seat: 1, faction: 'britain', is_ready: true, has_ended_turn: true,
        is_eliminated: false, is_ai: false, gold: 30, food: 1, hammer: 30, innovation: 6, ideology: 2, research_target: null,
        research_progress: 0, researched: [], score: 18, joined_at: '' },
    ],
    tiles,
    units,
    my_actions: [],
    last_log: [{ type: 'combat', x: 12, y: 8 }, { type: 'tech_researched', tech: 'steam_engine' }],
  };
}

export function DemoScreen() {
  const snapshot = useGameStore((s) => s.snapshot);
  useEffect(() => {
    useGameStore.getState().setSnapshot(buildSnapshot(), 0);
  }, []);
  if (!snapshot) return null;
  const me = snapshot.players[0]!;
  return (
    <div className="mx-auto max-w-7xl px-4 py-4">
      <p className="mb-2 text-sm text-amber-400">데모 모드 — 서버와 연결되지 않은 화면입니다.</p>
      <div className="grid gap-3 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          <GameMap snapshot={snapshot} userId={ME} canAct />
        </div>
        <CommandPanel snapshot={snapshot} me={me} canAct />
      </div>
    </div>
  );
}
