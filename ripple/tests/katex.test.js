// 항목 2: 복잡한 LaTeX가 KaTeX에서 깨지지 않고 렌더링되는지.
// katex가 설치되어 있지 않으면 건너뜁니다(skip). skip은 "통과"가 아닙니다.
import test from 'node:test';
import assert from 'node:assert/strict';

const FORMULAS = [
  '\\frac{x+1}{2}=\\frac{3}{4}',
  '\\dfrac{-b\\pm\\sqrt{b^2-4ac}}{2a}',
  '\\sqrt[3]{27}+\\sqrt{18}',
  '\\sin 30^\\circ+\\cos 60^\\circ',
  '\\tan\\theta=\\frac{\\sin\\theta}{\\cos\\theta}',
  '\\int_0^{\\pi}\\sin x\\,dx',
  '\\sum_{k=1}^{n}k=\\frac{n(n+1)}{2}',
  '\\frac{x+1}{2}=\\frac{3}{4}\\ \\text{일 때 } x\\text{의 값}',
];

let katex = null;
try { katex = (await import('katex')).default; } catch { /* 미설치 */ }

for (const f of FORMULAS) {
  test(`2 렌더링: ${f}`, { skip: katex ? false : 'katex 미설치 (npm install 후 실행)' }, () => {
    const html = katex.renderToString(f, { throwOnError: true, trust: false });
    assert.ok(html.includes('class="katex"'));
    assert.ok(!html.includes('katex-error'));
  });
}

test('2 HTML 주입은 수식 안에서도 태그로 해석되지 않는다', { skip: katex ? false : 'katex 미설치 (npm install 후 실행)' }, () => {
  const html = katex.renderToString('\\text{<img src=x onerror=alert(1)>}', { throwOnError: false, trust: false });
  assert.ok(!html.includes('<img'));
});

// 회귀: Mock 샘플의 LaTeX/해설 수식이 백슬래시를 잃지 않고 KaTeX로 렌더링되는지.
import { getMockAnalysis } from '../src/lib/mock.js';
for (let i = 0; i < 3; i++) {
  test(`2 Mock 샘플 ${i} 수식·해설 렌더링`, { skip: katex ? false : 'katex 미설치 (npm install 후 실행)' }, () => {
    const m = getMockAnalysis(i);
    const items = [m, ...m.similar];
    for (const it of items) {
      assert.ok(it.latex.includes('\\') || /^[\d\s+\-=x^]+$/.test(it.latex), `백슬래시 손실 의심: ${it.latex}`);
      katex.renderToString(it.latex, { throwOnError: true });
      for (const [, math] of it.explanation.matchAll(/\$([^$]+)\$/g)) katex.renderToString(math, { throwOnError: true });
    }
    assert.ok(m.latex.includes('\\'), 'latex에 LaTeX 명령이 있어야 함');
  });
}
