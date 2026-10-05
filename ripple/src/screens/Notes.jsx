import { useState } from 'react';
import { NotebookPen, Trash2, Eye, EyeOff } from 'lucide-react';
import ProblemText from '../components/ProblemText.jsx';
import RichText from '../components/RichText.jsx';
import Math from '../components/Math.jsx';
import Choices from '../components/Choices.jsx';
import { EmptyState } from '../components/ui.jsx';
import { correctChoiceIndex, CIRCLED } from '../lib/answer.js';

function Note({ note, onMemo, onRemove }) {
  const [open, setOpen] = useState(false);
  const [memo, setMemo] = useState(note.memo);
  const ci = correctChoiceIndex(note.answer, note.choices);
  const picked = CIRCLED.indexOf(note.userAnswer);

  return (
    <li className="card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-coral-soft px-3 py-1 text-xs font-medium text-coral">{note.topic} · {note.label}</span>
        <button aria-label="오답노트에서 삭제" className="rounded-full p-2 text-mute hover:bg-sand hover:text-bad"
          onClick={() => window.confirm('이 오답을 노트에서 삭제할까요?') && onRemove()}><Trash2 size={16} /></button>
      </div>

      <p className="text-[17px] leading-8"><ProblemText text={note.latex} /></p>

      {ci >= 0
        ? <Choices choices={note.choices} picked={open ? picked : -1} correct={open ? ci : -1} />
        : <Choices choices={note.choices} />}

      {note.userAnswer && <p className="text-sm text-mute">내가 쓴 답: <b className="text-bad">{note.userAnswer}</b></p>}

      <button type="button" className="btn-ghost w-full" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? <><EyeOff size={16} /> 정답·해설 숨기기</> : <><Eye size={16} /> 정답·해설 보기</>}
      </button>
      {open && (
        <div className="space-y-2 rounded-xl bg-sand p-3 text-sm">
          <p>정답: {ci >= 0 ? <b>{CIRCLED[ci]}</b> : <Math latex={note.answer} />}</p>
          {note.explanation && <p className="leading-7"><RichText text={note.explanation} /></p>}
        </div>
      )}

      <textarea className="input" rows={2} maxLength={500} value={memo} placeholder="내가 틀린 이유 메모 (선택)"
        aria-label="오답 메모" onChange={(e) => setMemo(e.target.value)} onBlur={() => memo !== note.memo && onMemo(memo)} />
    </li>
  );
}

export default function Notes({ notes, onMemo, onRemove }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-serif text-2xl">오답노트</h1>
        <p className="text-xs text-mute">{notes.length}개 저장됨</p>
      </div>
      {notes.length === 0 ? (
        <EmptyState icon={NotebookPen} title="오답노트가 비어 있어요" hint="문제를 풀고 결과 화면에서 '오답노트에 저장'을 눌러 보세요." />
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <Note key={n.id} note={n} onMemo={(m) => onMemo(n.id, m)} onRemove={() => onRemove(n.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}
