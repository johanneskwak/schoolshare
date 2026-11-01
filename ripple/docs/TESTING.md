# 테스트 현황

## A. 의존성 없이 실행 가능 (Node 18+)

```bash
node --test "tests/*.test.js"
```

| 항목 | 상태 | 비고 |
|---|---|---|
| 1. API 연동 / Mock fallback (`logic.test.js` 1-a~1-g) | **실행함 · 통과 (7/7)** | fetch는 가짜 함수로 대체. 실제 Gemini 호출은 **미검증** |
| 3. 채점 · 날짜별 저장 · 새로고침 후 유지 (3-a~3-f) | **실행함 · 통과 (6/6)** | "새로고침"은 같은 저장소에서 `loadState`를 다시 호출해 시뮬레이션. 실제 브라우저 새로고침은 아래 B 참조 |
| 2. KaTeX 렌더링 (`katex.test.js`) | **미실행 (skip 9건)** | `npm install` 후 같은 명령으로 실행됨. skip은 통과가 아님 |

## B. 브라우저 콘솔 / 수동 확인 (모두 **미실행**)

`npm run dev` 후 개발자도구 콘솔에서 확인합니다.

1. 수식 렌더링: 콘솔에서 `document.querySelectorAll('[data-math-error]').length` 가 `0`, `.katex-error` 가 없음.
2. 새로고침 유지: 문제 저장, 채점, 복습 등록 후 F5. `JSON.parse(localStorage.getItem('ripple:v1')).reviews.map(r => r.dueDate)` 가 `[오늘+1, +3, +7]`.
3. 날짜 포맷: 위 값이 모두 `YYYY-MM-DD` 형식인지 확인 (`/^\d{4}-\d{2}-\d{2}$/`).
4. Mock 모드: 키 없이 분석 시 「Mock 데이터」 문구 표시. 네트워크 탭에 Gemini 요청 없음.
5. 실제 API: 키 입력 후 분석 시 요청 URL에 키가 없고 헤더 `x-goog-api-key`로만 전송됨.
6. 할당량 오류 화면: 개발자도구 네트워크 차단(오프라인) 또는 잘못된 키로 에러 카드 확인.
7. 저장 용량: `localStorage.getItem('ripple:v1').length` 가 5,000,000 미만인지, 사진 20장 저장 후 확인.
8. 390px 폭에서 홈 첫 화면에 「오늘의 복습」 카드와 FAB가 스크롤 없이 보이는지.
