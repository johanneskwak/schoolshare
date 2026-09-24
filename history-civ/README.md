# 역사 문명전 (History Civ)

중2 역사(프랑스 혁명 · 산업혁명 · 제국주의) 테마의 동시 턴제 멀티플레이 전략 게임. 설계는 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)를 본다.

## 실행

1. Supabase 대시보드에서 **Anonymous sign-ins**를 켠다.
2. `supabase/migrations/`의 SQL을 순서대로 적용한다 (`supabase db push` 또는 SQL Editor).
3. `.env.example`을 `.env.local`로 복사하고 URL과 publishable key를 채운다.
4. `npm install` → `npm run dev`

> Google Drive 폴더(G:)에서는 `npm install` 결과가 깨진다(파일 손상, junction 미지원). 실행은 로컬 복사본 `C:\dev\history-civ`에서 한다:
> `robocopy "G:\내 드라이브\coding\claudecode\history-civ" C:\dev\history-civ /MIR /XD node_modules dist` 후 그 폴더에서 `npm.cmd install`, `npm.cmd run dev`.
>
> 개발 서버에서 `/?demo`를 열면 로그인 없이 맵/명령 UI를 볼 수 있다.

공유 Supabase 프로젝트(schoolshare)에 들어가므로 모든 테이블/함수/타입은 `hc_` 접두어를 쓴다.

## 구조

```
src/
  lib/supabase.ts      클라이언트
  lib/api.ts           RPC 래퍼 (상태 변경의 유일한 경로)
  lib/time.ts          서버 시각 보정, 남은 시간 계산
  lib/actions.ts       이번 턴 명령 큐 (유닛당 명령 1개 등)
  lib/rules.ts         서버 정산 규칙 미러 (이동/공격 가능 칸, 도시 건설, 생산, 시설)
  components/GameMap.tsx     SVG 타일 맵, 클릭으로 이동/공격 명령
  components/CommandPanel.tsx 선택 대상별 명령 (도시 건설, 생산, 시설, 이념 전파)
  components/VictoryPanel.tsx 문명별 과학/문화 승리 진행도
  components/ResultScreen.tsx 게임 종료 결과 (승리 유형, 최종 순위)
  components/LeaderboardScreen.tsx 전체 리더보드 (hc_leaderboard_ranked 뷰)
  lib/victory.ts       승리 진행도 계산 (서버 판정 기준 미러)
  store/gameStore.ts   Zustand: 스냅샷, 입력 중인 명령, 이벤트
  hooks/useAuth.ts     익명 로그인 + 닉네임
  hooks/usePresence.ts 접속 표시
  hooks/useLobby.ts    대기실 (준비/진영/시작/나가기)
  hooks/useGameSync.ts 신호 → 스냅샷 동기화, 명령 자동 저장, 턴 종료
  hooks/useTurnTimer.ts 타이머, 만료 시 try_resolve_turn
```
