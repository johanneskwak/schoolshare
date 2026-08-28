# Checklist: 교사 전용 나눔·소모임 플랫폼

## Tasks

- [ ] T1 Next.js(App Router, TS) 초기화 + Supabase 서버/클라이언트 헬퍼 + 환경 변수 로딩 (req: R1)
- [ ] T2 마이그레이션 1: `profiles`, `schools`, `is_approved()`, `is_admin()`, RLS (req: R2, R4, R22) (after: T1)
- [ ] T3 가입·로그인 화면과 Server Action, `profiles` 행 `pending` 생성 (req: R1, R2) (ac: AC1) (after: T2)
- [ ] T4 `middleware.ts` 게이팅 + `/pending` + 거절 안내 화면 (req: R2, R5) (ac: AC1) (after: T3)
- [ ] T5 `/admin/approvals` 승인·거절 화면과 Server Action (req: R3) (ac: AC2) (after: T3)
- [ ] T6 카테고리 상수 모듈 + 학교급·카테고리 `CHECK` 제약 마이그레이션 2 (req: R6, R7) (ac: AC4) (after: T2)
- [ ] T7 마이그레이션 3: `item_types`, `share_posts`, `share_post_images`, `share_comments`, RLS, 사진/상태전이/예약중댓글 트리거 (req: R9, R10, R11, R12, R13, R14, R15, R16) (ac: AC6, AC7, AC8, AC9) (after: T6)
- [ ] T8 Storage 업로드 유틸 + 최대 장수 파라미터화된 이미지 업로드 컴포넌트 (req: R10, R19) (ac: AC6) (after: T2)
- [ ] T9 나눔 목록 화면: 카테고리 필터, 상태 태그 (req: R8, R11) (ac: AC5) (after: T7)
- [ ] T10 나눔 작성 화면 + `carbon_g` 스냅샷 저장 Server Action (req: R9, R10, R16) (ac: AC6, AC10) (after: T7, T8)
- [ ] T11 나눔 상세: 사진 뷰어, 예약/취소/완료, 댓글(예약중 비활성화) (req: R12, R13, R14, R15) (ac: AC7, AC8, AC9) (after: T9)
- [ ] T12 마이그레이션 4: `club_posts`, `club_post_images`, `club_comments`, RLS, 사진 2장 트리거 (req: R18, R19, R20) (ac: AC11) (after: T6)
- [ ] T13 소모임 목록·작성·상세 + 댓글 (req: R18, R19, R20) (ac: AC11) (after: T12, T8)
- [ ] T14 `/api/schools/search` 카카오 프록시(호출부 단일화·호출 카운트 가능) + 디바운스 검색 UI (req: R21) (ac: AC12) (after: T2)
- [ ] T15 검색 결과 학교 전체 `schools` upsert, 서비스 롤 클라이언트 사용 (req: R22, R34) (ac: AC13, AC17, AC22) (after: T14)
- [ ] T16 마이그레이션 5: `school_review_questions`, `school_reviews`, `school_review_answers`, RLS, 점수 제약, `school_rating_summary` 뷰 (req: R23, R24, R25, R26) (ac: AC14) (after: T2)
- [ ] T17 학교 상세: 질문별 평균, 전체 평균, 참여자 수, 별점 입력·수정 (req: R23, R24, R25) (ac: AC14) (after: T16, T15)
- [ ] T18 `/admin/questions` 질문 추가·수정·비활성화 (req: R26) (ac: AC15) (after: T16, T5)
- [ ] T19 `user_carbon_totals` 뷰 + 내 설정(닉네임 고유성, 학교 변경, 탄소량, 내 글 모아보기) (req: R17, R27, R28, R29) (ac: AC10, AC16) (after: T11, T13, T15)
- [ ] T20 시드 스크립트 + RLS·제약 조건 검증 스크립트 (req: R4) (ac: AC3, AC4) (after: T7, T12, T16)
- [ ] T21 마이그레이션 6: `school_search_cache`, `school_search_cache_items`, 인덱스, 읽기 전용 RLS (req: R30, R31, R34) (ac: AC22) (after: T15)
- [ ] T22 검색어 정규화 유틸 + 캐시 조회·기록 로직 + 90일 만료 처리 (req: R30, R31, R32, R33) (ac: AC18, AC19, AC20, AC21) (after: T21)

## Acceptance Criteria

- [ ] AC1 가입 후 `profiles.status = 'pending'`, `/share` 접근 시 승인 대기 화면
- [ ] AC2 관리자가 승인하면 `status = 'approved'`로 바뀌고 목록에서 사라짐
- [ ] AC3 미승인 토큰으로 `share_posts` 직접 조회 시 RLS로 0행
- [ ] AC4 `elementary` + `수학` 저장 시 제약 위반으로 실패
- [ ] AC5 `secondary` + `과학` 필터 시 해당 글만 노출
- [ ] AC6 사진 5장 거절, 4장은 저장되고 상세에 4장 모두 표시
- [ ] AC7 예약 시 "예약중" 태그로 전환, 세 번째 계정의 중복 예약 실패
- [ ] AC8 `reserved` 상태에서 댓글 입력창 비활성화 + API 직접 삽입도 거절, 기존 댓글 유지
- [ ] AC9 예약 취소 시 "나눔중" 복귀, `completed` → `available` 되돌리기 실패
- [ ] AC10 500g 품목 글을 `completed`로 바꾸면 누적 탄소량 정확히 +500g, `reserved`에서는 증가 없음
- [ ] AC11 소모임 사진 2장 저장·댓글 정상, 3장은 거절
- [ ] AC12 `/api/schools/search?q=언남` 정상 응답, 클라이언트 번들에 카카오 키 미포함
- [ ] AC13 같은 학교를 두 사용자가 선택해도 `schools` 행은 하나
- [ ] AC14 4점 + 5점 → 평균 4.5, 같은 계정이 3점으로 수정 → 4.0
- [ ] AC15 질문 비활성화 시 평가 화면에서 제외, 기존 평균에는 유지
- [ ] AC16 중복 닉네임 저장 실패, 내 글 모아보기에 나눔·소모임 글 모두 노출
- [ ] AC17 검색 결과 10개면 선택하지 않아도 `schools`에 10행 생성
- [ ] AC18 같은 검색어 2회 검색 시 카카오 호출은 1회, 결과 동일
- [ ] AC19 `" 언남  초 "`와 `"언남 초"`가 같은 캐시 항목 사용, 2회차 호출 없음
- [ ] AC20 `fetched_at`을 91일 전으로 조작 후 재검색 시 재호출 + 시각 갱신
- [ ] AC21 캐시 히트 결과 순서가 캐시 미스 때와 동일
- [ ] AC22 승인 교사 토큰으로 `schools`·캐시 테이블 직접 INSERT 시 RLS 거부

## Human Checks

- [ ] 가입 → 대기 → 승인 → 재로그인 흐름이 끊기지 않는가
- [ ] 나눔 상세에서 사진 4장과 상태 태그가 한눈에 들어오는가
- [ ] 예약중 댓글 차단에 대한 안내 문구가 이해되는가
- [ ] 실제 학교명 검색 시 원하는 학교가 상위에 나오고 학원 등이 섞이지 않는가
- [ ] 질문 수가 늘어나도 별점 입력 UI가 쓸 만한가
- [ ] 모바일 화면 폭에서 4개 탭 이동과 글 작성이 가능한가
- [ ] 누적 탄소량 표시 단위가 사용자에게 의미 있게 읽히는가
- [ ] 캐시 작업(T21) 착수 전에 카카오 API 응답 데이터의 저장·캐싱 허용 범위를 카카오 정책·데브톡으로 확인했는가
- [ ] "언남초" / "언남초등학교"처럼 표현이 다를 때 캐시가 안 맞는 게 실제로 불편한 수준인가
