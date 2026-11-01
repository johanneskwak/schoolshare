import { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Loader2, Sparkles } from 'lucide-react';
import ProblemText from '../components/ProblemText.jsx';
import { ErrorBox } from '../components/ui.jsx';
import { compressImage } from '../lib/image.js';
import { analyzeProblem } from '../lib/gemini.js';

const ERR_TEXT = {
  QUOTA: ['무료 API 할당량을 초과했어요', '분당/일일 한도에 도달했어요. 잠시 후 다시 시도하거나, Mock 데이터로 계속할 수 있어요.'],
  UNREADABLE: ['사진에서 수식을 읽지 못했어요', '문제만 크게 나오도록 밝은 곳에서 다시 찍어 주세요.'],
  AUTH: ['API 키를 확인해 주세요', '키가 올바르지 않거나 권한이 없어요.'],
  NETWORK: ['네트워크 오류', '연결을 확인하고 다시 시도해 주세요.'],
  MODEL: ['모델을 찾을 수 없어요', '사용 중인 모델명이 지원되지 않아요.'],
  REQUEST: ['요청이 거절되었어요', 'API가 요청 형식을 받아들이지 않았어요.'],
  SERVER: ['Google 서버가 일시적으로 응답하지 못했어요', '잠시 후 다시 시도해 주세요. 계속되면 Mock으로 계속할 수 있어요.'],
  PARSE: ['AI 응답을 해석하지 못했어요', '다시 시도하면 해결되는 경우가 많아요.'],
};

export default function Scan({ apiKey, onSave, onOpenKey }) {
  const [img, setImg] = useState(null);       // { dataUrl, base64, mime }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);   // { code, message }
  const [draft, setDraft] = useState(null);   // { data, source, warning }
  const cam = useRef(null);
  const gal = useRef(null);

  async function pick(file) {
    if (!file) return;
    setError(null); setDraft(null);
    try { setImg(await compressImage(file)); }
    catch (e) { setImg(null); setError({ code: 'FILE', message: e.message }); }
  }

  async function run(allowMockFallback = false) {
    if (!img) return;
    setBusy(true); setError(null); setDraft(null);
    try {
      setDraft(await analyzeProblem({ base64: img.base64, mime: img.mime, apiKey, allowMockFallback, seed: img.base64.length }));
    } catch (e) {
      setError({ code: e.code || 'NETWORK', message: e.message });
    } finally { setBusy(false); }
  }

  const [title, hint] = error ? ERR_TEXT[error.code] || ['이미지를 불러오지 못했어요', error.message] : [];

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-2xl">문제 스캔</h1>

      <div className="card space-y-3">
        {img ? (
          <img src={img.dataUrl} alt="업로드한 문제 사진" className="max-h-64 w-full rounded-xl object-contain" />
        ) : (
          <div className="grid h-40 place-items-center rounded-xl border border-dashed border-line text-sm text-mute">틀린 문제를 찍거나 불러오세요</div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-ghost" onClick={() => cam.current?.click()}><Camera size={16} /> 카메라</button>
          <button className="btn-ghost" onClick={() => gal.current?.click()}><ImageIcon size={16} /> 앨범</button>
        </div>
        <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
        <input ref={gal} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
        <button className="btn-primary w-full" disabled={!img || busy} onClick={() => run(false)}>
          {busy ? <><Loader2 size={16} className="animate-spin" /> 분석 중…</> : <><Sparkles size={16} /> 분석하기</>}
        </button>
        {!apiKey && <p className="text-xs text-mute">내 키를 넣지 않으면 서버 기본 키로 분석하고, 서버 키가 없으면 <b>Mock 모드</b>로 동작해요. <button className="text-coral underline" onClick={onOpenKey}>내 키 입력</button></p>}
      </div>

      {error && (
        <ErrorBox title={title} actions={<>
          {error.code !== 'UNREADABLE' && error.code !== 'FILE' && <button className="btn-ghost" onClick={() => run(false)}>다시 시도</button>}
          {['QUOTA', 'NETWORK', 'PARSE', 'SERVER', 'MODEL', 'REQUEST'].includes(error.code) && <button className="btn-primary" onClick={() => run(true)}>Mock으로 계속</button>}
          {error.code === 'AUTH' && <button className="btn-primary" onClick={onOpenKey}>키 설정</button>}
        </>}>{hint}{error.message && error.code !== 'FILE' && <span className="mt-2 block break-words text-xs text-mute">{error.message}</span>}</ErrorBox>
      )}

      {draft && (
        <div className="card space-y-3">
          <p className="text-xs text-mute">{draft.source === 'mock' ? 'Mock 데이터' : 'Gemini 분석 결과'} · 수식이 틀리면 고칠 수 있어요</p>
          {draft.warning && <p className="rounded-xl bg-coral-soft px-3 py-2 text-xs">{draft.warning}</p>}
          <div className="rounded-xl bg-sand p-3 text-[17px] leading-8"><ProblemText text={draft.data.latex} /></div>
          <textarea
            className="input font-mono text-xs" rows={3} value={draft.data.latex} aria-label="LaTeX 수정"
            onChange={(e) => setDraft({ ...draft, data: { ...draft.data, latex: e.target.value } })}
          />
          <input className="input" value={draft.data.topic} aria-label="단원명" maxLength={40}
            onChange={(e) => setDraft({ ...draft, data: { ...draft.data, topic: e.target.value } })} />
          <button className="btn-primary w-full" disabled={!draft.data.latex.trim()}
            onClick={() => onSave({ ...draft.data, source: draft.source, imageData: img?.dataUrl || null })}>
            저장하고 풀어보기
          </button>
        </div>
      )}
    </div>
  );
}
