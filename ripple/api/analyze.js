// Vercel 서버리스 함수: 브라우저 대신 Gemini API를 호출한다.
// API 키는 환경변수 GEMINI_API_KEY 에서만 읽는다. 코드·저장소·브라우저 번들에는 키가 없다.
// 주의: 이 주소를 아는 누구나 이 함수를 통해 서버 키의 할당량을 쓸 수 있다.
import { MODELS } from '../src/lib/gemini.js';

const MAX_BODY_BYTES = 4 * 1024 * 1024; // Vercel 함수 요청 한도(4.5MB) 안쪽

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  // 프록시가 살아 있다는 표시. 클라이언트는 이 헤더가 없으면 프록시가 없는 환경으로 판단한다.
  res.setHeader('x-ripple-proxy', '1');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') return send(res, 405, { error: { message: 'Method not allowed' } });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return send(res, 501, { error: { message: 'GEMINI_API_KEY is not configured' } });

  // 다른 사이트의 브라우저가 이 함수를 끌어다 쓰지 못하게 같은 출처만 허용 (curl 같은 직접 호출까지 막지는 못한다)
  const origin = req.headers.origin;
  if (origin) {
    let sameHost = false;
    try { sameHost = new URL(origin).host === req.headers.host; } catch { /* 잘못된 Origin */ }
    if (!sameHost) return send(res, 403, { error: { message: 'Cross-origin request blocked' } });
  }

  const length = Number(req.headers['content-length'] || 0);
  if (length > MAX_BODY_BYTES) return send(res, 413, { error: { message: 'Request too large' } });

  const model = new URL(req.url, 'http://localhost').searchParams.get('model');
  if (!MODELS.includes(model)) return send(res, 400, { error: { message: 'Unsupported model' } });

  const body = req.body && typeof req.body === 'object' ? req.body : null;
  if (!body || !Array.isArray(body.contents)) return send(res, 400, { error: { message: 'Invalid request body' } });

  let upstream;
  try {
    upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      // 필요한 필드만 전달한다 (tools, systemInstruction 등은 막는다)
      body: JSON.stringify({ contents: body.contents, generationConfig: body.generationConfig }),
    });
  } catch {
    return send(res, 502, { error: { message: 'Upstream request failed' } });
  }

  // Google의 상태 코드와 본문을 그대로 돌려준다 (클라이언트의 오류 분류가 똑같이 동작하도록).
  res.statusCode = upstream.status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(await upstream.text());
}
