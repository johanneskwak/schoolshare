import { useState } from 'react';
import { api } from '../lib/api';
import { DIFFICULTIES } from '../lib/chronicle';
import { FACTIONS, type Difficulty, type Faction } from '../types/game';

const PAINTING =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Eug%C3%A8ne_Delacroix_-_La_libert%C3%A9_guidant_le_peuple.jpg/1920px-Eug%C3%A8ne_Delacroix_-_La_libert%C3%A9_guidant_le_peuple.jpg';

/** 첫 화면 배경: 들라크루아 《민중을 이끄는 자유의 여신》(1830, 퍼블릭 도메인) 켄 번스 줌 + 비네팅 */
function LobbyBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none">
      <div className="lobby-painting" style={{ backgroundImage: `url("${PAINTING}")` }} />
      <div className="lobby-vignette" />
    </div>
  );
}

function LobbyTitle({ small = false }: { small?: boolean }) {
  return (
    <div className="text-center">
      <div className="font-cinzel text-xs tracking-[0.5em] text-amber-200/70">CIVILIZATION OF REVOLUTIONS</div>
      <h1 className={`font-serif-kr gold-text font-extrabold ${small ? 'text-3xl' : 'text-5xl sm:text-6xl'}`}>역사 문명전</h1>
      <p className="font-serif-kr mt-2 text-amber-100/85 sm:text-lg">1750년 혁명의 서막에서 4차 산업혁명까지, 역사를 당신의 손으로</p>
    </div>
  );
}

const PAINTING_CREDIT = (
  <p className="relative text-center text-[11px] text-amber-100/40">
    배경: 외젠 들라크루아, 《민중을 이끄는 자유의 여신》(1830) · 퍼블릭 도메인 (Wikimedia Commons)
  </p>
);

export function FactionPicker({ value, onChange }: { value: Faction; onChange: (f: Faction) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {(Object.keys(FACTIONS) as Faction[]).map((f) => (
        <button
          key={f}
          type="button"
          onClick={() => onChange(f)}
          className={`rounded-lg border p-3 text-left backdrop-blur-sm transition ${
            value === f ? 'border-amber-400 bg-amber-950/70 ring-1 ring-amber-400' : 'border-amber-900/60 bg-stone-950/60 hover:bg-stone-900/80'
          }`}
        >
          <div className="font-serif-kr font-bold" style={{ color: FACTIONS[f].color }}>
            {FACTIONS[f].name}
          </div>
          <div className="mt-1 text-xs text-stone-300">{FACTIONS[f].desc}</div>
        </button>
      ))}
    </div>
  );
}

export function NicknameScreen({ onSubmit }: { onSubmit: (name: string) => Promise<void> }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="relative min-h-screen">
      <LobbyBackdrop />
      <form
        className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(name).catch((err: Error) => setError(err.message));
        }}
      >
        <LobbyTitle />
        <div className="brass-panel space-y-3 rounded-lg p-5">
          <input
            className="font-serif-kr w-full rounded border border-amber-900/70 bg-stone-950/70 px-3 py-2 text-amber-50 placeholder:text-amber-100/40"
            placeholder="닉네임 (1~20자)"
            maxLength={20}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="brass-btn w-full py-2.5 text-lg">역사 속으로</button>
          {error && <p className="text-red-400">{error}</p>}
        </div>
        {PAINTING_CREDIT}
      </form>
    </div>
  );
}

export function HomeScreen({
  nickname,
  onEnterRoom,
  onLeaderboard,
}: {
  nickname: string;
  onEnterRoom: (roomId: string) => void;
  onLeaderboard: () => void;
}) {
  const [faction, setFaction] = useState<Faction>('france');
  const [code, setCode] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [turnSeconds, setTurnSeconds] = useState(60);
  const [aiCount, setAiCount] = useState(2);
  const [soloSeconds, setSoloSeconds] = useState(120);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setError(null);
    try {
      onEnterRoom(await fn());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen">
    <LobbyBackdrop />
    <div className="relative mx-auto max-w-4xl space-y-6 px-4 py-10">
      <LobbyTitle small />
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif-kr text-xl font-bold text-amber-50">{nickname}님, 어느 문명을 이끌까요?</h2>
        <button onClick={onLeaderboard} className="shrink-0 rounded border border-amber-700 bg-stone-950/60 px-3 py-1.5 text-sm text-amber-100">
          🏅 리더보드
        </button>
      </div>
      <FactionPicker value={faction} onChange={setFaction} />

      <section className="brass-panel space-y-3 rounded-lg p-4">
        <h2 className="font-serif-kr font-bold text-amber-200">방 만들기</h2>
        <div className="flex flex-wrap gap-4 text-sm">
          <label>
            인원{' '}
            <select className="rounded bg-stone-700 px-2 py-1" value={maxPlayers} onChange={(e) => setMaxPlayers(+e.target.value)}>
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>{n}명</option>
              ))}
            </select>
          </label>
          <label>
            턴 시간{' '}
            <select className="rounded bg-stone-700 px-2 py-1" value={turnSeconds} onChange={(e) => setTurnSeconds(+e.target.value)}>
              {[30, 60, 90, 120, 0].map((n) => (
                <option key={n} value={n}>{n === 0 ? '시간 무제한' : `${n}초`}</option>
              ))}
            </select>
          </label>
        </div>
        <button
          disabled={busy}
          onClick={() => run(async () => (await api.createRoom(faction, maxPlayers, turnSeconds)).id)}
          className="brass-btn px-5 py-2"
        >
          방 만들기
        </button>
      </section>

      <section className="brass-panel space-y-3 rounded-lg p-4 ring-1 ring-emerald-700/60">
        <h2 className="font-serif-kr font-bold text-amber-200">🤖 혼자 하기 (AI 대전)</h2>
        <p className="text-xs text-stone-400">
          1750년에서 시작해 한 턴에 5년씩 흐릅니다. {DIFFICULTIES[difficulty].desc}.
          <br />
          AI 문명과 바로 대결합니다. 턴 종료를 누르면 AI가 즉시 움직여요. AI 대전 결과는 리더보드에 기록되지 않습니다.
        </p>
        <div className="flex flex-wrap gap-4 text-sm">
          <label>
            AI 상대{' '}
            <select className="rounded bg-stone-700 px-2 py-1" value={aiCount} onChange={(e) => setAiCount(+e.target.value)}>
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>{n}명</option>
              ))}
            </select>
          </label>
          <label>
            턴 시간{' '}
            <select className="rounded bg-stone-700 px-2 py-1" value={soloSeconds} onChange={(e) => setSoloSeconds(+e.target.value)}>
              {[60, 120, 300, 0].map((n) => (
                <option key={n} value={n}>{n === 0 ? '시간 무제한' : n === 300 ? '5분' : n === 120 ? '2분' : `${n}초`}</option>
              ))}
            </select>
          </label>
          <label>
            난이도{' '}
            <select className="rounded bg-stone-700 px-2 py-1" value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
              {(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => (
                <option key={d} value={d}>{DIFFICULTIES[d].name}</option>
              ))}
            </select>
          </label>
        </div>
        <button
          disabled={busy}
          onClick={() => run(() => api.createSoloGame(faction, aiCount, soloSeconds, difficulty))}
          className="brass-btn px-5 py-2"
        >
          AI와 게임 시작
        </button>
      </section>

      <section className="brass-panel space-y-3 rounded-lg p-4">
        <h2 className="font-serif-kr font-bold text-amber-200">참가 코드로 입장</h2>
        <div className="flex gap-2">
          <input
            className="w-40 rounded bg-stone-700 px-3 py-2 font-mono uppercase tracking-widest"
            placeholder="ABC123"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <button
            disabled={busy || code.length !== 6}
            onClick={() => run(() => api.joinRoom(code, faction))}
            className="rounded bg-sky-600 px-4 py-2 font-bold disabled:opacity-50"
          >
            입장
          </button>
        </div>
      </section>
      {error && <p className="text-red-400">{error}</p>}
      {PAINTING_CREDIT}
    </div>
    </div>
  );
}
