// 서버 RPC 래퍼. 게임 상태를 바꾸는 유일한 경로.
import { supabase } from './supabase';
import type { Action, Faction, GameSnapshot, Room } from '../types/game';

const ERROR_MESSAGES: Record<string, string> = {
  NO_PROFILE: '닉네임을 먼저 정해 주세요.',
  ROOM_NOT_FOUND: '방 코드를 찾을 수 없어요.',
  ROOM_ALREADY_STARTED: '이미 시작된 방이에요.',
  ROOM_FULL: '방이 가득 찼어요.',
  NOT_HOST: '방장만 시작할 수 있어요.',
  ALREADY_STARTED: '이미 시작되었어요.',
  NEED_2_PLAYERS: '2명 이상 모여야 시작할 수 있어요.',
  NOT_ALL_READY: '모든 참가자가 준비해야 해요.',
  ROOM_NOT_PLAYING: '진행 중인 게임이 아니에요.',
  NOT_MEMBER: '이 방의 참가자가 아니에요.',
  INVALID_ACTIONS: '잘못된 명령이 포함되어 있어요.',
  TURN_ALREADY_ENDED: '이미 턴을 종료했어요.',
  EVENT_NOT_PENDING: '이미 결정된 사건이에요.',
  INVALID_CHOICE: '잘못된 선택이에요.',
  INVALID_AI_COUNT:'AI는 1~3명까지 고를 수 있어요.',
};

export class GameApiError extends Error {
  constructor(public code: string) {
    super(ERROR_MESSAGES[code] ?? code);
  }
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new GameApiError(error.message);
  return data as T;
}

export const api = {
  ensureProfile: (nickname: string) => rpc<void>('hc_ensure_profile', { p_nickname: nickname }),

  createRoom: (faction: Faction, maxPlayers = 4, turnSeconds = 60) =>
    rpc<Room>('hc_create_room', { p_faction: faction, p_max_players: maxPlayers, p_turn_seconds: turnSeconds }),
  joinRoom: (code: string, faction: Faction) => rpc<string>('hc_join_room', { p_code: code, p_faction: faction }),
  updateLobbyState: (roomId: string, ready: boolean, faction?: Faction) =>
    rpc<void>('hc_update_lobby_state', { p_room: roomId, p_ready: ready, p_faction: faction ?? null }),
  leaveRoom: (roomId: string) => rpc<void>('hc_leave_room', { p_room: roomId }),
  startGame: (roomId: string) => rpc<void>('hc_start_game', { p_room: roomId }),
  createSoloGame: (faction: Faction, aiCount: number, turnSeconds: number) =>
    rpc<string>('hc_create_solo_game', { p_faction: faction, p_ai_count: aiCount, p_turn_seconds: turnSeconds }),

  getGameState: (roomId: string) => rpc<GameSnapshot>('hc_get_game_state', { p_room: roomId }),
  submitActions: (roomId: string, actions: Action[]) =>
    rpc<void>('hc_submit_actions', { p_room: roomId, p_actions: actions }),
  endTurn: (roomId: string, actions: Action[]) => rpc<number>('hc_end_turn', { p_room: roomId, p_actions: actions }),
  cancelEndTurn: (roomId: string) => rpc<void>('hc_cancel_end_turn', { p_room: roomId }),
  chooseEvent: (roomId: string, eventId: number, choice: 'a' | 'b') =>
    rpc<unknown>('hc_choose_event', { p_room: roomId, p_event: eventId, p_choice: choice }),
  tryResolveTurn: (roomId: string, turn: number) =>
    rpc<boolean>('hc_try_resolve_turn', { p_room: roomId, p_turn: turn }),
};
