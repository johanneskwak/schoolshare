import ProblemText from './ProblemText.jsx';
import { CIRCLED } from '../lib/answer.js';

// 객관식 보기. onPick이 있으면 선택 가능, 없으면 표시만.
export default function Choices({ choices, picked = -1, correct = -1, onPick, disabled }) {
  if (!choices?.length) return null;
  return (
    <ul className="space-y-2" role={onPick ? 'radiogroup' : 'list'}>
      {choices.map((c, i) => {
        const state = correct === i && picked !== -1 ? 'right' : picked === i ? (correct === -1 || correct === i ? 'picked' : 'wrong') : 'idle';
        const tone = {
          idle: 'border-line bg-card',
          picked: 'border-coral bg-coral-soft',
          right: 'border-ok bg-[#EAF2EC]',
          wrong: 'border-bad bg-[#FBF1EE]',
        }[state];
        const Tag = onPick ? 'button' : 'div';
        return (
          <li key={i}>
            <Tag
              {...(onPick ? { type: 'button', role: 'radio', 'aria-checked': picked === i, disabled, onClick: () => onPick(i) } : {})}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-[15px] ${tone}`}
            >
              <span className="shrink-0 text-lg leading-none text-coral">{CIRCLED[i]}</span>
              <span className="min-w-0 flex-1"><ProblemText text={c} /></span>
            </Tag>
          </li>
        );
      })}
    </ul>
  );
}
