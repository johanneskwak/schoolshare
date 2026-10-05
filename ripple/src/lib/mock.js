// API 키가 없을 때 쓰는 테스트용 데이터. 분수/제곱근/삼각함수를 골고루 포함한다.
// explanation 안의 수식은 $...$ 로 감싼다 (RichText가 렌더링).
const SAMPLES = [
  {
    latex: '\\frac{x+1}{2}=\\frac{3}{4}\\ \\text{일 때 } x\\text{의 값}',
    topic: '일차방정식',
    tags: ['분수', '방정식'],
    answer: '-1/2',
    explanation: '양변에 4를 곱하면 $2(x+1)=3$ 이므로 $x=-\\frac{1}{2}$.',
    similar: [
      { latex: '\\frac{x-1}{3}=\\frac{2}{3}', answer: '3', explanation: '$x-1=2$ 이므로 $x=3$.' },
      { latex: '\\frac{2x}{5}=\\frac{4}{5}', answer: '2', explanation: '$2x=4$ 이므로 $x=2$.' },
      { latex: '\\frac{x+2}{4}=\\frac{1}{2}', answer: '0', explanation: '$x+2=2$ 이므로 $x=0$.' },
    ],
  },
  {
    latex: '\\sqrt{18}+\\sqrt{8}=?',
    topic: '제곱근',
    tags: ['제곱근', '근호 계산'],
    answer: '5\\sqrt{2}',
    explanation: '$\\sqrt{18}=3\\sqrt{2}$, $\\sqrt{8}=2\\sqrt{2}$ 이므로 합은 $5\\sqrt{2}$.',
    similar: [
      { latex: '\\sqrt{12}+\\sqrt{27}', answer: '5\\sqrt{3}', explanation: '$2\\sqrt{3}+3\\sqrt{3}=5\\sqrt{3}$.' },
      { latex: '\\sqrt{50}-\\sqrt{32}', answer: '\\sqrt{2}', explanation: '$5\\sqrt{2}-4\\sqrt{2}=\\sqrt{2}$.' },
      { latex: '\\sqrt{75}+\\sqrt{3}', answer: '6\\sqrt{3}', explanation: '$5\\sqrt{3}+\\sqrt{3}=6\\sqrt{3}$.' },
    ],
  },
  {
    latex: '\\sin 30^\\circ+\\cos 60^\\circ=?',
    topic: '삼각비',
    tags: ['삼각함수', '특수각'],
    answer: '1',
    explanation: '$\\sin 30^\\circ=\\frac{1}{2}$, $\\cos 60^\\circ=\\frac{1}{2}$ 이므로 합은 $1$.',
    similar: [
      { latex: '\\sin 45^\\circ\\cdot\\cos 45^\\circ', answer: '1/2', explanation: '$\\frac{\\sqrt{2}}{2}\\cdot\\frac{\\sqrt{2}}{2}=\\frac{1}{2}$.' },
      { latex: '\\tan 45^\\circ+\\sin 90^\\circ', answer: '2', explanation: '$1+1=2$.' },
      { latex: '\\cos 0^\\circ-\\sin 30^\\circ', answer: '1/2', explanation: '$1-\\frac{1}{2}=\\frac{1}{2}$.' },
    ],
  },
];

export function getMockAnalysis(seed = 0) {
  const s = SAMPLES[Math.abs(Number(seed) || 0) % SAMPLES.length];
  return JSON.parse(JSON.stringify(s));
}
