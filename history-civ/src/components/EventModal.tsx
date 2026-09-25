import { useState } from 'react';
import type { PendingEvent } from '../types/game';
import { FIGURE_ICONS } from '../constants/figureIcons';
import { FigureIcon } from './FigureIcon';

/** EventSystem 팝업: 역사적 맥락 + 두 가지 선택지. 선택 즉시 서버에서 자원·맵에 반영된다. */
export function EventModal({
  event,
  onChoose,
  onLater,
}: {
  event: PendingEvent;
  onChoose: (choice: 'a' | 'b') => Promise<void>;
  onLater: () => void;
}) {
  const [busy, setBusy] = useState<'a' | 'b' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const choose = async (c: 'a' | 'b') => {
    setBusy(c);
    setError(null);
    try {
      await onChoose(c);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  };

  const options = [
    { key: 'a' as const, label: event.choice_a_label, desc: event.choice_a_desc },
    { key: 'b' as const, label: event.choice_b_label, desc: event.choice_b_desc },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="event-title">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border-2 border-amber-700 bg-[#2b2118] text-amber-50 shadow-2xl">
        <div className="flex items-center gap-4 border-b border-amber-800 bg-gradient-to-r from-amber-900 to-stone-900 px-5 py-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full text-5xl drop-shadow">
            {FIGURE_ICONS[event.id] ? <FigureIcon id={event.id} fallback={event.icon} /> : event.icon}
          </div>
          <div>
            <div className="text-xs tracking-widest text-amber-400">역사적 사건 · {event.era}</div>
            <h2 id="event-title" className="font-serif text-2xl font-bold">
              {event.title}
            </h2>
          </div>
        </div>
        <div className="space-y-4 px-5 py-4">
          <p className="font-serif leading-relaxed text-amber-100/90">{event.body}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {options.map((o) => (
              <button
                key={o.key}
                disabled={busy !== null}
                onClick={() => void choose(o.key)}
                className="rounded-lg border border-amber-700 bg-stone-900/70 p-3 text-left transition hover:border-amber-400 hover:bg-amber-950 disabled:opacity-50"
              >
                <div className="font-bold text-amber-300">{busy === o.key ? '결정 중…' : o.label}</div>
                <div className="mt-1 text-xs leading-relaxed text-amber-100/80">{o.desc}</div>
              </button>
            ))}
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex items-center justify-between text-xs text-amber-200/60">
            <span>고르지 않으면 턴 종료 때 "{event.choice_a_label}"로 결정됩니다.</span>
            <button onClick={onLater} className="underline">
              나중에
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
