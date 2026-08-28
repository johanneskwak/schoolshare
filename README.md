# TeacherTown

승인된 교사만 이용하는 폐쇄형 커뮤니티. 물건 나눔(+탄소 절감량 적립), 소모임 모집,
카카오 API 기반 학교 검색 + 학교별 평판 별점을 제공한다. 스펙 원본은
[`docs/prd.md`](docs/prd.md)를 참고한다.

## 아키텍처

- **프레임워크**: Next.js 15 (App Router) + TypeScript, 클라이언트/서버 컴포넌트 혼용.
- **데이터베이스**: Supabase Postgres. ORM 없이 `@supabase/supabase-js` + `@supabase/ssr`로
  직접 접근하고, 스키마는 `supabase/migrations/`의 SQL 마이그레이션으로 관리한다.
- **인증**: Supabase Auth(이메일+비밀번호). `middleware.ts`가 세션을 갱신하고 승인 상태에
  따라 `/pending`, `/rejected`, `/login`으로 리다이렉트하지만, 이건 UX용 게이트일 뿐이다.
  **실제 접근 차단은 모든 테이블의 Row Level Security가 담당한다.**
- **파일 저장**: Supabase Storage. `share-images`, `club-images`, `post-attachments`
  세 개의 비공개 버킷을 쓰고, 읽기는 서버가 `service_role`로 서명 URL을 발급해서
  내려준다 (`lib/storage/signed-url.ts`).
- **외부 API**: 카카오 로컬 키워드 검색. 호출부는 `app/api/schools/search/route.ts` 단
  하나뿐이며, 검색 결과는 90일짜리 캐시(`school_search_cache*`)를 거친다.

### 데이터 접근 위치

- 목록·상세 조회: Server Component에서 세션 기반 Supabase 클라이언트(`lib/supabase/server.ts`
  의 `createClient()`)로 수행. RLS가 적용된다.
- 작성·예약·상태 변경·평가 제출 등 쓰기: Server Actions (`**/actions.ts`).
- 학교 검색·캐시·`schools` 테이블 쓰기: `createServiceRoleClient()`로 만든 관리자 클라이언트만
  사용한다. 이 함수는 절대 클라이언트 컴포넌트로 넘기지 않는다.

## 환경 변수

`.env.example` 참고. 실제 값은 아래에서 발급받아 `.env.local`에 채운다.

| 변수 | 위치 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 설정 > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 프로젝트 설정 > API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 프로젝트 설정 > API > service_role (서버 전용) |
| `KAKAO_REST_API_KEY` | 카카오 개발자 콘솔 > 내 애플리케이션 > 앱 키 (서버 전용) |

## Supabase 설정 (Pre-Work)

1. Supabase 프로젝트를 만들고 Auth의 Email 제공자를 켠다. 로컬 개발 중에는 이메일 확인을
   꺼도 된다(`supabase/config.toml`의 `enable_confirmations = false`가 로컬 스택 기준값).
2. Storage에 비공개 버킷 세 개를 만든다: `share-images`, `club-images`, `post-attachments`.
3. 카카오 개발자 콘솔에서 애플리케이션을 만들고 REST API 키를 발급받는다.
4. 마이그레이션 적용:
   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```
   또는 로컬 스택: `npx supabase start` (Docker 필요) 후 `npx supabase db reset`.
5. 최초 관리자 계정은 대시보드에서 직접 만든 뒤 `profiles.role`을 `admin`, `status`를
   `approved`로 수동으로 바꾼다. 관리자 승격 화면은 없다.
6. `npm run seed` — 관리자 1, 승인 교사 2, 미승인 교사 1, 기본 품목 유형, 기본 평가 질문을
   만든다. `SUPABASE_SERVICE_ROLE_KEY`가 필요하다.

## 로컬 개발

```bash
npm install
cp .env.example .env.local   # 값 채우기
npm run dev
```

`npm run typecheck`, `npm run lint`, `npm run build`로 정적 검증을 한다.

## 검증

```bash
npm run seed     # 시드 데이터 생성
npm run verify   # RLS·제약 조건 검증 스크립트 (scripts/verify-rls.ts)
```

`scripts/verify-rls.ts`는 PRD의 `Verification - Agent` 항목 대부분을 자동으로 확인한다.
카카오 호출 횟수 검증(같은 검색어 재호출 시 API가 안 불리는지, 90일 만료 후 재호출되는지)은
`/api/schools/search`에 대한 별도 통합 테스트가 필요해 이 스크립트 범위 밖이다.

## Vercel 배포

1. GitHub 저장소를 Vercel에 연결한다.
2. 위 4개 환경 변수를 Vercel 프로젝트 설정에 등록한다(`SUPABASE_SERVICE_ROLE_KEY`,
   `KAKAO_REST_API_KEY`는 반드시 서버 전용으로만 노출되도록 `NEXT_PUBLIC_` 접두사를 쓰지
   않는다 — 이미 코드에서 그렇게 되어 있다).
3. 배포 후 Supabase Auth의 리다이렉트 URL에 배포 도메인을 추가한다.

## 폴더 구조

```
app/
  (auth)/login, /signup           로그인·가입
  pending, rejected               승인 대기/거절 안내
  (app)/share                     나눔 목록·작성·상세
  (app)/clubs                     소모임 목록·작성·상세
  (app)/schools                   학교 검색·상세·평가
  (app)/me                        내 설정, 내 글, 탄소량
  admin/approvals, admin/questions
  api/schools/search              카카오 프록시 (호출부 단일화)
lib/
  supabase/                       서버·클라이언트·미들웨어 헬퍼, DB 타입
  constants/categories.ts         소모임 학교급-카테고리 매핑 (DB CHECK 제약과 동기화 필요)
  constants/share.ts              나눔/대여 카테고리·학년군·교과목·물건상태 상수 (DB CHECK 제약과 동기화 필요)
  schools/normalize.ts            검색어 정규화 (캐시 키)
  storage/signed-url.ts           비공개 버킷 서명 URL 발급
  format.ts                       날짜·파일크기 표시 포맷 유틸
supabase/migrations/              0001~0016 SQL 마이그레이션
scripts/                          seed.ts, verify-rls.ts
docs/                             prd.md, checklist.md, context-notes.md, DESIGN.md
```
