import { useState } from 'react';
import { api } from '../lib/api';
import { FACTIONS, type Faction } from '../types/game';

export function FactionPicker({ value, onChange }: { value: Faction; onChange: (f: Faction) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {(Object.keys(FACTIONS) as Faction[]).map((f) => (
        <button
          key={f}
          type="button"
          onClick={() => onChange(f)}
          className={`rounded-lg border p-3 text-left transition ${
            value === f ? 'border-amber-400 bg-stone-700' : 'border-stone-600 hover:bg-stone-800'
          }`}
        >
          <div className="font-bold" style={{ color: FACTIONS[f].color }}>
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
    <form
      className="mx-auto mt-24 max-w-sm space-y-4 px-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(name).catch((err: Error) => setError(err.message));
      }}
    >
      <h1 className="text-3xl font-bold">역사 문명전</h1>
      <p className="text-stone-300">프랑스 혁명 · 산업혁명 · 제국주의</p>
      <input
        className="w-full rounded bg-stone-800 px-3 py-2"
        placeholder="닉네임 (1~20자)"
        maxLength={20}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button className="w-full rounded bg-amber-500 py-2 font-bold text-stone-900">시작하기</button>
      {error && <p className="text-red-400">{error}</p>}
    </form>
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
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{nickname}님, 어느 문명을 이끌까요?</h1>
        <button onClick={onLeaderboard} className="shrink-0 rounded border border-stone-600 px-3 py-1.5 text-sm">
          🏅 리더보드
        </button>
      </div>
      <FactionPicker value={faction} onChange={setFaction} />

      <section className="space-y-3 rounded-lg bg-stone-800 p-4">
        <h2 className="font-bold">방 만들기</h2>
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
              {[30, 60, 90, 120].map((n) => (
                <option key={n} value={n}>{n}초</option>
              ))}
            </select>
          </label>
        </div>
        <button
          disabled={busy}
          onClick={() => run(async () => (await api.createRoom(faction, maxPlayers, turnSeconds)).id)}
          className="rounded bg-amber-500 px-4 py-2 font-bold text-stone-900 disabled:opacity-50"
        >
          방 만들기
        </button>
      </section>

      <section className="space-y-3 rounded-lg border border-emerald-700 bg-stone-800 p-4">
        <h2 className="font-bold">🤖 혼자 하기 (AI 대전)</h2>
        <p className="text-xs text-stone-400">
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
              {[60, 120, 300].map((n) => (
                <option key={n} value={n}>{n === 300 ? '5분' : `${n}초`}</option>
              ))}
            </select>
          </label>
        </div>
        <button
          disabled={busy}
          onClick={() => run(() => api.createSoloGame(faction, aiCount, soloSeconds))}
          className="rounded bg-emerald-600 px-4 py-2 font-bold disabled:opacity-50"
        >
          AI와 게임 시작
        </button>
      </section>

      <section className="space-y-3 rounded-lg bg-stone-800 p-4">
        <h2 className="font-bold">참가 코드로 입장</h2>
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
    </div>
  );
}
