# 배포 전 체크리스트 (Vercel / Netlify) — 직접 배포하지 않고 점검만

각 항목은 **확인 전**입니다. 직접 확인한 뒤 체크하세요.

## 빌드 · 배포 설정
- [ ] `npm install && npm run build` 성공, `dist/` 생성
- [ ] Vercel: Framework = Vite, Output = `dist` / Netlify: Build `npm run build`, Publish `dist`
- [ ] 환경 변수 불필요 (API 키는 사용자 입력). 저장소·빌드 로그에 키가 없음
- [ ] HTTPS로 서비스됨 (모바일 카메라 `capture` 와 보안 컨텍스트 요건)
- [ ] 보안 헤더 권장: `Content-Security-Policy` 에 `connect-src 'self' https://generativelanguage.googleapis.com`, `img-src 'self' data: blob:`

## 사용자 API 키 안내
- [ ] 키 모달에 「이 기기에만 저장 · Google로만 전송 · 공용 기기에서는 삭제」 안내가 보임 (구현됨)
- [ ] 키는 URL 쿼리가 아닌 헤더로 전송 (테스트 1-b로 확인됨)
- [ ] 키는 LocalStorage 평문 저장이므로 XSS 방지가 중요: 사용자 입력에 `dangerouslySetInnerHTML` 미사용, KaTeX `trust:false` (코드상 구현, 브라우저 검증은 미실행)
- [ ] 무료 한도(분당/일일 요청 수)는 변경될 수 있으므로 배포 시점에 공식 문서로 재확인

## LocalStorage 용량
- [ ] 이미지는 긴 변 1024px, JPEG 0.7로 압축 (구현됨). 한 장 크기 실측: 보통 100~250KB 예상 (**실측 전**)
- [ ] 한계 약 5MB → 사진 문제 20~40개 수준 예상. QuotaExceeded 시 오류 카드 표시 (구현됨)
- [ ] 개선 후보: 용량 사용량 표시, 오래된 이미지 자동 정리, IndexedDB 이전
- [ ] 브라우저 데이터 삭제·시크릿 모드에서는 데이터가 사라짐을 README에 명시

## 모바일 카메라 · 호환성
- [ ] iOS Safari, Android Chrome에서 「카메라」 버튼이 후면 카메라를 여는지 (`capture="environment"`)
- [ ] 권한 거부 시 「앨범」으로 대체 가능한지
- [ ] `createImageBitmap` 지원 확인 (iOS 15+ 권장). 미지원 시 업로드 오류 안내가 뜨는지
- [ ] 큰 사진(10MB+) 업로드 시 메모리 부족 없이 압축되는지
- [ ] 390px 폭, 노치/홈바(`safe-area-inset-bottom`) 확인

## 번들 크기
- [ ] `dist/assets` 의 JS/CSS gzip 크기 기록 (KaTeX CSS + 폰트가 가장 큼, 폰트는 woff2 위주로 로드)
- [ ] 목표 예시: 초기 JS gzip 200KB 이하. 초과 시 KaTeX를 동적 import로 분리
- [ ] Lighthouse 모바일 성능/접근성 점수 기록

## 기능 최종 확인
- [ ] `node --test "tests/*.test.js"` 통과, `npm install` 후 KaTeX 테스트 9건도 통과
- [ ] `docs/TESTING.md` 의 브라우저 확인 8항목 완료
