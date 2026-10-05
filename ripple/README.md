# 리플 (Ripple)

틀린 수학 문제를 사진으로 찍으면 수식을 LaTeX로 읽고, 유사 문제 3개를 만들어 풀게 한 뒤, 1일·3일·7일 뒤 복습 일정을 자동으로 잡아 주는 모바일 웹앱입니다. 서버 없이 브라우저(LocalStorage)에만 저장합니다.

> 상태: 구현, 자동 테스트(32개), 빌드, 390px 브라우저 확인 완료. 실제 모바일 기기 카메라와 Vercel 배포 후 동작은 아직 확인하지 않았습니다. `docs/TESTING.md`, `docs/RELEASE_CHECKLIST.md` 참고.

## 디자인 테마 (Claude 스타일)

| 토큰 | 값 | 용도 |
|---|---|---|
| `paper` | `#FAF9F5` | 배경 (부드러운 오프화이트) |
| `sand` / `line` | `#F0EEE6` / `#E8E6DC` | 보조 면 / 절제된 선 |
| `ink` / `mute` | `#3D3929` / `#83827D` | 본문 / 보조 텍스트 |
| `coral` | `#C96442` (hover `#AE5130`) | 포인트(테라코타) |

제목은 세리프, 본문은 산세리프. 카드는 `rounded-2xl` + 1px 선, 그림자는 FAB와 고정 버튼에만 사용합니다. 정의는 `tailwind.config.js`, `src/index.css` 에 있습니다.

## 무료 API 키 발급과 설정

1. <https://aistudio.google.com/apikey> 에서 Google 계정으로 로그인해 키를 만듭니다.
2. 앱 우상단 ⚙ → 키 붙여넣기 → 저장.
3. 키를 비우면 **Mock 모드**(고정 샘플 3종)로 동작합니다.

키는 이 기기의 LocalStorage에만 저장되며, 분석 요청 때 헤더(`x-goog-api-key`)로 Google에만 전송됩니다. 공용 기기에서는 사용 후 「키 삭제」를 누르세요. 사용 모델 후보는 `src/lib/gemini.js` 의 `MODELS` 목록이며, 앞에서부터 시도하고 404(모델 없음)이면 다음 모델로 넘어갑니다. 503(과부하)은 같은 모델에 최대 2번 재시도합니다.

## 로컬 실행

```bash
npm install
npm run dev      # 개발 서버
npm run build    # 배포용 빌드 (dist/)
npm test         # 의존성 없는 로직 테스트 (KaTeX 테스트는 install 후 실행됨)
```

Node 18 이상이 필요합니다.

## 배포 방법 (Vercel)

리플은 서버가 없는 정적 사이트라서 빌드 결과(`dist/`)만 올리면 됩니다. API 키는 사용자가 앱에서 직접 입력하므로 **환경 변수는 필요 없습니다.**

### 대시보드로 배포 (권장)

1. <https://vercel.com/new> 에서 이 저장소를 Import 합니다.
2. **Root Directory** 를 `ripple` 로 지정합니다. 저장소 루트에는 다른 프로젝트도 있으므로 꼭 필요합니다.
3. Framework Preset 은 `Vite` 로 인식됩니다. 빌드 설정은 `ripple/vercel.json` 에 이미 들어 있습니다.
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. **Deploy** 를 누릅니다. 이후 `main` 에 푸시하면 자동으로 다시 배포됩니다.

### CLI로 배포

```bash
cd ripple
npm i -g vercel
vercel          # 미리보기 배포
vercel --prod   # 운영 배포
```

처음 실행하면 프로젝트 연결 질문이 나옵니다. 이때도 Root Directory 가 `ripple` 인지 확인하세요.

### 배포 전 확인

```bash
cd ripple
npm ci          # package-lock.json 기준으로 설치
npm test        # 로직·KaTeX 테스트
npm run build   # dist/ 생성 확인
```

### 배포 후 확인

- 브라우저 콘솔에 `Content Security Policy` 오류가 없는지 봅니다. `vercel.json` 의 보안 헤더는 Vercel 이 적용합니다.
- 스마트폰(HTTPS 주소)에서 **카메라** 버튼으로 후면 카메라가 열리는지 봅니다.
- 설정 ⚙ 에서 키를 넣고 사진 한 장을 분석해 봅니다. 키가 없어도 Mock 모드로 동작합니다.
- 더 자세한 점검 항목은 `docs/RELEASE_CHECKLIST.md` 를 참고하세요.

### Netlify 등 다른 곳에 배포할 때

Base directory `ripple`, Build `npm run build`, Publish `dist` 로 지정하면 동작합니다. 다만 `vercel.json` 의 보안 헤더(CSP 등)는 Vercel 전용이라 적용되지 않습니다. Netlify 에서는 `_headers` 파일이나 `netlify.toml` 로 같은 헤더를 직접 설정해야 합니다.

## 폴더 구조

```
src/lib/      gemini.js(API·파싱) mock.js schedule.js(날짜) answer.js(채점) store.js(저장) image.js(압축)
src/screens/  Home Scan Solve Planner Records
src/components/ Math(KaTeX) RichText ApiKeyModal ui
tests/        logic.test.js katex.test.js
docs/         기획·화면·데이터, TESTING.md, RELEASE_CHECKLIST.md
```

## 데이터 저장 구조 (LocalStorage 키 `ripple:v1`)

```json
{
  "version": 1,
  "settings": { "apiKey": "" },
  "problems": [{ "id": "", "latex": "", "topic": "", "tags": [], "answer": "", "explanation": "", "imageData": null, "source": "gemini|mock", "similar": [{ "id": "s1", "latex": "", "answer": "", "explanation": "" }] }],
  "attempts": [{ "problemId": "", "itemId": "orig|s1|s2|s3", "userAnswer": "", "correct": true, "at": "" }],
  "reviews":  [{ "id": "", "problemId": "", "round": 1, "dueDate": "YYYY-MM-DD", "done": false }]
}
```

필드별 필수 여부와 검증 규칙은 `docs/01-03-plan-screens-data.md` 에 있습니다. 날짜는 UTC 어긋남을 피하려고 로컬 기준 문자열로만 다룹니다.

## 보안 원칙

- 사용자·AI 텍스트는 HTML로 해석하지 않습니다. 일반 텍스트는 React가 이스케이프하고, 수식은 KaTeX(`trust:false`)만 렌더링합니다.
- 개인정보(이름, 이메일, 위치)는 수집하지 않습니다.

## 알려진 제한 사항

- 무료 API는 분당/일일 요청 한도가 있어 초과 시 429가 납니다(앱은 안내 후 재시도·Mock 선택 제공). 한도 수치는 바뀔 수 있으니 공식 문서를 확인하세요.
- AI가 만든 유사 문제의 정답이 틀릴 수 있습니다. 해설을 함께 확인하세요.
- 수식 텍스트 위주입니다. 그래프·도형·손글씨는 인식이 불안정합니다.
- 정답 비교는 문자열 정규화와 숫자·분수 값 비교입니다. `x=2` 와 `2` 처럼 형식이 다르거나 동치인 식은 오답 처리될 수 있습니다.
- LocalStorage 약 5MB 한도, 기기 간 동기화 없음, 브라우저 데이터를 지우면 기록도 사라집니다.
- API 키가 평문으로 브라우저에 저장됩니다.

## 다음 버전 권장 작업

| 우선순위 | 작업 | 이유 |
|---|---|---|
| 1 | 백업/복원(JSON 내보내기·가져오기) + 저장 용량 표시 | 데이터 유실이 가장 큰 사용자 리스크 |
| 2 | 정답 판정 개선(수식 동치 판정 또는 객관식 선택) + 틀린 문제 재풀이 기반 복습 완료 | 채점 신뢰도가 학습 효과를 좌우 |
| 3 | 키를 서버리스 프록시로 이전하거나 IndexedDB 이미지 저장, 복습 알림(PWA) | 키 노출 위험 감소, 용량 한계 해소 |
