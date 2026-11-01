import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/analyze.js';
import { analyzeProblem, MODELS } from '../src/lib/gemini.js';

const SECRET = 'AIzaSECRET_SERVER_KEY_1234567890';
const GOOD = { latex: '\\frac{1}{2}', topic: 't', tags: [], answer: '1', explanation: '', similar: [{ latex: 'x', answer: '1', explanation: '' }] };

function call({ method = 'POST', url = `/api/analyze?model=${MODELS[0]}`, headers = {}, body = { contents: [{ parts: [{ text: 'hi' }] }], generationConfig: {} } } = {}) {
  const res = { headers: {}, statusCode: 0, body: '', setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(b) { this.body = b; } };
  const req = { method, url, headers: { host: 'ripple.test', ...headers }, body };
  return handler(req, res).then(() => res);
}

function withEnv(key, fn) {
  const old = process.env.GEMINI_API_KEY;
  if (key === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = key;
  return Promise.resolve(fn()).finally(() => { if (old === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = old; });
}

// ---------- 서버 프록시 ----------
test('5-a 서버 키가 없으면 501 + 프록시 표시 헤더', () => withEnv(undefined, async () => {
  const r = await call();
  assert.equal(r.statusCode, 501);
  assert.equal(r.headers['x-ripple-proxy'], '1');
}));

test('5-b POST 외 메서드는 405, 허용되지 않은 모델은 400, 잘못된 본문은 400', () => withEnv(SECRET, async () => {
  assert.equal((await call({ method: 'GET' })).statusCode, 405);
  assert.equal((await call({ url: '/api/analyze?model=evil-model' })).statusCode, 400);
  assert.equal((await call({ body: { nope: 1 } })).statusCode, 400);
}));

test('5-c 다른 출처(Origin)의 브라우저 요청은 403, 같은 출처는 통과', () => withEnv(SECRET, async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ status: 200, text: async () => '{}' });
  try {
    assert.equal((await call({ headers: { origin: 'https://evil.example' } })).statusCode, 403);
    assert.equal((await call({ headers: { origin: 'https://ripple.test' } })).statusCode, 200);
  } finally { globalThis.fetch = realFetch; }
}));

test('5-d 서버 키를 헤더로 붙여 Google에 전달하고, 응답·URL에는 키가 없다. 허용 필드만 전달', () => withEnv(SECRET, async () => {
  const realFetch = globalThis.fetch;
  let seen;
  globalThis.fetch = async (url, init) => { seen = { url, init }; return { status: 200, text: async () => JSON.stringify({ ok: 1 }) }; };
  try {
    const r = await call({ body: { contents: [{ parts: [] }], generationConfig: { a: 1 }, tools: [{ evil: true }], systemInstruction: 'x' } });
    assert.equal(r.statusCode, 200);
    assert.equal(seen.init.headers['x-goog-api-key'], SECRET);
    assert.ok(!seen.url.includes(SECRET));
    assert.ok(!r.body.includes(SECRET));
    const sent = JSON.parse(seen.init.body);
    assert.deepEqual(Object.keys(sent).sort(), ['contents', 'generationConfig']);
  } finally { globalThis.fetch = realFetch; }
}));

test('5-e Google의 오류 상태·본문을 그대로 전달 (503 등)', () => withEnv(SECRET, async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ status: 503, text: async () => '{"error":{"message":"high demand"}}' });
  try {
    const r = await call();
    assert.equal(r.statusCode, 503);
    assert.match(r.body, /high demand/);
  } finally { globalThis.fetch = realFetch; }
}));

// ---------- 클라이언트: 키 없음 → 프록시 ----------
const proxyRes = (status, obj, proxy = true) => ({
  ok: status >= 200 && status < 300, status,
  headers: { get: (k) => (proxy && k.toLowerCase() === 'x-ripple-proxy' ? '1' : null) },
  json: async () => obj,
});
const geminiBody = { candidates: [{ content: { parts: [{ text: JSON.stringify(GOOD) }] } }] };

test('5-f 사용자 키가 없으면 프록시(/api/analyze)로 호출하고 키 헤더를 보내지 않는다', async () => {
  let seen;
  const fetchImpl = async (url, init) => { seen = { url, init }; return proxyRes(200, geminiBody); };
  const r = await analyzeProblem({ base64: 'A', fetchImpl });
  assert.equal(r.source, 'gemini');
  assert.ok(seen.url.startsWith('/api/analyze?model='));
  assert.equal(seen.init.headers['x-goog-api-key'], undefined);
});

test('5-g 프록시가 없거나(헤더 없음) 서버 키 미설정(501)이면 Mock으로 동작', async () => {
  const a = await analyzeProblem({ base64: 'A', fetchImpl: async () => proxyRes(404, {}, false) });
  assert.equal(a.source, 'mock');
  const b = await analyzeProblem({ base64: 'A', fetchImpl: async () => proxyRes(501, {}) });
  assert.equal(b.source, 'mock');
  const c = await analyzeProblem({ base64: 'A', fetchImpl: async () => { throw new TypeError('x'); } });
  assert.equal(c.source, 'mock');
});

test('5-h 프록시 경유 429는 QUOTA 에러로 분류된다', async () => {
  const fetchImpl = async () => proxyRes(429, { error: { message: 'quota' } });
  await assert.rejects(() => analyzeProblem({ base64: 'A', fetchImpl }), (e) => e.code === 'QUOTA');
});

test('5-i 사용자가 자기 키를 넣으면 프록시를 거치지 않고 직접 호출 (우선)', async () => {
  let url;
  const fetchImpl = async (u) => { url = u; return proxyRes(200, geminiBody); };
  await analyzeProblem({ base64: 'A', apiKey: 'USERKEY', fetchImpl });
  assert.ok(url.startsWith('https://generativelanguage.googleapis.com/'));
});
