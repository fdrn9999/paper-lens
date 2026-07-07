# PaperLens 개선 로드맵

> **작성일:** 2026-07-07
> **기준 커밋:** `8922fa7`
> **상태:** Living document (진행에 따라 갱신)

---

## 1. 개요

이 문서는 PaperLens의 **UI/UX · 버그/안정성 · 기능 · 편의성** 전반을 대폭 개선하기 위한 단계별 실행 로드맵이다. 코드베이스 전체 진단(아키텍처 / UI·UX / 버그·기술부채)을 근거로 작성되었으며, 각 항목은 실제 소스 위치(`file:line`)를 근거로 명시한다.

### 문서 목적
- 개선 항목을 **의존성과 우선순위**에 따라 단계(Phase)로 묶어 순차 실행 가능하게 한다.
- 각 항목에 **근거 · 난이도 · 리스크 · 완료 조건**을 붙여 "무엇을, 왜, 언제 끝난 것인지"를 검증 가능하게 만든다.

### 난이도 척도
| 척도 | 기준 |
|---|---|
| **S** | ≤ 2시간 (퀵윈) |
| **M** | ≤ 1일 |
| **L** | ≥ 2일 |

### 항목 ID 체계
`Q`=퀵윈 · `B`=버그/안정성 · `P`=검색 성능 · `D`=디자인 · `A`=접근성 · `U`=UX 편의성 · `F`=신규 기능

### 갱신 규칙
- 항목 착수 시 완료 조건 체크박스를 갱신한다.
- 새 항목은 해당 카테고리 접두어 + 다음 번호로 부여하고, 15장 색인에 추가한다.

---

## 2. 결정 사항 (Decision Log)

| # | 결정 | 근거/영향 |
|---|---|---|
| D1 | **다크 모드 포함** | 야간 논문 열람 사용성 큼. 단, Tailwind 토큰 체계가 없어 **디자인 토큰 정비(D-01/02)가 선행 조건** |
| D2 | **한국어 전용 UI 유지** | i18n 프레임워크 도입 제외. 번역 대상 언어도 한국어 고정 유지 |
| D3 | **"AI 의미 검색" 카피 수정** | about/guide가 홍보하는 semantic/embedding 검색은 **현재 코드에 없음**(실제는 로컬 다층 어휘 검색). 단기: 문구를 사실 기반으로 수정(Q-01). 구현: 장기 백로그 |
| D4 | **인쇄/주석 기능 보류** | 현재 범위 제외 후보. 사용자 수요 확인 후 재검토 |

---

## 3. 현황 진단 요약

### 3.1 잘 되어 있는 것 (유지 목록 — 회귀 금지)
- **접근성 기반:** skip-to-content 링크, `:focus-visible` 아웃라인, `role="search"`, 결과 리스트 `role="listbox"`/`option` + `aria-activedescendant`, GuideOverlay 포커스 트랩
- **성능:** ResultList 커스텀 가상화(윈도잉 + rAF 스크롤 스로틀), PDFViewer 스크롤 모드 가상화(±2 프리렌더, >4 페이지 티어다운), 필드 스코프 Zustand 셀렉터
- **모바일:** 커스텀 터치 텍스트 선택 엔진(탭=단어, 롱프레스+드래그=확장), 핀치 줌, 44px 최소 터치 타겟, safe-area 패딩
- **UX:** 500ms 디바운스 멀티텀 검색(텀별 색상/통계), 풍부한 단축키(Ctrl+F/1/2/3, 방향키 페이지 이동), `prefers-reduced-motion` 존중, 이벤트 기반 토스트 시스템
- **검색 엔진:** 계층형 매칭(exact → 악센트/대소문자 폴드 → 보수적 스테머 → 퍼지 Levenshtein) + CJK 처리, `searchEngine.test.ts` 회귀 테스트

### 3.2 문제점 요약

| 심각도 | 카테고리 | 항목 | 근거 |
|---|---|---|---|
| High | 안정성 | 서버→Gemini fetch 타임아웃/중단 없음 (서버리스 행 위험) | `api/chat/route.ts:243`, `api/translate/route.ts:98` |
| High | 안정성 | Zustand persist 버전/마이그레이션 부재 | `useStore.ts:794-802` |
| Medium | 성능 | 검색이 메인스레드 동기 실행(전 문서 × 텀) | `useStore.ts:342-373`, `searchEngine.ts:417-422` |
| Medium | 성능 | 추출 중 5페이지마다 새 배열 → 토큰화 메모 무효화 | `PDFViewer.tsx:341`, `searchEngine.ts:83-87` |
| Medium | 성능 | 추출 완료 시 이중 검색 트리거 | `useStore.ts:297,310` |
| Medium | 보안 | pdf.js CDN 로드에 SRI 해시 없음 | `pdfLoader.ts:56-57` |
| Medium | 안정성 | Gemini 호출 재시도/백오프·오프라인 감지 없음 | api 라우트 |
| UX | UI | 다크 모드 전무, Tailwind 토큰 미비 | `tailwind.config.ts`, `globals.css` |
| UX | 접근성 | PDF 텍스트/하이라이트 AT 미노출 | `PDFViewer.tsx` |
| UX | 접근성 | KeywordPanel button-in-button 중첩 | `KeywordPanel.tsx:90-138` |
| UX | 접근성 | 사이드바 탭이 실제 tablist 아님 | `page.tsx:343-382` |
| Low | 정확성 | `containsCJK`가 Hangul Jamo 범위 누락 | `searchEngine.ts:130` vs `useStore.ts:15` |
| Low | UX | 파괴적 액션(파일 닫기/검색어 삭제) undo 없음 | `useStore.ts`, `SearchBar.tsx:193` |
| Low | UX | 새로고침 시 PDF 세션 완전 소실 | `useStore.ts` (persist partialize) |
| Low | 안정성 | 클립보드 복사 폴백 없이 성공 토스트 발화 | `TranslationPanel.tsx:97` |

---

## 4. 로드맵 한눈에 보기

| Phase | 주제 | 예상 기간 | 선행 의존성 | 독립 배포 |
|---|---|---|---|---|
| 0 | 퀵윈 배치 | 반나절 | — | ✅ |
| 1 | 안정성·버그 | ~1주 | — | ✅ |
| 2 | 검색 성능 | ~1주 | — | ✅ |
| 3 | 토큰 → 다크 모드 → 접근성 | ~1.5–2주 | — (내부 순서 엄수) | ✅ |
| 4 | UX 편의성 | ~1.5주 | Phase 1(B-02), Phase 2 | ✅ |
| 5 | 신규 기능 | ~2주 | Phase 1 | ✅ (항목 병렬) |
| 백로그 | 장기 과제 | — | 각 항목별 착수 조건 | — |

### 의존성 다이어그램

```
Phase 0 (퀵윈) ─────────────────────────────────────┐
Phase 1 ─ B-02 persist 버전/마이그레이션 ──→ Phase 4 (U-02 세션복원, U-03 검색히스토리)
Phase 2 ─ P-02 워커 검색 파이프라인 ──→ Phase 4 (U-05 상위 N) ──→ 백로그 (시맨틱 서치)
Phase 3 ─ D-01/02 토큰 ──→ D-03 다크 모드 ──→ A-05 대비 검증
Phase 5 는 Phase 1 완료 후 임의 시점 병렬 가능
```

**순서 논리:** "기반이 흔들리는 상태에서 위에 쌓지 않는다."
- persist 스키마 마이그레이션 체계(B-02) 없이 영속화 계층(IndexedDB 세션 복원)을 확장하지 않는다.
- 워커 검색 파이프라인(P-02)은 시맨틱 서치가 그대로 재사용하므로 선행 필수.
- 토큰 정비(D-01/02) 없이 다크 모드를 칠하면 하드코딩 색이 다크에서만 깨진다.

---

## 5. Phase 0 — 퀵윈 배치

**목표:** 1~2시간권 저위험 항목을 한 PR로 일괄 처리해 즉시 체감 품질을 올린다.
**주의:** Q-01은 언커밋 WIP(about/guide)를 건드리므로 해당 작업자와 조율 후 진행.

| ID | 항목 | 근거 | 난이도 |
|---|---|---|---|
| Q-01 | about/guide "AI 의미 검색" 허위 카피 → "다층 지능형 텍스트 검색" 등 사실 기반 문구로 수정 | `src/app/about/`, `src/app/guide/` |  S |
| Q-02 | 클립보드 복사 폴백(`execCommand`/선택 안내) 추가 + 실패 시 성공 토스트 제거 | `TranslationPanel.tsx:97` | S |
| Q-03 | `api/translate/route.ts` 들여쓰기 정리 | 파일 전체 | S |
| Q-04 | 장식용 이모지(📄 ⚠️ 📋 등) `aria-hidden` 일괄 적용 | 여러 컴포넌트 | S |
| Q-05 | 햄버거 버튼 `aria-label` 교정 + `aria-expanded`/`aria-controls` 추가 | `page.tsx:226` | S |
| Q-06 | Gemini 모델 ID(`gemini-3-flash-preview`)를 env/상수(`GEMINI_MODEL`)로 단일화 | `chat/route.ts:244`, `translate/route.ts:99` | S |
| Q-07 | 하이라이트 색 `#FFD500` 상수/토큰 단일화(3곳 중복) | `globals.css`, `tailwind.config.ts`, `ResultList.tsx:77` | S |
| Q-08 | `containsCJK`에 Hangul Jamo 범위(`ᄀ-ᇿ`, `㄰-㆏`) 추가 | `searchEngine.ts:130`, `useStore.ts:15` | S |
| Q-09 | 클라이언트 사용량 표기 단위 정정(요청 수 vs 문자 수 불일치를 UI 문구로 해소) | `useStore.ts:526`, `QuotaIndicator.tsx` | S |
| Q-10 | 번역 버튼 위치 magic number(`innerWidth-120`) → 측정 기반 클램프 | `PDFViewer.tsx:784` | S |

#### 대표 완료 조건 예시 — Q-02
- [ ] `navigator.clipboard` 실패 시 `execCommand('copy')` 폴백 또는 "직접 복사하세요" 안내로 폴백된다
- [ ] 복사 성공 시에만 성공 토스트가 뜬다(실패 시 실패 토스트)
- [ ] 비보안 컨텍스트(http)에서 회귀 확인

**Phase 0 완료 정의:** Q-01~Q-10 전부 반영, 기존 테스트 통과, 시각 회귀 없음.

---

## 6. Phase 1 — 안정성·버그

**목표:** 데이터 유실·서버 행 등 이후 모든 작업의 전제가 되는 안정성 결함을 제거하고 회귀 안전망을 만든다.

| ID | 항목 | 근거 | 난이도 | 리스크 |
|---|---|---|---|---|
| B-01 | 서버→Gemini fetch에 `AbortController` 타임아웃(예: translate 30s / chat 60s) + 504 한국어 안내 | `chat/route.ts:243`, `translate/route.ts:98` | S | 낮음 |
| B-02 | Zustand `persist`에 `version` + `migrate` 도입, 스키마 변경 규약 문서화 | `useStore.ts:794-802` | M | **중간 — 기존 localStorage 파손 가능. migrate 단위 테스트 필수** |
| B-03 | localStorage 쓰기 전역 가드 유틸(try/catch + quota 초과 토스트) 추출 | `useStore.ts`, `PDFViewer.tsx:129-135` | S | 낮음 |
| B-04 | Gemini 호출 재시도/백오프(429·5xx) + `navigator.onLine` 오프라인 감지 | api 라우트 + ChatPanel/TranslationPanel | M | 중간 — quota 이중 차감 방지 검토 |
| B-05 | pdf.js CDN 스크립트에 SRI `integrity` 해시 + 버전 상수화 | `pdfLoader.ts:56-57` | S | 낮음 |
| B-06 | 추출 완료 시 이중 검색 트리거(500ms + 0ms 경합) 해소 | `useStore.ts:297,310` | S | 낮음 |
| B-07 | Redis `incr`/`decr` 롤백 경합 완화(Lua 스크립트 또는 허용 오차 정책 명시) | `rateLimit.ts:91-99` | M | 중간 — Upstash Lua 지원 확인 |
| B-08 | `getClientIp` `'unknown'` 공유 버킷 정책 정비 | `rateLimit.ts:172-179` | S | 낮음 |
| B-09 | 테스트 보강: API 라우트(프롬프트 인젝션 필터), rateLimit 쿼터 계산, store 핵심 액션 | `src/app/api/`, `rateLimit.ts`, `useStore.ts` | L | 낮음(작업량↑) |

#### 대표 완료 조건 예시 — B-02
- [ ] `persist`에 `version: 1`과 `migrate(persisted, version)`가 설정된다
- [ ] 구버전 스키마(예: 제거된 키) 입력 시 유효 상태로 마이그레이션되는 단위 테스트 존재
- [ ] 손상/파싱 불가 localStorage에서 앱이 크래시 없이 기본값으로 부팅된다

**Phase 1 완료 정의:** High 2건(B-01/B-02) 반영, B-09 테스트가 CI에서 통과, 신규 안전망 회귀 통과.

---

## 7. Phase 2 — 검색 성능

**목표:** 메인스레드 동기 검색을 워커/청킹 파이프라인으로 옮겨 대형 PDF에서도 UI 잼을 없애고, 시맨틱 서치가 얹힐 확장점을 만든다.

| ID | 항목 | 근거 | 난이도 | 리스크 |
|---|---|---|---|---|
| P-01 | 토큰화 재계산 방지: 5페이지마다 새 배열로 인한 `WeakMap` 메모 무효화 해소(페이지 단위 불변 참조 or 페이지별 메모 키) | `PDFViewer.tsx:341`, `searchEngine.ts:83-87` | M | 중간 — 메모 전략 변경이 검색 정확성에 무영향임을 기존 테스트로 검증 |
| P-02 | 검색을 Web Worker로 이전 + 페이지 청킹/취소 구조(순수 postMessage 또는 Comlink), 워커 실패 시 동기 폴백 유지 | `useStore.ts:342-373`, `searchEngine.ts:417-422` | L | **높음 — 아키텍처 변경. searchEngine의 DOM 비의존 확인 필수. "검색 전략 플러그인" 인터페이스로 설계** |
| P-03 | 검색 결과 증분 렌더(페이지 청크 완료마다 부분 결과 반영) | `ResultList.tsx` | M | 중간 — P-02 의존 |

#### 대표 완료 조건 예시 — P-02
- [ ] 300페이지 PDF에서 멀티텀 검색 중 메인스레드 블로킹 없음(입력 지연 100ms 이하)
- [ ] 검색 중 새 검색어 입력 시 진행 중 워커 작업이 취소된다
- [ ] 워커 미지원/실패 환경에서 기존 동기 경로로 폴백되어 결과가 동일하다

**Phase 2 완료 정의:** P-02 파이프라인이 기존 `searchEngine.test.ts`와 동일 결과를 내며, 대형 문서 프로파일에서 프레임 드랍 해소.

---

## 8. Phase 3 — 디자인 토큰 → 다크 모드 → 접근성

**목표:** 토큰 체계를 세운 뒤 다크 모드를 도입하고, 같은 흐름에서 색 대비/시맨틱을 재검증한다.
**내부 순서 엄수:** D-01 → D-02 → D-03 → A 그룹(A-05는 D-03 이후).

| ID | 항목 | 근거 | 난이도 | 리스크 |
|---|---|---|---|---|
| D-01 | 디자인 토큰 체계: semantic CSS 변수 + Tailwind config 매핑. 색 의미 규약(blue=검색 / purple=AI / emerald=키워드) 및 z-index 스케일을 주석→토큰으로 승격 | `globals.css`, `tailwind.config.ts` | M | 낮음 — 시각 등가 리팩터링(스크린샷 비교 검증) |
| D-02 | 전 컴포넌트(15개) 하드코딩 색상 → 토큰 치환 | `src/components/*` | L | 중간 — 누락 시 다크에서만 노출. grep 잔여 하드코딩 색 0건이 완료 조건 |
| D-03 | 다크 모드: `class` 전략 + 시스템 감지 + 수동 토글(persist). PDF 캔버스/하이라이트 색 별도 처리(반전 여부 결정) | 전역 | L | 중간 — 캔버스/하이라이트 가독성(#FFD500 계열 재검토) |
| A-01 | 사이드바 탭 → 실제 `tablist`/`tab`/`tabpanel` + 방향키 이동 | `page.tsx:343-382` | M | 낮음 |
| A-02 | KeywordPanel `button`-in-`button` 중첩 해소 | `KeywordPanel.tsx:90-138` | S | 낮음 |
| A-03 | Help/Usage 팝오버 포커스 트랩 + 포커스 반환(GuideOverlay 패턴 재사용) | `HelpButton.tsx`, `UsageButton.tsx` | M | 낮음 |
| A-04 | PDF 하이라이트/검색 상태 AT 노출 개선(결과 수·하이라이트 이동 `aria-live` 안내) | `PDFViewer.tsx`, `ResultList.tsx` | M | 중간 — pdf.js 텍스트 레이어 제약. "완전 노출"이 아닌 실용적 라이브 리전으로 범위 한정 |
| A-05 | 라이트/다크 양쪽 WCAG AA 대비 일괄 검증 | 전역 | M | D-03 의존 |

#### 대표 완료 조건 예시 — D-03
- [ ] 시스템 다크 설정을 자동 감지하고, 헤더 토글로 수동 오버라이드 후 새로고침에도 유지된다(persist)
- [ ] 검색/키워드/AI 하이라이트가 다크 배경에서 WCAG AA 대비를 만족한다
- [ ] PDF 캔버스가 다크에서도 논문 가독성을 유지한다(선택한 처리 방식대로)

**Phase 3 완료 정의:** 하드코딩 색 grep 0건, 다크 모드 전 화면 동작, 라이트/다크 AA 대비 통과.

---

## 9. Phase 4 — UX 편의성

**목표:** 실수 복구와 세션 연속성을 제공해 일상 사용 마찰을 줄인다. (B-02, Phase 2 선행)

| ID | 항목 | 근거 | 난이도 | 리스크 |
|---|---|---|---|---|
| U-01 | 파괴적 액션 undo 토스트 5초(파일 닫기 · 검색어 전체 삭제 · 채팅 삭제). 기존 3초 더블탭 확인 패턴 대체 | `Toast.tsx`, `useStore.ts`, `ChatPanel.tsx:201-227` | M | 낮음 |
| U-02 | 세션 복원: PDF 원본을 IndexedDB에 저장, 새로고침 시 "이전 세션 복원?" 프롬프트(검색어·채팅은 기존 persist 활용) | 신규 `lib/sessionStore.ts`, `useStore.ts`, `FileUploader.tsx` | L | **중간~높음 — 용량 상한(예: 50MB) 정책, 클라이언트 전용 원칙 유지 명시. B-02 의존** |
| U-03 | 검색 히스토리 / 저장된 검색어 세트 | `SearchBar.tsx`, `useStore.ts` | M | 낮음 — B-02 의존 |
| U-04 | Ctrl+F 하이재킹 완화(검색창 포커스 상태에서 재입력 시 브라우저 기본 찾기 허용 또는 설정 옵션) | `page.tsx:67-72` | S | 낮음 |
| U-05 | 검색 결과 상위 N + "더 보기"(P-03과 연동) | `ResultList.tsx` | M | 낮음 — P-02/03 의존 |
| U-06 | ResultList `STICKY_H=45` 하드코딩 → 실측 기반 스크롤 센터링(멀티텀 모드 오정렬 해소) | `ResultList.tsx:281` | S | 낮음 |

#### 대표 완료 조건 예시 — U-02
- [ ] 새로고침 후 직전 PDF가 있으면 "이전 세션 복원?" 프롬프트가 뜬다
- [ ] 복원 시 PDF·검색어·채팅이 함께 되살아난다
- [ ] 용량 상한 초과 PDF는 저장하지 않고 사용자에게 안내한다(원본은 여전히 클라이언트 밖으로 나가지 않음)

**Phase 4 완료 정의:** U-01·U-02 동작, 파괴적 액션이 모두 복구 가능, 세션 연속성 확보.

---

## 10. Phase 5 — 신규 기능

**목표:** 탐색 도구로서의 가치를 확장한다. 항목 간 독립성이 높아 병렬 진행 가능. (Phase 1 완료 후)

| ID | 항목 | 근거/비고 | 난이도 | 리스크 |
|---|---|---|---|---|
| F-01 | PDF 목차(outline) 내비게이션 패널 — pdf.js `getOutline()` 활용, outline 없는 PDF 빈 상태 UI | 신규 컴포넌트 | M | 낮음 |
| F-02 | 내보내기: 채팅 대화 / 번역 결과 → Markdown·텍스트 다운로드 | `ChatPanel.tsx`, `TranslationPanel.tsx` | M | 낮음 |
| F-03 | 최근 파일 목록(U-02 IndexedDB 인프라 재사용) | U-02 의존 | M | 낮음 |
| F-04 | 스니펫 수집 패널(선택 텍스트 → 노트 담기 + 페이지 링크 + 내보내기) | 사이드바 4번째 탭 | L | 중간 — 정보구조 재검토 필요 |

**Phase 5 완료 정의:** 착수 항목별 완료 조건 충족 및 빈 상태/에러 상태 처리 포함.

---

## 11. 백로그 (장기 과제)

| 항목 | 착수 조건 |
|---|---|
| **시맨틱 서치**(클라이언트 임베딩 또는 API) | Phase 2(P-02 워커 파이프라인) 완료 + 모델 용량/비용 조사 선행. D3 카피와 실제 기능 일치시킴 |
| **멀티 PDF 탭** | U-02 완료 + 스토어를 문서 단위로 분리하는 대규모 리팩터링 |
| **pdf.js 셀프호스팅 / v4·v5 업그레이드** | B-05로 단기 대응 후 별도 스파이크 |
| **인쇄 / 주석** | 사용자 수요 확인 후(현재 범위 제외 후보 — D4) |

---

## 12. 범위 제외 (Out of Scope)

- **i18n / 영어 UI** — 한국어 전용 유지(D2)
- **번역 대상 언어 선택** — 한국어 고정 유지(D2)
- **인쇄/주석** — 수요 확인 전 보류(D4, 백로그)

---

## 13. 테스트 전략

### 현재 커버리지
- ✅ `src/lib/searchEngine.test.ts` — 폴드/스템/Levenshtein/메모/tier 병합/E2E 검색 (충실)
- ✅ `src/lib/textSelection.test.ts` — 선택 확장
- ❌ 스토어(`useStore.ts`), API 라우트(프롬프트 인젝션 필터 포함), `rateLimit.ts`, `keywordExtractor.ts`, 전 React 컴포넌트 — **미커버**

### 단계별 보강 계획
| Phase | 추가 테스트 |
|---|---|
| 1 | B-09: API 라우트 인젝션 필터, rateLimit 쿼터 계산/롤백, store 검색·쿼터·abort 액션, B-02 migrate |
| 2 | P-02 워커 파이프라인이 기존 searchEngine 테스트와 동일 결과 산출(회귀 락) |
| 3 | 라이트/다크 대비 자동 검증(가능 시 스냅샷/토큰 lint) |
| 4 | U-01 undo, U-02 세션 복원 왕복(IndexedDB 모킹) |

---

## 14. 진행 중 작업과의 조율

현재 언커밋 WIP가 존재한다(SEO/콘텐츠 마케팅):
- **신규:** `src/app/about/`, `src/app/guide/` (AdSense `<Script>` 포함)
- **수정:** `layout.tsx`(전역 AdSense 제거), `page.tsx`/`privacy/page.tsx`(footer 링크), `sitemap.ts`(guide/about 추가)

**조율 노트:**
- **Q-01(시맨틱 검색 카피 수정)** 은 about/guide를 직접 건드리므로, 해당 WIP가 커밋되기 전/후 시점을 맞춰 재작업을 피한다.
- 이 로드맵의 나머지 항목은 WIP와 파일 충돌이 없다(주로 `src/components/`, `src/store/`, `src/lib/`, `src/app/api/`).

---

## 15. 부록: 항목 ID 색인

| ID | 항목 | Phase | 난이도 |
|---|---|---|---|
| Q-01 | 시맨틱 검색 허위 카피 수정 | 0 | S |
| Q-02 | 클립보드 복사 폴백 + 토스트 정정 | 0 | S |
| Q-03 | translate route 들여쓰기 정리 | 0 | S |
| Q-04 | 장식 이모지 aria-hidden | 0 | S |
| Q-05 | 햄버거 aria-label/expanded | 0 | S |
| Q-06 | Gemini 모델 ID 상수화 | 0 | S |
| Q-07 | 하이라이트 색 상수 단일화 | 0 | S |
| Q-08 | containsCJK Hangul Jamo 추가 | 0 | S |
| Q-09 | 클라이언트 사용량 단위 정정 | 0 | S |
| Q-10 | 번역 버튼 위치 클램프 | 0 | S |
| B-01 | Gemini fetch 타임아웃 | 1 | S |
| B-02 | persist version/migrate | 1 | M |
| B-03 | localStorage 쓰기 가드 | 1 | S |
| B-04 | Gemini 재시도/오프라인 감지 | 1 | M |
| B-05 | pdf.js SRI 해시 | 1 | S |
| B-06 | 이중 검색 트리거 해소 | 1 | S |
| B-07 | Redis 경합 완화 | 1 | M |
| B-08 | unknown IP 버킷 정책 | 1 | S |
| B-09 | 테스트 보강(API/rateLimit/store) | 1 | L |
| P-01 | 토큰화 메모 무효화 해소 | 2 | M |
| P-02 | 검색 Web Worker 이전 | 2 | L |
| P-03 | 검색 결과 증분 렌더 | 2 | M |
| D-01 | 디자인 토큰 체계 | 3 | M |
| D-02 | 하드코딩 색상 토큰 치환 | 3 | L |
| D-03 | 다크 모드 | 3 | L |
| A-01 | 사이드바 실제 tablist | 3 | M |
| A-02 | KeywordPanel 버튼 중첩 해소 | 3 | S |
| A-03 | 팝오버 포커스 트랩/반환 | 3 | M |
| A-04 | PDF 하이라이트 AT 노출 | 3 | M |
| A-05 | 라이트/다크 대비 검증 | 3 | M |
| U-01 | 파괴적 액션 undo 토스트 | 4 | M |
| U-02 | IndexedDB 세션 복원 | 4 | L |
| U-03 | 검색 히스토리 | 4 | M |
| U-04 | Ctrl+F 하이재킹 완화 | 4 | S |
| U-05 | 검색 결과 상위 N + 더 보기 | 4 | M |
| U-06 | ResultList 실측 센터링 | 4 | S |
| F-01 | PDF 목차 내비게이션 | 5 | M |
| F-02 | 채팅/번역 내보내기 | 5 | M |
| F-03 | 최근 파일 목록 | 5 | M |
| F-04 | 스니펫 수집 패널 | 5 | L |
