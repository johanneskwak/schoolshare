import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeProblem, parseModelJson, AnalyzeError } from '../src/lib/gemini.js';
import { addDays, buildReviews, toDateStr, isDateStr } from '../src/lib/schedule.js';
import { isCorrect } from '../src/lib/answer.js';
import { loadState, saveState, addProblem, recordAttempt, registerReviews, toggleReview, reviewsByDate, STORAGE_KEY } from '../src/lib/store.js';

const memStorage = (initial = {}) => {
  const m = new Map(Object.entries(initial));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), _m: m };
};
const okJson = (obj) => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }) });
const GOOD = { latex: '\\frac{1}{2}+\\sqrt{4}', topic: '분수', tags: ['분수'], answer: '5/2', explanation: '', similar: [{ latex: 'x', answer: '1', explanation: '' }] };

// ---------- 항목 1: API 연동 + Mock fallback ----------
test('1-a 키가 없으면 Mock 데이터로 동작하고 source=mock', async () => {
  const r = await analyzeProblem({ base64: 'AAA', apiKey: '' });
  assert.equal(r.source, 'mock');
  assert.equal(r.data.similar.length, 3);
});

test('1-b 키가 있으면 Gemini 응답을 파싱하고 키는 URL이 아닌 헤더로 전송', async () => {
  let seen;
  const fetchImpl = async (url, init) => { seen = { url, init }; return okJson(GOOD); };
  const r = await analyzeProblem({ base64: 'AAA', apiKey: 'KEY123', fetchImpl });
  assert.equal(r.source, 'gemini');
  assert.ok(!seen.url.includes('KEY123'));
  assert.equal(seen.init.headers['x-goog-api-key'], 'KEY123');
});

test('1-c 429(할당량 초과)는 QUOTA 에러, allowMockFallback이면 Mock으로 대체', async () => {
  const fetchImpl = async () => ({ ok: false, status: 429 });
  await assert.rejects(() => analyzeProblem({ base64: 'A', apiKey: 'K', fetchImpl }), (e) => e.code === 'QUOTA');
  const r = await analyzeProblem({ base64: 'A', apiKey: 'K', fetchImpl, allowMockFallback: true });
  assert.equal(r.source, 'mock');
  assert.match(r.warning, /할당량/);
});

test('1-d 사진 인식 불가(latex 빈 값)는 Mock으로 덮지 않고 UNREADABLE', async () => {
  const fetchImpl = async () => okJson({ ...GOOD, latex: '' });
  await assert.rejects(() => analyzeProblem({ base64: 'A', apiKey: 'K', fetchImpl, allowMockFallback: true }), (e) => e.code === 'UNREADABLE');
});

test('1-e 네트워크 예외는 NETWORK 에러', async () => {
  const fetchImpl = async () => { throw new TypeError('fail'); };
  await assert.rejects(() => analyzeProblem({ base64: 'A', apiKey: 'K', fetchImpl }), (e) => e.code === 'NETWORK');
});

test('1-f 코드펜스로 감싼 JSON도 파싱, 깨진 JSON은 PARSE', () => {
  const fenced = '```json\n' + JSON.stringify(GOOD) + '\n```';
  assert.equal(parseModelJson(fenced).latex, GOOD.latex);
  assert.throws(() => parseModelJson('{ not json'), (e) => e instanceof AnalyzeError && e.code === 'PARSE');
});

test('1-g JSON 이스케이프 오염(\\frac → 폼피드) 복원', () => {
  // 모델이 "\frac"을 이스케이프하지 않고 보내면 JSON.parse가 \f를 폼피드로 바꾼다.
  const raw = '{"latex":"\\frac{1}{2}+\\theta","topic":"t","answer":"1","explanation":"","similar":[{"latex":"x","answer":"1","explanation":""}]}';
  const out = parseModelJson(raw);
  assert.equal(out.latex, '\\frac{1}{2}+\\theta');
});

// ---------- 항목 3: 채점 + 플래너 저장 + 새로고침 유지 ----------
test('3-a 1/3/7일 복습 날짜 계산 (월말·연말 경계 포함)', () => {
  assert.deepEqual(buildReviews('p', '2026-10-05').map((r) => r.dueDate), ['2026-10-06', '2026-10-08', '2026-10-12']);
  assert.equal(addDays('2026-12-30', 3), '2027-01-02');
  assert.equal(addDays('2028-02-27', 3), '2028-03-01');
});

test('3-b 날짜 포맷은 로컬 기준 YYYY-MM-DD (UTC 어긋남 없음)', () => {
  assert.equal(toDateStr(new Date(2026, 9, 5, 0, 30)), '2026-10-05');
  assert.equal(isDateStr('2026-02-30'), false);
  assert.equal(isDateStr('2026-10-5'), false);
});

test('3-c 정답 비교: 공백/달러/분수 표기 차이 허용, 오답은 false', () => {
  assert.ok(isCorrect(' 1/2 ', '\\frac{1}{2}'));
  assert.ok(isCorrect('$5\\sqrt{2}$', '5\\sqrt{2}'));
  assert.ok(isCorrect('0.5', '1/2'));
  assert.ok(!isCorrect('', '1'));
  assert.ok(!isCorrect('2', '1/2'));
});

test('3-d 풀이 후 복습 등록 → 저장 → "새로고침"(새 load) 후에도 날짜별 유지, 중복 등록 없음', async () => {
  const storage = memStorage();
  let state = loadState(storage);
  const { data } = await analyzeProblem({ base64: 'A', apiKey: '' });
  const added = addProblem(state, { ...data, source: 'mock' });
  state = added.state;
  state = recordAttempt(state, { problemId: added.problem.id, itemId: 's1', userAnswer: '3', correct: true });
  const r1 = registerReviews(state, added.problem.id, '2026-10-05');
  state = r1.state;
  assert.equal(r1.added, 3);
  assert.equal(registerReviews(state, added.problem.id, '2026-10-05').added, 0);
  state = toggleReview(state, state.reviews[0].id);
  assert.ok(saveState(storage, state).ok);

  const reloaded = loadState(storage); // 새로고침 시뮬레이션
  assert.deepEqual(reviewsByDate(reloaded).map(([d]) => d), ['2026-10-06', '2026-10-08', '2026-10-12']);
  assert.equal(reloaded.reviews[0].done, true);
  assert.equal(reloaded.attempts.length, 1);
});

test('3-e 손상된 저장 데이터는 빈 상태로 복구, 용량 초과는 QUOTA 반환', () => {
  assert.equal(loadState(memStorage({ [STORAGE_KEY]: '{broken' })).problems.length, 0);
  const full = { getItem: () => null, setItem: () => { const e = new Error('x'); e.name = 'QuotaExceededError'; throw e; } };
  assert.deepEqual(saveState(full, { a: 1 }), { ok: false, error: 'QUOTA' });
});

test('3-f 수식 누락 입력은 저장 거부', () => {
  assert.throws(() => addProblem(loadState(memStorage()), { latex: '  ', similar: [{}] }), /비어/);
});

test('1-h 서버 오류(503/404)는 상태 코드와 Google 메시지를 포함해 SERVER/MODEL로 구분', async () => {
  const mk = (status, message) => async () => ({ ok: false, status, json: async () => ({ error: { message } }) });
  await assert.rejects(() => analyzeProblem({ base64: 'A', apiKey: 'K', fetchImpl: mk(503, 'overloaded'), retryDelayMs: 0 }), (e) => e.code === 'SERVER' && /503.*overloaded/.test(e.message));
  await assert.rejects(() => analyzeProblem({ base64: 'A', apiKey: 'K', fetchImpl: mk(404, 'model not found') }), (e) => e.code === 'MODEL');
  await assert.rejects(() => analyzeProblem({ base64: 'A', apiKey: 'K', fetchImpl: mk(400, 'API key not valid') }), (e) => e.code === 'AUTH');
});

test('1-i 첫 모델이 404이면 다음 후보 모델로 재시도', async () => {
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(url);
    return urls.length === 1 ? { ok: false, status: 404, json: async () => ({ error: { message: 'not found' } }) } : okJson(GOOD);
  };
  const r = await analyzeProblem({ base64: 'A', apiKey: 'K', fetchImpl });
  assert.equal(r.source, 'gemini');
  assert.equal(urls.length, 2);
  assert.notEqual(urls[0], urls[1]);
});

test('1-j 503이 일시적이면 재시도 후 성공, 계속되면 SERVER 에러', async () => {
  let n = 0;
  const flaky = async () => (++n < 3 ? { ok: false, status: 503, json: async () => ({ error: { message: 'high demand' } }) } : okJson(GOOD));
  const r = await analyzeProblem({ base64: 'A', apiKey: 'K', fetchImpl: flaky, retryDelayMs: 0 });
  assert.equal(r.source, 'gemini');
  assert.equal(n, 3);
  const dead = async () => ({ ok: false, status: 503, json: async () => ({ error: { message: 'high demand' } }) });
  await assert.rejects(() => analyzeProblem({ base64: 'A', apiKey: 'K', fetchImpl: dead, retryDelayMs: 0 }), (e) => e.code === 'SERVER');
});

// ---------- 오답노트 · 객관식 ----------
import { toggleNote, updateNoteMemo, removeNote, deleteProblem } from '../src/lib/store.js';
import { correctChoiceIndex } from '../src/lib/answer.js';

test('4-a 오답노트 저장/해제 토글, 중복 저장 없음, 메모 수정, 새로고침 후 유지', () => {
  const storage = memStorage();
  let s = loadState(storage);
  const snap = { problemId: 'p1', itemId: 's1', label: '유사 문제 1', topic: '직선', latex: '문제 $x$', choices: ['$1$', '$2$'], answer: '2', explanation: '', userAnswer: '①' };
  s = toggleNote(s, snap);
  assert.equal(s.notes.length, 1);
  s = updateNoteMemo(s, s.notes[0].id, '부호 실수');
  saveState(storage, s);
  assert.equal(loadState(storage).notes[0].memo, '부호 실수');
  assert.equal(toggleNote(loadState(storage), snap).notes.length, 0); // 다시 누르면 해제
  assert.equal(removeNote(s, s.notes[0].id).notes.length, 0);
});

test('4-b 원본 문제를 삭제해도 오답노트 스냅샷은 남는다', () => {
  let s = loadState(memStorage());
  s = toggleNote(s, { problemId: 'p1', itemId: 'orig', latex: 'x', answer: '1' });
  assert.equal(deleteProblem(s, 'p1').notes.length, 1);
});

test('4-c 객관식 정답 번호 찾기: "3", "③", 보기 값 일치, 못 찾으면 -1', () => {
  const ch = ['$\\frac{23}{8}$', '$3$', '$\\frac{25}{8}$'];
  assert.equal(correctChoiceIndex('3', ch), 2);
  assert.equal(correctChoiceIndex('③', ch), 2);
  assert.equal(correctChoiceIndex('25/8', ch), 2);
  assert.equal(correctChoiceIndex('99', ch), -1);
  assert.equal(correctChoiceIndex('1', []), -1);
});

test('4-d 응답의 choices를 최대 5개로 정리하고 문장형 latex를 그대로 유지', () => {
  const out = parseModelJson(JSON.stringify({
    latex: '두 직선 $y=2x$ 와 $x$축으로 둘러싸인 넓이는?', choices: ['$1$', '', '$2$', '$3$', '$4$', '$5$', '$6$'], topic: 't', answer: '3', explanation: '',
    similar: [{ latex: 'q $x$', choices: ['a', 'b'], answer: '1', explanation: '' }],
  }));
  assert.equal(out.choices.length, 5);
  assert.ok(out.latex.startsWith('두 직선'));
  assert.deepEqual(out.similar[0].choices, ['a', 'b']);
});
