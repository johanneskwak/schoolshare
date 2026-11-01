import { getMockAnalysis } from './mock.js';

// 모델명은 자주 바뀐다. 별칭을 먼저 쓰고, 404(모델 없음)이면 다음 후보로 넘어간다.
export const MODELS = ['gemini-flash-latest', 'gemini-3.5-flash', 'gemini-2.5-flash'];
const ENDPOINT = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

export const PROXY_URL = '/api/analyze';

export class AnalyzeError extends Error {
  // code: NOPROXY | QUOTA | UNREADABLE | NETWORK | PARSE | AUTH | MODEL | REQUEST | SERVER
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const PROMPT = `너는 한국 중·고등학교 수학 선생님이다. 첨부된 사진의 수학 문제를 분석해 JSON으로만 답해라.
- latex: 문제 본문 전체. 한글 문장은 그대로 일반 텍스트로 쓰고, 수식만 $...$ 로 감싸 KaTeX LaTeX로 쓴다. 예: "두 직선 $y=2x$, $x+y=6$ 과 $x$축으로 둘러싸인 삼각형의 넓이는?" 수식 밖 한글을 \\text{} 로 감싸지 않는다.
- choices: 객관식 보기가 있으면 보기 내용만 배열로 (번호 ①②③ 제외, 수식은 $...$). 없으면 빈 배열.
- topic: 단원명, tags: 개념 태그 1~3개
- answer: 최종 정답. 객관식이면 보기 번호 숫자(예: "3"), 아니면 짧은 값. explanation: 풀이 해설 (문장 속 수식은 $...$ 로 감싼다)
- similar: 같은 개념의 유사 문제 정확히 3개, 각각 latex/choices/answer/explanation (같은 형식 규칙). 원본이 객관식이면 유사 문제도 보기 5개를 만든다.
- 그림이나 도형이 있어 문제를 완전히 풀 수 없는 경우에도 보이는 조건을 글로 풀어 쓴다.
- 사진에서 수학 문제를 읽을 수 없으면 latex를 빈 문자열로 둔다.`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    latex: { type: 'STRING' },
    choices: { type: 'ARRAY', items: { type: 'STRING' } },
    topic: { type: 'STRING' },
    tags: { type: 'ARRAY', items: { type: 'STRING' } },
    answer: { type: 'STRING' },
    explanation: { type: 'STRING' },
    similar: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          latex: { type: 'STRING' },
          choices: { type: 'ARRAY', items: { type: 'STRING' } },
          answer: { type: 'STRING' },
          explanation: { type: 'STRING' },
        },
        required: ['latex', 'answer', 'explanation'],
      },
    },
  },
  required: ['latex', 'topic', 'answer', 'explanation', 'similar'],
};

// JSON.parse는 "\f", "\t", "\b", "\r"을 제어문자로 바꿔 \frac, \theta, \beta, \right 를 망가뜨린다.
// 파싱 후 문자열 값 안의 제어문자를 원래의 역슬래시 표기로 되돌린다.
export function restoreLatexEscapes(str) {
  return str
    .replace(/\f/g, '\\f')
    .replace(/\t/g, '\\t')
    .replace(/\x08/g, '\\b') // 정규식의 \b는 단어 경계이므로 백스페이스는 \x08로 쓴다
    .replace(/\r/g, '\\r');
}

function restoreDeep(v) {
  if (typeof v === 'string') return restoreLatexEscapes(v);
  if (Array.isArray(v)) return v.map(restoreDeep);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, restoreDeep(x)]));
  }
  return v;
}

export function parseModelJson(text) {
  if (typeof text !== 'string' || !text.trim()) throw new AnalyzeError('PARSE', '빈 응답입니다.');
  let body = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const first = body.indexOf('{');
  const last = body.lastIndexOf('}');
  if (first === -1 || last === -1) throw new AnalyzeError('PARSE', 'JSON을 찾지 못했습니다.');
  body = body.slice(first, last + 1);
  let obj;
  try {
    obj = JSON.parse(body);
  } catch {
    throw new AnalyzeError('PARSE', 'JSON 형식이 올바르지 않습니다.');
  }
  return validateAnalysis(restoreDeep(obj));
}

export function validateAnalysis(obj) {
  const str = (v) => (typeof v === 'string' ? v.trim() : '');
  const latex = str(obj?.latex);
  if (!latex) throw new AnalyzeError('UNREADABLE', '사진에서 수식을 인식하지 못했습니다.');
  const choicesOf = (v) => (Array.isArray(v) ? v.map(str).filter(Boolean).slice(0, 5) : []);
  const similar = (Array.isArray(obj.similar) ? obj.similar : [])
    .map((s) => ({ latex: str(s?.latex), choices: choicesOf(s?.choices), answer: str(s?.answer), explanation: str(s?.explanation) }))
    .filter((s) => s.latex && s.answer)
    .slice(0, 3);
  if (similar.length === 0) throw new AnalyzeError('PARSE', '유사 문제가 비어 있습니다.');
  return {
    latex,
    choices: choicesOf(obj.choices),
    topic: str(obj.topic) || '미분류',
    tags: (Array.isArray(obj.tags) ? obj.tags : []).map(str).filter(Boolean).slice(0, 5),
    answer: str(obj.answer),
    explanation: str(obj.explanation),
    similar,
  };
}

/**
 * @param {{base64:string, mime:string, apiKey?:string, fetchImpl?:Function,
 *          allowMockFallback?:boolean, seed?:number}} opts
 * @returns {Promise<{data:object, source:'gemini'|'mock', warning?:string}>}
 */
export async function analyzeProblem(opts) {
  const { base64, mime = 'image/jpeg', apiKey, fetchImpl = globalThis.fetch, allowMockFallback = false, seed = 0, retryDelayMs } = opts;

  // 사용자가 자기 키를 넣었으면 브라우저에서 Google로 직접 호출한다.
  // 키가 없으면 서버 프록시(/api/analyze)를 쓰고, 프록시가 없거나 서버 키가 설정되지 않았으면 Mock으로 동작한다.
  const viaProxy = !apiKey;

  try {
    const data = await callGemini({ base64, mime, apiKey, fetchImpl, retryDelayMs, viaProxy });
    return { data, source: 'gemini' };
  } catch (err) {
    if (err instanceof AnalyzeError && err.code === 'NOPROXY') {
      return { data: validateAnalysis(getMockAnalysis(seed)), source: 'mock', warning: 'API 키가 없어 테스트용 Mock 데이터를 사용했습니다.' };
    }
    // 사진을 못 읽은 경우는 Mock으로 덮지 않고 재촬영을 안내한다.
    if (allowMockFallback && err instanceof AnalyzeError && err.code !== 'UNREADABLE') {
      return { data: validateAnalysis(getMockAnalysis(seed)), source: 'mock', warning: `${err.message} Mock 데이터로 대체했습니다.` };
    }
    throw err;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RETRIES = 2; // 503(과부하)은 일시적이므로 같은 모델에 최대 2번 더 시도

async function callGemini({ retryDelayMs = 1500, ...args }) {
  let last;
  for (const model of MODELS) {
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
      try {
        return await callModel({ ...args, model });
      } catch (e) {
        if (!(e instanceof AnalyzeError) || (e.code !== 'MODEL' && e.code !== 'SERVER')) throw e;
        last = e;
        if (e.code === 'MODEL') break; // 이 모델은 없음 → 다음 모델
        if (attempt < RETRIES) await sleep(retryDelayMs * (attempt + 1));
      }
    }
  }
  if (last?.code === 'SERVER') throw last; // 모든 모델이 과부하
  throw new AnalyzeError('MODEL', `사용 가능한 모델이 없습니다. 시도: ${MODELS.join(', ')} · ${last?.message ?? ''}`);
}

async function callModel({ base64, mime, apiKey, fetchImpl, model, viaProxy }) {
  let res;
  try {
    res = await fetchImpl(viaProxy ? `${PROXY_URL}?model=${encodeURIComponent(model)}` : ENDPOINT(model), {
      method: 'POST',
      // 직접 호출: 키는 URL이 아니라 헤더로 보낸다 (주소창·로그에 남지 않도록).
      // 프록시 호출: 키가 없다. 서버가 환경변수의 키를 붙인다.
      headers: viaProxy ? { 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mime, data: base64 } }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.4 },
      }),
    });
  } catch {
    if (viaProxy) throw new AnalyzeError('NOPROXY', '서버 프록시에 연결하지 못했습니다.');
    throw new AnalyzeError('NETWORK', '네트워크 오류로 요청하지 못했습니다.');
  }

  // 프록시 응답에는 항상 x-ripple-proxy 헤더가 있다. 없으면 프록시가 배포되지 않은 환경(예: 로컬 개발 서버).
  // 501은 프록시는 있으나 서버에 GEMINI_API_KEY가 설정되지 않은 경우.
  if (viaProxy && (!res.headers?.get?.('x-ripple-proxy') || res.status === 501)) {
    throw new AnalyzeError('NOPROXY', '서버 키가 설정되지 않았습니다.');
  }

  if (!res.ok) {
    // Google이 보낸 오류 메시지를 함께 보여 줘야 원인(모델명, 권한, 과부하 등)을 알 수 있다.
    let detail = '';
    try { detail = (await res.json())?.error?.message || ''; } catch { /* 본문 없음 */ }
    const msg = `HTTP ${res.status}${detail ? ` · ${detail}` : ''}`;
    if (res.status === 429) throw new AnalyzeError('QUOTA', `무료 API 할당량을 초과했습니다. (${msg})`);
    const keyProblem = /api key|permission|denied/i.test(detail) || res.status === 401 || res.status === 403;
    if (keyProblem) throw new AnalyzeError('AUTH', msg);
    if (res.status === 404) throw new AnalyzeError('MODEL', msg);
    if (res.status === 400) throw new AnalyzeError('REQUEST', msg);
    throw new AnalyzeError('SERVER', msg); // 500/503 등: Google 쪽 일시 오류
  }

  let json;
  try {
    json = await res.json();
  } catch {
    throw new AnalyzeError('PARSE', 'API 응답을 읽지 못했습니다.');
  }
  const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('');
  return parseModelJson(text);
}
