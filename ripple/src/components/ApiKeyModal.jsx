import { useState } from 'react';
import { X, KeyRound, ExternalLink } from 'lucide-react';

export default function ApiKeyModal({ initialKey, onSave, onClose }) {
  const [key, setKey] = useState(initialKey || '');
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center" role="dialog" aria-modal="true" aria-label="API 키 설정">
      <div className="w-full max-w-md rounded-t-3xl bg-paper p-5 sm:rounded-3xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-serif text-lg"><KeyRound size={18} className="text-coral" /> Gemini API 키</h2>
          <button onClick={onClose} aria-label="닫기" className="rounded-full p-2 hover:bg-sand"><X size={18} /></button>
        </div>
        <p className="mb-3 text-sm leading-relaxed text-mute">
          키는 이 기기의 브라우저(LocalStorage)에만 저장되고, 사진 분석 요청 때 Google 서버로만 전송됩니다.
          공용 기기에서는 사용 후 키를 지워 주세요. 비워 두면 테스트용 Mock 모드로 동작합니다.
        </p>
        <input
          type="password" autoComplete="off" spellCheck={false} value={key}
          onChange={(e) => setKey(e.target.value)} placeholder="AIza..." className="input mb-3"
        />
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="mb-4 inline-flex items-center gap-1 text-sm text-coral underline">
          무료 키 발급받기 <ExternalLink size={13} />
        </a>
        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={() => onSave('')}>키 삭제</button>
          <button className="btn-primary flex-1" onClick={() => onSave(key)}>저장</button>
        </div>
      </div>
    </div>
  );
}
