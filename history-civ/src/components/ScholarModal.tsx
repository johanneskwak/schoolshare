import { useState } from 'react';
import type { ScholarHolder } from '../types/game';

/** 도서관 완공으로 지식인이 합류했을 때: 대표작·업적과 역사적 의의를 보여 주는 교육용 팝업 */
export function ScholarModal({ scholar, onClose }: { scholar: ScholarHolder; onClose: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="scholar-title">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border-2 border-sky-700 bg-[#152033] text-sky-50 shadow-2xl">
        <div className="flex items-center gap-4 border-b border-sky-800 bg-gradient-to-r from-sky-900 to-stone-900 px-5 py-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-stone-900 text-4xl">{scholar.icon}</div>
          <div>
            <div className="text-xs tracking-widest text-sky-300">📚 도서관 완공 · 지식인 합류</div>
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
          <button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void onClose().finally(() => setBusy(false));
            }}
            className="w-full rounded bg-sky-600 py-2 font-bold hover:bg-sky-500 disabled:opacity-50"
          >
            {busy ? '…' : '함께 연구를 시작합니다'}
          </button>
        </div>
      </div>
    </div>
  );
}
