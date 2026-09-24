import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { devPlayerSuffix, supabase } from './lib/supabase';
import { HomeScreen, NicknameScreen } from './components/HomeScreen';
import { LobbyScreen } from './components/LobbyScreen';
import { GameScreen } from './components/GameScreen';
import { LeaderboardScreen } from './components/LeaderboardScreen';

const ROOM_KEY = `history-civ:room${devPlayerSuffix}`;

function readRoom(): string | null {
  try {
    return sessionStorage.getItem(ROOM_KEY);
  } catch {
    return null;
  }
}

function writeRoom(id: string | null) {
  try {
    if (id) sessionStorage.setItem(ROOM_KEY, id);
    else sessionStorage.removeItem(ROOM_KEY);
  } catch {
    /* 무시 */
  }
}

export default function App() {
  const { userId, nickname, setNickname, error } = useAuth();
  const [roomId, setRoomId] = useState<string | null>(readRoom);
  const [phase, setPhase] = useState<'lobby' | 'game' | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const enterRoom = useCallback((id: string | null) => {
    writeRoom(id);
    setRoomId(id);
    setPhase(null);
  }, []);

  // 새로고침 후 재입장: 방 상태로 대기실/게임 화면을 고른다.
  useEffect(() => {
    if (!roomId || !userId || phase) return;
    supabase
      .from('hc_rooms')
      .select('status')
      .eq('id', roomId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) enterRoom(null);
        else setPhase(data.status === 'waiting' ? 'lobby' : 'game');
      });
  }, [roomId, userId, phase, enterRoom]);

  const onStarted = useCallback(() => setPhase('game'), []);

  if (error) return <p className="p-8 text-red-400">{error}</p>;
  if (!userId) return <p className="p-8 text-stone-400">접속 중…</p>;
  if (showLeaderboard) return <LeaderboardScreen userId={userId} onBack={() => setShowLeaderboard(false)} />;
  if (!nickname) return <NicknameScreen onSubmit={setNickname} />;
  if (!roomId) return <HomeScreen nickname={nickname} onEnterRoom={enterRoom} onLeaderboard={() => setShowLeaderboard(true)} />;
  if (phase === 'lobby')
    return <LobbyScreen roomId={roomId} userId={userId} onStarted={onStarted} onLeft={() => enterRoom(null)} />;
  if (phase === 'game') return (
      <GameScreen
        roomId={roomId}
        userId={userId}
        onExit={() => enterRoom(null)}
        onLeaderboard={() => setShowLeaderboard(true)}
      />
    );
  return <p className="p-8 text-stone-400">방 정보를 불러오는 중…</p>;
}
