// 정답 비교: 문자열 정규화 후 일치 여부, 숫자/분수는 값으로 비교한다.
export function normalizeAnswer(input) {
  return String(input ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\\left|\\right|\\,|\\;|\\!/g, '')
    .replace(/\\dfrac|\\tfrac/g, '\\frac')
    .replace(/[$\s]/g, '')
    .replace(/\\cdot|\\times/g, '*')
    .replace(/−/g, '-');
}

function toNumber(s) {
  let m = s.match(/^(-?)\\frac\{(-?\d+(?:\.\d+)?)\}\{(-?\d+(?:\.\d+)?)\}$/);
  if (m) return (m[1] ? -1 : 1) * (Number(m[2]) / Number(m[3]));
  m = s.match(/^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/);
  if (m) return Number(m[1]) / Number(m[2]);
  if (/^-?\d+(?:\.\d+)?$/.test(s)) return Number(s);
  return null;
}

export const CIRCLED = ['①', '②', '③', '④', '⑤'];

// 객관식 정답의 보기 번호(0-based). 정답이 "3"/"③"이면 번호로, 값이면 보기 내용과 비교. 못 찾으면 -1.
export function correctChoiceIndex(answer, choices) {
  if (!Array.isArray(choices) || choices.length === 0) return -1;
  const a = normalizeAnswer(answer);
  const m = a.match(/^\(?([1-5])\)?번?$/);
  if (m && Number(m[1]) <= choices.length) return Number(m[1]) - 1;
  return choices.findIndex((c) => isCorrect(c, answer));
}

export function isCorrect(userAnswer, correctAnswer) {
  const a = normalizeAnswer(userAnswer);
  const b = normalizeAnswer(correctAnswer);
  if (!a || !b) return false;
  if (a === b) return true;
  const na = toNumber(a);
  const nb = toNumber(b);
  return na !== null && nb !== null && Number.isFinite(na) && Math.abs(na - nb) < 1e-9;
}
