import { useState } from 'react';
import { ArrowLeft, CheckCircle2, XCircle, CalendarPlus, CalendarCheck, NotebookPen, BookmarkCheck } from 'lucide-react';
import Math from '../components/Math.jsx';
import RichText from '../components/RichText.jsx';
import ProblemText from '../components/ProblemText.jsx';
import Choices from '../components/Choices.jsx';
import { isCorrect, correctChoiceIndex, CIRCLED } from '../lib/answer.js';

function Item({ label, latex, choices, answer, explanation, attempt, noteSaved, onCheck, onToggleNote }) {
  const ci = correctChoiceIndex(answer, choices);
  const choiceMode = ci >= 0;
  const [value, setValue] = useState(choiceMode ? '' : attempt?.userAnswer || '');
  const [pick, setPick] = useState(choiceMode ? CIRCLED.indexOf(attempt?.userAnswer) : -1);
  const [empty, setEmpty] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    if (choiceMode ? pick < 0 : !value.trim()) return setEmpty(true);
    setEmpty(false);
    if (choiceMode) onCheck(CIRCLED[pick], pick === ci);
    else onCheck(value.trim(), isCorrect(value, answer));
  };

  return (
    <section className="card space-y-4">
      <span className="inline-block rounded-full bg-coral-soft px-3 py-1 text-xs font-medium text-coral">{label}</span>

      <p className="text-[17px] leading-8 text-ink"><ProblemText text={latex} /></p>

      <form onSubmit={submit} className="space-y-3">
        {choiceMode ? (
          <Choices choices={choices} picked={pick} correct={attempt ? ci : -1} onPick={(i) => { setPick(i); setEmpty(false); }} />
        ) : (
          <>
            <Choices choices={choices} />
            <input className="input" value={value} onChange={(e) => setValue(e.target.value)} placeholder="정답 입력 (예: 1/2, 5\sqrt{2})" aria-label={`${label} 정답 입력`} maxLength={200} />
          </>
        )}
        {empty && <p className="text-xs text-bad">{choiceMode ? '보기를 선택해 주세요.' : '답을 입력해 주세요.'}</p>}
        <button className="btn-primary w-full">{attempt ? '다시 채점' : '채점하기'}</button>
      </form>

      {attempt && (
        <div className={`space-y-2 rounded-xl p-3 text-sm ${attempt.correct ? 'bg-[#EAF2EC]' : 'bg-[#FBF1EE]'}`}>
          <p className={`flex items-center gap-1 font-medium ${attempt.correct ? 'text-ok' : 'text-bad'}`}>
            {attempt.correct ? <CheckCircle2 size={16} /> : <XCircle size={16} />} {attempt.correct ? '정답이에요' : '오답이에요'}
          </p>
          {!attempt.correct && (
            <p>정답: {choiceMode ? <b>{CIRCLED[ci]}</b> : <Math latex={answer} />}</p>
          )}
          {explanation && <p className="leading-7 text-ink/80"><RichText text={explanation} /></p>}
          <button type="button" onClick={onToggleNote} aria-pressed={noteSaved}
            className={`mt-1 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${noteSaved ? 'border-coral bg-coral-soft text-coral' : 'border-line bg-card text-ink hover:bg-sand'}`}>
            {noteSaved ? <><BookmarkCheck size={16} /> 오답노트에 저장됨 (누르면 해제)</> : <><NotebookPen size={16} /> 오답노트에 저장</>}
          </button>
        </div>
      )}
    </section>
  );
}

export default function Solve({ problem, attempts, notes, hasReviews, onAttempt, onToggleNote, onRegister, onBack }) {
  const att = (itemId) => attempts.find((a) => a.problemId === problem.id && a.itemId === itemId);
  const saved = (itemId) => notes.some((n) => n.problemId === problem.id && n.itemId === itemId);
  const solved = attempts.filter((a) => a.problemId === problem.id).length;
  const [msg, setMsg] = useState('');

  const items = [
    { ...problem, id: 'orig', label: '원본 문제' }, // id는 반드시 마지막에 지정 (problem.id로 덮어쓰이지 않게)
    ...problem.similar.map((s, i) => ({ ...s, label: `유사 문제 ${i + 1}` })),
  ];

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-mute"><ArrowLeft size={16} /> 뒤로</button>
      <div>
        <h1 className="font-serif text-2xl">{problem.topic}</h1>
        <p className="text-xs text-mute">{problem.tags.join(' · ')}{problem.source === 'mock' && ' · Mock 데이터'}</p>
      </div>
      {problem.imageData && <img src={problem.imageData} alt="원본 문제 사진" className="max-h-48 w-full rounded-2xl border border-line object-contain" />}

      {items.map((it) => (
        <Item key={it.id} label={it.label} latex={it.latex} choices={it.choices || []} answer={it.answer} explanation={it.explanation}
          attempt={att(it.id)} noteSaved={saved(it.id)}
          onCheck={(u, c) => onAttempt(problem.id, it.id, u, c)}
          onToggleNote={() => onToggleNote({
            problemId: problem.id, itemId: it.id, label: it.label, topic: problem.topic,
            latex: it.latex, choices: it.choices || [], answer: it.answer, explanation: it.explanation,
            userAnswer: att(it.id)?.userAnswer,
          })} />
      ))}

      <div className="sticky bottom-[4.5rem] -mx-4 bg-gradient-to-t from-paper via-paper to-transparent px-4 pb-2 pt-6">
        {hasReviews ? (
          <p className="card flex items-center justify-center gap-2 py-3 text-sm text-ok"><CalendarCheck size={16} /> 복습 일정이 등록되어 있어요 (1·3·7일 뒤)</p>
        ) : (
          <button className="btn-primary w-full shadow-lg" disabled={solved === 0}
            onClick={() => setMsg(onRegister(problem.id) ? '1·3·7일 뒤 복습을 등록했어요.' : '')}>
            <CalendarPlus size={16} /> {solved === 0 ? '한 문제 이상 풀면 복습을 등록할 수 있어요' : '복습 일정 등록 (1·3·7일)'}
          </button>
        )}
        {msg && <p className="mt-2 text-center text-xs text-ok" role="status">{msg}</p>}
      </div>
    </div>
  );
}
