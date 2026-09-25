// 개발 전용(?demo): 로그인/서버 없이 맵과 명령 UI를 확인하는 화면. 프로덕션 빌드에는 포함되지 않는다.
import { useEffect, useState } from 'react';
import { GameMap } from '../components/GameMap';
import { CommandPanel } from '../components/CommandPanel';
import { EventModal } from '../components/EventModal';
import { GuidePanel } from '../components/GuidePanel';
import { LeaderPanel } from '../components/LeaderPanel';
import { UnitHud } from '../components/UnitHud';
import { WonderHud } from '../components/WonderHud';
import { computeGuide } from '../lib/guide';
import { combatFx, useFxQueue, type UnitActions } from '../hooks/useUnitActions';
import { leadersOf } from '../lib/leaders';
import { indexTiles, key } from '../lib/rules';
import { previewCombat, UPGRADES } from '../lib/units';
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
        improvement: x === 3 && y === 3 ? 'farm' : null, city_hp: 100,
      });
    }
  const u = (id: string, owner: string, kind: Unit['kind'], x: number, y: number, moves: number, hp = 100): Unit =>
    ({ id, owner_id: owner, kind, x, y, hp, moves_left: moves, created_turn: 1, acted: false, fortified: false });
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
      winner_id: null, victory: null, is_solo: false, difficulty: 'normal', action_seq: 0, created_at: '', updated_at: '',
    },
    players: [
      { room_id: 'demo', user_id: ME, nickname: '나', seat: 0, faction: 'france', is_ready: true, has_ended_turn: false,
        is_eliminated: false, is_ai: false, stability: 60, gold: 40, food: 3, hammer: 45, innovation: 4, ideology: 12, research_target: 'enlightenment',
        research_progress: 8, researched: ['steam_engine'], score: 20, joined_at: '' },
      { room_id: 'demo', user_id: FOE, nickname: '상대', seat: 1, faction: 'britain', is_ready: true, has_ended_turn: true,
        is_eliminated: false, is_ai: false, stability: 60, gold: 30, food: 1, hammer: 30, innovation: 6, ideology: 2, research_target: null,
        research_progress: 0, researched: [], score: 18, joined_at: '' },
    ],
    tiles,
    units,
    my_actions: [],
    last_log: [{ type: 'combat', x: 12, y: 8 }, { type: 'tech_researched', tech: 'steam_engine' }],
    scholars: [
      {
        id: 'voltaire', faction: 'france', ord: 1, name: '볼테르', era: '18세기 계몽사상가', icon: '🖋️',
        works: '《철학 서한》(1734) · 《관용론》(1763)',
        significance: '이성과 종교적 관용, 표현의 자유를 주장하며 절대 왕정과 교회의 권위를 비판했습니다.',
        effect: '혁신 +3/턴 (연구 가속)', player_id: ME, joined_turn: 2, seen: true,
      },
    ],
    wonders: [{ wonder_id: 'big_ben', player_id: FOE, x: 13, y: 9, built_turn: 1, turns_left: 8, name_ko: '빅벤', icon: '🕰️' }],
    year: 1760, buildings: [{ x: 4, y: 4, building_id: 'library', built_turn: 2 }], conditions: [],
    leaders: [
      { leader_id: 'napoleon', player_id: ME, joined_turn: 2 },
      { leader_id: 'watt', player_id: FOE, joined_turn: 3 },
    ],
    my_events: [
      {
        pe_id: 1, id: 'luddite', turn: 3, title: '러다이트 운동', era: '1811년', icon: '⚙️',
        body: '"기계가 우리 일자리를 빼앗는다!" 방직 노동자들이 밤마다 공장에 몰려가 새로 들인 기계를 부수고 있습니다.',
        choice_a_label: '기계 파괴 진압', choice_a_desc: '군대를 보내 진압한다 · 안정도 -15, 공장 가동 유지(망치 +10)',
        choice_b_label: '노동 조건 개선', choice_b_desc: '임금과 노동 시간을 개선한다 · 골드 -20, 혁명 이념 +10, 안정도 +15',
      },
    ],
  };
}

/** 서버 없이 즉시 행동을 흉내 내는 데모용 UnitActionController (같은 전투식 사용) */
function useLocalActions(): UnitActions {
  const showFx = useFxQueue();
  const patch = (fn: (s: GameSnapshot) => GameSnapshot) => {
    const st = useGameStore.getState();
    if (st.snapshot) st.setSnapshot(fn(st.snapshot), 0);
  };
  const mapUnit = (id: string, f: (u: Unit) => Unit) => patch((s) => ({ ...s, units: s.units.map((u) => (u.id === id ? f(u) : u)) }));
  return {
    busy: false,
    error: null,
    clearError: () => undefined,
    move: async (u, x, y) => {
      mapUnit(u.id, (v) => ({ ...v, x, y, moves_left: v.moves_left - Math.max(Math.abs(x - v.x), Math.abs(y - v.y)), fortified: false }));
      useGameStore.getState().select({ kind: 'unit', id: u.id });
    },
    attack: async (u, x, y) => {
      const s = useGameStore.getState().snapshot!;
      const d = s.units.find((v) => v.x === x && v.y === y)!;
      const p = previewCombat(u, d, indexTiles(s.tiles).get(key(x, y))!, leadersOf(s.leaders, u.owner_id));
      const ahp = Math.max(0, u.hp - p.dmgAtt), dhp = Math.max(0, d.hp - p.dmgDef);
      patch((snap) => ({
        ...snap,
        units: snap.units
          .map((v) => (v.id === u.id ? { ...v, hp: ahp, acted: true, moves_left: 0 } : v.id === d.id ? { ...v, hp: dhp } : v))
          .filter((v) => v.hp > 0),
      }));
      showFx(combatFx({ from: [u.x, u.y], at: [x, y], dmg_att: p.dmgAtt, dmg_def: p.dmgDef, attacker_hp: ahp, defender_hp: dhp }));
    },
    foundCity: async (u) => {
      patch((s) => ({
        ...s,
        units: s.units.filter((v) => v.id !== u.id),
        tiles: s.tiles.map((t) => (t.x === u.x && t.y === u.y ? { ...t, is_city: true, city_name: '리옹', city_pop: 1, owner_id: u.owner_id } : t)),
      }));
      showFx([{ x: u.x, y: u.y, text: '도시 건설!', kind: 'info' }]);
    },
    rest: async (u, mode) => {
      mapUnit(u.id, (v) => ({ ...v, acted: true, fortified: mode === 'fortify', hp: mode === 'heal' ? Math.min(100, v.hp + 25) : v.hp, moves_left: mode === 'wait' ? v.moves_left : 0 }));
      useGameStore.getState().select(null);
    },
    buildWonder: async () => undefined,
    buildBuilding: async () => undefined,
    upgrade: async (u) => mapUnit(u.id, (v) => ({ ...v, kind: UPGRADES[v.kind]!.to, acted: true, moves_left: 0 })),
  };
}

export function DemoScreen() {
  const actions = useLocalActions();
  const snapshot = useGameStore((s) => s.snapshot);
  const pending = useGameStore((s) => s.pending);
  const select = useGameStore((s) => s.select);
  const [showEvent, setShowEvent] = useState(true);
  useEffect(() => {
    useGameStore.getState().setSnapshot(buildSnapshot(), 0);
  }, []);
  if (!snapshot) return null;
  const me = snapshot.players[0]!;
  const events = showEvent ? snapshot.my_events : [];
  const guide = computeGuide({ ...snapshot, my_events: events }, me, pending);
  return (
    <div className="mx-auto max-w-[1500px] px-4 py-4">
      <p className="mb-2 text-sm text-amber-400">데모 모드 — 서버와 연결되지 않은 화면입니다.</p>
      <div className="mb-2 rounded-lg bg-stone-800 p-2">
        <WonderHud snapshot={snapshot} userId={ME} />
      </div>
      <div className="grid gap-3 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0">
          <GameMap snapshot={snapshot} userId={ME} canAct idleUnitIds={guide.idleUnitIds} actions={actions} />
          <div className="mt-2">
            <UnitHud snapshot={snapshot} userId={ME} canAct actions={actions} />
          </div>
        </div>
        <aside className="space-y-3">
          <GuidePanel
            guide={guide}
            me={me}
            canAct
            onFocus={() => guide.focus && guide.focus.kind !== 'research' && guide.focus.kind !== 'event' && select(guide.focus)}
            onEndTurn={() => undefined}
            onCancelEndTurn={() => undefined}
          />
          <CommandPanel snapshot={snapshot} me={me} canAct actions={actions} />
          <LeaderPanel holders={snapshot.leaders} players={snapshot.players} meId={ME} scholars={snapshot.scholars} />
        </aside>
      </div>
      {events[0] && <EventModal event={events[0]} onChoose={async () => setShowEvent(false)} onLater={() => setShowEvent(false)} />}
    </div>
  );
}
