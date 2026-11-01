// 날짜는 항상 "로컬 기준 YYYY-MM-DD" 문자열로 다룬다.
// toISOString()은 UTC로 변환되어 한국 시간 새벽에 하루 어긋나므로 쓰지 않는다.
export const INTERVALS = [1, 3, 7];

const pad = (n) => String(n).padStart(2, '0');

export function toDateStr(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function isDateStr(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function addDays(dateStr, n) {
  if (!isDateStr(dateStr)) throw new Error(`Invalid date: ${dateStr}`);
  const [y, m, d] = dateStr.split('-').map(Number);
  return toDateStr(new Date(y, m - 1, d + n));
}

export function today(now = new Date()) {
  return toDateStr(now);
}

export function buildReviews(problemId, baseDate) {
  return INTERVALS.map((days, i) => ({
    id: `${problemId}_r${i + 1}`,
    problemId,
    round: i + 1,
    dueDate: addDays(baseDate, days),
    done: false,
    doneAt: null,
  }));
}

export function formatKo(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const w = ['일', '월', '화', '수', '목', '금', '토'][new Date(y, m - 1, d).getDay()];
  return `${m}월 ${d}일 (${w})`;
}
