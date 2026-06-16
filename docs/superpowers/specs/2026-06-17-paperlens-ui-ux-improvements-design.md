# PaperLens UI/UX 개선 — 설계 (Design)

- 날짜: 2026-06-17
- 범위: 코드 정독으로 확인한 15개 UI/UX 문제(5개 묶음) 수정 + 발견성 강화 레이어
- 상태: 설계 승인됨 (스펙 리뷰 대기)

## 1. 배경 / 목적

PaperLens(Next.js 15 + React 19 + Zustand, Gemini Flash, Upstash Redis)의 UI/UX를
컴포넌트 단위로 정독해 15개 문제를 5개 묶음(발견성 / 피드백·상태 / 일관성 /
모바일·반응형 / 접근성)으로 정리했다. 방금 정밀 감사 수정으로 안정화한 `main`
위에, **재작성 없이 표적 수정 + 발견성 레이어**를 얹는다.

작업 강도는 **Level 2 (표준화 + 발견성 강화)**로 합의했다: 15개를 모두 고치되,
High 등급인 발견성·피드백 묶음은 한 단계 더 손본다. 사이드바 탭 구조 재설계나
모바일 바텀시트 시스템 통합 같은 큰 재작성(Level 3)은 하지 않는다.

## 2. 결정 사항 (확정)

| 결정 | 선택 | 근거 |
|------|------|------|
| 작업 강도 | **Level 2 — 표준화 + 발견성 강화** | 안정화된 코드 위 점진 개선. 재작성 위험 회피, High 묶음만 한 단계 더 |
| 발견성 방식 | **혼합 (상시 어포던스 + 가이드 진입점 승격)** | 처음 사용자는 투어로, 돌아온 사용자는 상시 단서로. 두 방식의 약점을 상호 보완 |
| AI 색 정체성 | **파랑(브랜드/액션) + 보라(AI 전용 의미색) 역할 분리** | 보라를 "AI가 한 것"의 의미색으로 못박아 채팅·요약·AI 탭을 일관화, 일반 기능과 구분 |
| z-index | **`globals.css`에 단계 스케일 신설** | 현재 Toast·GuideOverlay가 둘 다 `z-[200]`으로 충돌. 단계 정의로 근본 정리 |

### 횡단 토큰 (먼저 도입)

- **AI 보라 토큰:** AI 영역의 `blue-*` Tailwind 클래스를 `purple-*` 계열로 치환.
  디자인 시스템 전면 도입이 아니라 기존 클래스 치환 수준. 앱 액션/브랜드는 `blue-600` 유지.
- **z-index 스케일:** `globals.css`에 의미 단계 정의 후 각 컴포넌트가 참조.
  현재 실측값: header `z-40`, 모바일 drawer backdrop `z-30` / drawer `z-[35]`,
  PDFViewer 플로팅 번역 버튼 `z-50`, Help/Usage 팝오버 `z-50`,
  CookieConsent `z-[150]`, Toast `z-[200]`, GuideOverlay `z-[200]/201/202`.
  제안 단계(낮음→높음): base/highlight < header < drawer-backdrop < drawer <
  floating-action < popover < cookie < toast < guide-overlay.

## 3. 작업 단위 (묶음별, 독립 검증 가능)

### 묶음 ① 발견성 (혼합)
- **드래그 번역 상시 단서** · `src/components/PDFViewer.tsx` — PDF 영역에 항상 보이는
  미세 힌트("텍스트를 드래그하면 번역"). 사용자가 한 번 번역하면 사라지고
  `localStorage` 플래그로 재노출하지 않음. 플로팅 번역 버튼(`:1090-1109`)은 유지.
- **가이드 재생 진입점 승격** · `src/app/page.tsx`, `src/components/HelpButton.tsx` —
  헤더에 "가이드 다시보기" 버튼/아이콘 노출. 현재는 HelpButton 메뉴(`:150-158`)에 묻힘.
  store의 가이드 시작 액션을 헤더에서 직접 호출.
- **터치 단축키 대체** · 관련 컴포넌트 — 단축키는 데스크톱 전용임을 전제로, 터치
  기기에서는 `title` 툴팁 의존을 줄이고 버튼형 단서를 노출. (단축키 자체는 데스크톱 유지)

### 묶음 ② 피드백 / 상태
- **텍스트 추출 실패 안내** · `src/components/PDFViewer.tsx`(`:246-248`), store —
  dev-only `console.error` → 사용자에게 `paperlens-toast` 오류 + 빈 패널에 안내 문구
  ("이 PDF는 텍스트 추출이 어렵습니다" 류).
- **스크롤 모드 로딩 플레이스홀더** · `src/components/PDFViewer.tsx` — 렌더 전 빈 흰
  페이지 박스 대신 스켈레톤/로딩 표시.
- **채팅 글자수 피드백** · `src/components/ChatPanel.tsx`(`:159,382`) — 2000자 초과
  붙여넣기가 말없이 잘리는 문제. 글자수 카운터를 입력 전에도 상시 노출하고 초과
  근접/초과 시 시각 경고.
- **모바일 추출 진행률** · `src/components/PageNavigator.tsx`(`:121`) — `hidden sm:flex`
  제거 또는 모바일 대체 표시로 추출 진행률을 모바일에서도 노출.

### 묶음 ③ 일관성
- **검색 버튼 3상태 라벨** · `src/components/SearchBar.tsx`(`:154-172`) — 현재 검색어
  없을 때 "추가", 검색 중 "취소"만 존재("검색" 없음). → 검색어 미등록 시 **"검색"**,
  등록된 검색어 있을 때 "추가", 검색 활성 시 "취소"로 3상태 명확화.
- **AI 색 통일** · `src/components/ChatPanel.tsx` — 채팅 말풍선·전송 버튼·예시 질문의
  `blue-*` → `purple-*`. AI 탭/요약(이미 보라)과 일관. 일반 검색 등은 파랑 유지.
- **이전/다음 아이콘 통일** · `src/components/PageNavigator.tsx` — `◀▶` 텍스트 글리프 →
  앱의 다른 곳과 동일한 SVG 아이콘.

### 묶음 ④ 모바일 / 반응형
- **z-index 스케일 적용** · `src/app/globals.css` + 각 컴포넌트 — §2의 스케일을 정의하고
  Toast/GuideOverlay/CookieConsent/header/drawer/플로팅버튼/팝오버가 이를 참조하도록
  치환. Toast와 GuideOverlay의 `z-[200]` 충돌 해소(Guide가 Toast 위).
- **플로팅 번역 버튼 위치** · `src/components/PDFViewer.tsx`(`:957-994,1090-1109`) — 모바일
  OS 기본 선택 툴바와 겹치지 않도록 위치/오프셋 조정(선택 영역 위쪽 배치 등).
- **번역 원문 클램프 완화** · `src/components/TranslationPanel.tsx` — 모바일에서 원문이
  ~2.5줄로 잘리는 제한 완화(펼치기 토글 또는 줄수 상향).

### 묶음 ⑤ 접근성
- **가이드 오버레이 a11y** · `src/components/GuideOverlay.tsx` —
  (1) 포커스 트랩 추가(Tab이 오버레이 밖으로 못 나감),
  (2) **Escape로 닫기** 추가,
  (3) 배경 클릭으로 전체 투어가 종료되던 동작(`:194-197` backdrop `onClick={skipGuide}`)
      제거 — 닫기는 "건너뛰기" 버튼으로만,
  (4) 대상 요소가 없으면(`:138` `el` null) 스포트라이트가 허공을 가리키지 않도록
      중앙 모달로 폴백.
- **키워드 카드 중첩 버튼 제거** · `src/components/KeywordPanel.tsx` — 버튼 안에 버튼이
  중첩된 구조를 카드(div) + 내부 액션 버튼 분리로 교정.
- **결과 목록 aria 보강** · `src/components/ResultList.tsx` — listbox에
  `aria-activedescendant` 등 보강.
- **토스트 role 구분** · `src/components/Toast.tsx`(`:35`) — 전부 `role="alert"`였던 것을
  정보성은 `role="status"`, 오류만 `role="alert"`로.
- **prefers-reduced-motion** · `src/app/globals.css`(`:124-199` 애니메이션들) —
  `@media (prefers-reduced-motion: reduce)` 가드로 애니메이션 축소/제거.

## 4. 명시적으로 제외 (Out of scope)
- 사이드바 탭 구조 재설계, 모바일 바텀시트 시스템 통합 등 큰 재작성(Level 3).
- 디자인 시스템/토큰 체계 전면 도입 — 본 스펙은 기존 Tailwind 클래스 치환 수준만.
- 단축키 체계 자체의 변경(키 매핑 추가/변경). 본 스펙은 발견성·터치 단서만 다룸.
- 키워드 추출/검색 엔진 로직 변경(직전 감사 수정 범위와 분리).

## 5. 검증 계획
1. `npx tsc --noEmit` 타입체크 통과.
2. `npm run build` 통과.
3. fablize 검증 원칙(실제 렌더러 실행 관찰):
   - ① 드래그 힌트가 노출되고, 한 번 번역 후 사라지는지 / 새로고침해도 재노출 안 되는지.
   - ② 텍스트 추출 불가 PDF에서 안내 토스트·빈 패널 문구가 뜨는지.
   - ③ 검색어 없을 때 버튼이 "검색"으로, 등록 후 "추가"로 바뀌는지 / 채팅 글자수 카운터.
   - ④ 모바일 폭에서 하단 고정 요소들이 겹치지 않고 올바른 순서로 쌓이는지.
   - ⑤ 가이드에서 Escape로 닫히는지, Tab 포커스가 오버레이 안에 갇히는지, 배경 클릭으로
        종료되지 않는지.
4. 코드 단위 검증(브라우저 곤란 항목): aria 속성·role 변경·reduced-motion 미디어쿼리는
   정독 + DOM 속성 확인.

## 6. 리스크 / 주의
- **④ z-index 스케일**: 기존 하드코딩 값(`z-[200]` 등)을 스케일로 옮길 때 누락된
  컴포넌트가 있으면 새 충돌이 생길 수 있음 → §2 실측 목록을 체크리스트로 사용.
- **⑤ 가이드 배경클릭 종료 제거**: 기존 사용자 습관(배경 탭으로 닫기)을 바꾸므로,
  "건너뛰기" 버튼이 모든 단계에서 명확히 보이는지 확인 필요.
- **① 상시 힌트**: 과하면 시각 잡음 → 미세하게, 한 번 사용 후 영구 숨김(localStorage).
- **③ AI 보라 치환**: 포커스 링(`globals.css:11` `outline:#2563eb`)·접근성 대비는 파랑
  기준이므로, 보라로 바꾼 요소의 색 대비(WCAG)가 유지되는지 확인.
