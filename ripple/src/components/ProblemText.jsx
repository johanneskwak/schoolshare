import Math from './Math.jsx';
import RichText from './RichText.jsx';

const HANGUL_RUN = /[가-힣][가-힣\s,.?]*/g;
const HAS_HANGUL = /[가-힣]/;

// 문제 본문 렌더러.
// - "$수식$"이 섞인 문장: 문장은 줄바꿈되는 일반 텍스트, 수식만 KaTeX
// - 달러 없이 한글이 섞인 옛 데이터: 한글 구간을 \text{}로 감싸 수식 모드에서도 깨지지 않게 함
// - 순수 수식: KaTeX 그대로
export default function ProblemText({ text, className = '' }) {
  const s = String(text ?? '');
  if (s.includes('$')) {
    return <span className={`break-words ${className}`}><RichText text={s} /></span>;
  }
  if (HAS_HANGUL.test(s)) {
    return <Math latex={s.replace(HANGUL_RUN, (m) => `\\text{${m.trim()}}\\ `)} className={className} />;
  }
  return <Math latex={s} className={className} />;
}
