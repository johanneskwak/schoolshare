export interface CalendarCell {
  date: string; // YYYY-MM-DD
  day: number;
  inMonth: boolean;
}

/** year/month(1~12)의 주 단위 달력 그리드를 만든다. 일요일 시작. 외부 라이브러리 없이 순수 Date 계산. */
export function buildMonthGrid(year: number, month: number): CalendarCell[][] {
  const firstOfMonth = new Date(year, month - 1, 1);
  const startOffset = firstOfMonth.getDay(); // 0=일요일
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate();

  const cells: CalendarCell[] = [];

  for (let i = startOffset - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const prevMonthDate = new Date(year, month - 2, day);
    cells.push({ date: toDateKey(prevMonthDate), day, inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: toDateKey(new Date(year, month - 1, day)), day, inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const nextIndex = cells.length - (startOffset + daysInMonth) + 1;
    const nextMonthDate = new Date(year, month, nextIndex);
    cells.push({ date: toDateKey(nextMonthDate), day: nextIndex, inMonth: false });
  }

  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseMonthParam(param: string | undefined): { year: number; month: number } {
  if (param && /^\d{4}-\d{2}$/.test(param)) {
    const [y, m] = param.split("-").map(Number);
    return { year: y!, month: m! };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export function monthParamKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
