import { useEffect, useRef } from 'react';
import katex from 'katex';

// 사용자·AI 입력은 HTML로 해석하지 않는다.
// KaTeX가 직접 DOM을 만들며 trust:false 이므로 \href, \includegraphics 등 위험 명령은 비활성.
// 렌더링에 실패하면 원문을 textContent(이스케이프됨)로 보여 준다.
export default function Math({ latex, display = false, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    try {
      katex.render(String(latex ?? ''), el, { displayMode: display, throwOnError: true, trust: false, strict: 'ignore' });
      delete el.dataset.mathError;
    } catch {
      el.textContent = String(latex ?? '');
      el.dataset.mathError = 'true';
    }
  }, [latex, display]);
  // 긴 수식은 카드를 밀어내지 않고 안에서 가로 스크롤
  return <span ref={ref} className={`${display ? 'block' : 'inline-block align-middle'} max-w-full overflow-x-auto overflow-y-hidden ${className}`} aria-label="수식" />;
}
