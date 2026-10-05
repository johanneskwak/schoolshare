import { buildReviews } from './schedule.js';

export const STORAGE_KEY = 'ripple:v1';
const EMPTY = () => ({ version: 1, settings: { apiKey: '' }, problems: [], attempts: [], reviews: [], notes: [] });

// ---------- 영속화 (storage는 localStorage 호환 객체를 주입) ----------
export function loadState(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY();
    const s = JSON.parse(raw);
    return {
      ...EMPTY(),
      ...s,
      settings: { apiKey: '', ...(s.settings || {}) },
      problems: Array.isArray(s.problems) ? s.problems : [],
      attempts: Array.isArray(s.attempts) ? s.attempts : [],
      reviews: Array.isArray(s.reviews) ? s.reviews : [],
      notes: Array.isArray(s.notes) ? s.notes : [],
    };
  } catch {
    return EMPTY(); // 손상된 데이터는 빈 상태로 시작 (앱이 죽지 않게)
  }
}

export function saveState(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { ok: true };
  } catch (e) {
    const quota = e && (e.name === 'QuotaExceededError' || e.code === 22);
    return { ok: false, error: quota ? 'QUOTA' : 'UNKNOWN' };
  }
}

// ---------- 순수 상태 변환 함수 ----------
let seq = 0;
export const newId = (prefix) => `${prefix}_${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function validateProblemInput(p) {
  if (!p || typeof p.latex !== 'string' || !p.latex.trim()) return '수식(LaTeX)이 비어 있습니다.';
  if (p.latex.length > 2000) return '수식이 너무 깁니다 (2000자 이내).';
  if (!Array.isArray(p.similar) || p.similar.length === 0) return '유사 문제가 없습니다.';
  return null;
}

export function addProblem(state, input, now = new Date()) {
  const err = validateProblemInput(input);
  if (err) throw new Error(err);
  const problem = {
    id: newId('p'),
    createdAt: now.toISOString(),
    imageData: input.imageData || null,
    latex: input.latex.trim(),
    topic: (input.topic || '미분류').trim().slice(0, 40),
    tags: (input.tags || []).slice(0, 5),
    choices: (input.choices || []).slice(0, 5),
    answer: input.answer || '',
    explanation: input.explanation || '',
    source: input.source === 'gemini' ? 'gemini' : 'mock',
    similar: input.similar.slice(0, 3).map((s, i) => ({ id: `s${i + 1}`, latex: s.latex, choices: (s.choices || []).slice(0, 5), answer: s.answer, explanation: s.explanation || '' })),
  };
  return { state: { ...state, problems: [problem, ...state.problems] }, problem };
}

// itemId: 'orig' 또는 유사 문제 id. 같은 문항을 다시 풀면 기록을 덮어쓴다.
export function recordAttempt(state, { problemId, itemId, userAnswer, correct }, now = new Date()) {
  const rest = state.attempts.filter((a) => !(a.problemId === problemId && a.itemId === itemId));
  const attempt = { id: newId('a'), problemId, itemId, userAnswer: String(userAnswer).slice(0, 200), correct: !!correct, at: now.toISOString() };
  return { ...state, attempts: [...rest, attempt] };
}

// 같은 문제는 중복 등록하지 않는다 (이미 있으면 상태 그대로).
export function registerReviews(state, problemId, baseDate) {
  if (state.reviews.some((r) => r.problemId === problemId)) return { state, added: 0 };
  const reviews = buildReviews(problemId, baseDate);
  return { state: { ...state, reviews: [...state.reviews, ...reviews] }, added: reviews.length };
}

export function toggleReview(state, reviewId, now = new Date()) {
  return {
    ...state,
    reviews: state.reviews.map((r) =>
      r.id === reviewId ? { ...r, done: !r.done, doneAt: r.done ? null : now.toISOString() } : r,
    ),
  };
}

export function deleteProblem(state, problemId) {
  return {
    ...state,
    problems: state.problems.filter((p) => p.id !== problemId),
    attempts: state.attempts.filter((a) => a.problemId !== problemId),
    reviews: state.reviews.filter((r) => r.problemId !== problemId),
  };
}

// ---------- 오답노트: 문제 스냅샷을 따로 저장 (원본 문제를 지워도 노트는 남는다) ----------
export function toggleNote(state, snap, now = new Date()) {
  const exists = state.notes.some((n) => n.problemId === snap.problemId && n.itemId === snap.itemId);
  if (exists) {
    return { ...state, notes: state.notes.filter((n) => !(n.problemId === snap.problemId && n.itemId === snap.itemId)) };
  }
  const note = {
    id: newId('n'),
    problemId: snap.problemId,
    itemId: snap.itemId,
    label: snap.label || '',
    topic: snap.topic || '미분류',
    latex: snap.latex,
    choices: snap.choices || [],
    answer: snap.answer || '',
    explanation: snap.explanation || '',
    userAnswer: String(snap.userAnswer || '').slice(0, 200),
    memo: '',
    createdAt: now.toISOString(),
  };
  return { ...state, notes: [note, ...state.notes] };
}

export function updateNoteMemo(state, noteId, memo) {
  return { ...state, notes: state.notes.map((n) => (n.id === noteId ? { ...n, memo: String(memo).slice(0, 500) } : n)) };
}

export function removeNote(state, noteId) {
  return { ...state, notes: state.notes.filter((n) => n.id !== noteId) };
}

export function setApiKey(state, key) {
  return { ...state, settings: { ...state.settings, apiKey: String(key || '').trim() } };
}

export const reviewsByDate = (state) => {
  const map = {};
  for (const r of state.reviews) (map[r.dueDate] ||= []).push(r);
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
};
