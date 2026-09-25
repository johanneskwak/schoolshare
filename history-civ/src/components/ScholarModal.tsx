import { useState } from 'react';
import { BUILDINGS, CATEGORY_NAMES } from '../lib/chronicle';
import type { ScholarHolder } from '../types/game';
import { FigureIcon } from './FigureIcon';

/** 위인이 합류했을 때: 대표작·역사적 의의·효과 + 3지선다 퀴즈(정답 시 혁신 +25) */
export function ScholarModal({
  scholar,
  onClose,
  onAnswer,
}: {
  scholar: ScholarHolder;
  onClose: () => Promise<void>;
  onAnswer?: (choice: number) => Promise<{ correct: boolean; answer: number }>;
}) {
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<{ correct: boolean; answer: number } | null>(null);
  const quiz = scholar.quiz && !scholar.quiz_result && onAnswer ? scholar.quiz : null;
  const building = scholar.unlock_building ? BUILDINGS[scholar.unlock_building] : null;

  const answer = async (i: number) => {
    if (!onAnswer || busy) return;
    setBusy(true);
    setPicked(i);
    try {
      setResult(await onAnswer(i));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="scholar-title">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl border-2 border-sky-700 bg-[#152033] text-sky-50 shadow-2xl">
        <div className="flex items-center gap-4 border-b border-sky-800 bg-gradient-to-r from-sky-900 to-stone-900 px-5 py-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-stone-900 text-4xl ring-2 ring-amber-600">
            <FigureIcon id={scholar.id} fallback={scholar.icon} />
          </div>
          <div>
            <div className="text-xs tracking-widest text-sky-300">
              {scholar.year ? `📅 ${scholar.year}년 · ${scholar.category ? CATEGORY_NAMES[scholar.category] : '위인'} 합류` : '📚 도서관 완공 · 지식인 합류'}
            </div>
            <h2 id="scholar-title" className="font-serif text-2xl font-bold">
              {scholar.name}
            </h2>
            <div className="text-sm text-sky-200/80">{scholar.era}</div>
          </div>
        </div>
        <div className="space-y-3 px-5 py-4">
          <div>
            <div className="text-xs font-bold text-sky-300">대표작 · 업적</div>
            <p className="font-serif text-lg">{scholar.works}</p>
          </div>
          <div>
            <div className="text-xs font-bold text-sky-300">역사적 의의</div>
            <p className="leading-relaxed text-sky-100/90">{scholar.significance}</p>
          </div>
          <div className="rounded border border-emerald-700 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-200">
            ⚡ 합류 효과: {scholar.effect}
          </div>
          {building && (
            <div className="rounded border border-amber-600 bg-amber-950/50 px-3 py-2 text-sm text-amber-200">
              🔓 고유 건물 해금: {building.icon} <b>{building.name}</b> — {building.desc} (도시 선택 → 도시 건물)
            </div>
          )}

          {quiz && (
            <div className="space-y-2 rounded border border-sky-700 bg-stone-900/60 p-3">
              <div className="text-sm font-bold">🧠 역사 퀴즈 — 맞히면 혁신 +25</div>
              <p className="text-sm">{quiz.q}</p>
              <div className="grid gap-1.5">
                {quiz.choices.map((c, i) => {
                  const isAnswer = result?.answer === i;
                  const wrongPick = result && picked === i && !result.correct;
                  return (
                    <button
                      key={i}
                      disabled={busy || !!result}
                      onClick={() => void answer(i)}
                      className={`rounded px-3 py-1.5 text-left text-sm ${
                        isAnswer ? 'bg-emerald-700' : wrongPick ? 'bg-red-800' : 'bg-stone-700 hover:bg-stone-600'
                      } disabled:cursor-default`}
                    >
                      {i + 1}. {c}
                    </button>
                  );
                })}
              </div>
              {result && (
                <p className={`text-sm font-bold ${result.correct ? 'text-emerald-300' : 'text-red-300'}`}>
                  {result.correct ? '정답! 혁신 +25 💡' : `아쉬워요. 정답은 ${result.answer + 1}번이에요.`}
                </p>
              )}
            </div>
          )}

          <button
            disabled={busy || (!!quiz && !result)}
            onClick={() => {
              setBusy(true);
              void onClose().finally(() => setBusy(false));
            }}
            className="w-full rounded bg-sky-600 py-2 font-bold hover:bg-sky-500 disabled:opacity-50"
          >
            {busy ? '…' : quiz && !result ? '퀴즈에 먼저 답해 주세요' : '함께 역사를 만들어 갑니다'}
          </button>
        </div>
      </div>
    </div>
  );
}
