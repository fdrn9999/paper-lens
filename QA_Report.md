# PaperLens QA Report (로직 / UI / UX)

PaperLens 프로젝트 코드와 기획서를 바탕으로 소스코드를 수정하지 않고 상태 관리, 핵심 알고리즘, 컴포넌트 렌더링, UX 흐름에 대한 전반적인 QA를 진행한 결과입니다. 

---

## 1. 🧠 핵심 로직 및 상태 관리 (Logic QA)

### 🔴 [Critical] 시맨틱 검색 하이라이트 누락 (`useStore.ts`)
- **이슈 구문:** `search` 함수에서 의미 기반 검색(Semantic Search) 완료 후, 검색 결과(`SearchResult`) 매핑 시 `charStart`, `charEnd`, `itemIndex` 설정
- **문제점:** 문장 단위(Chunk)로 임베딩을 비교하여 일치하는 문장을 찾아냈음에도 불구하고, 결과 객체 생성 시 문장 전체의 Span이 아닌 **Chunk의 `primaryItem` (문장의 제일 첫 번째 텍스트 조각) 하나만 반환**하고 있습니다.
- **영향 (UX):** 사용자는 특정 문장(예: 10개의 텍스트 아이템으로 구성된 문장)이 의미적으로 매치되었다고 하더라도, 화면의 하이라이트는 **해당 문장의 첫 단어/어절 위치에만 작게 칠해지는 결과**를 보게 됩니다. 시맨틱 검색의 이점이 크게 반감됩니다.

### 🟡 [Major] 강제 공백 추가로 인한 Exact Match 실패 (`searchEngine.ts`)
- **이슈 구문:** `exactSearch` 로직 내 라틴어 문자열 추출 시 `buildConcatText(page.items, ' ')` 사용
- **문제점:** PDF.js는 종종 자간(kerning) 등의 포매팅 이유로 하나의 단어를 여러 개의 `ExtractedTextItem`으로 분할합니다 (예: "Artificial" -> "Arti", "ficial"). 검색 엔진은 Latin 계열의 검색 시 `ExtractedTextItem`들을 무조건 띄어쓰기(`' '`)를 넣어 합치기 때문에, "Arti ficial" 형태가 되어 버려 정작 "Artificial" 이라는 키워드로 Exact Match를 시도하면 **해당 단어를 찾을 수 없게 됩니다.**
- **영향:** 영문 논문 등에서 단일 단어 검색 시 띄어쓰기로 오분류된 단어들이 검색 결과에서 누락되는 이슈가 발생합니다.

### 🟡 [Minor] 불필요한 상태 캐시 무효화 통신 (`useStore.ts`)
- **이슈 구문:** `setPageTextContents` 로직 내 `isExtracting`이 true 일 때 `sentenceChunks: null` 처리
- **문제점:** Progressive Loading(5페이지 단위 배치)으로 텍스트 추출이 진행되는 동안, 매 배치마다 `sentenceChunks`를 통째로 날려버립니다. 만약 추출 도중 Semantic 모드로 전환하려 하면, 캐시 된 문장 청크가 날아가 계속 청크를 다시 계산해야 하는 비효율이 존재합니다 (현재는 추출 완료 시점까지 Semantic Search 자체가 Block 되어 있어 크리티컬한 버그로 발현되진 않고 있습니다).

---

## 2. 🎨 UI 및 렌더링 (UI QA)

### 🔴 [Critical] 가이드 튜토리얼 스포트라이트 더블 렌더링 버그 (`GuideOverlay.tsx`)
- **이슈 구문:** `GuideOverlay` 컴포넌트 내 딤(Dim) 처리 DOM 구조
- **문제점:** 스포트라이트 처리를 위해 `boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)'` 가 적용된 엘리먼트를 그리고 있는데, 이와 동시에 바닥에 `bg-black/60` 클래스를 가진 모달 Backdrop을 렌더링하고 있습니다.
- **영향:** 스포트라이트로 구멍이 뚫려 밝게 보여야 할 엘리먼트 영역은 **배경의 0.6투명도 Dim** 때문에 여전히 어둡게 보이며, 화면 외곽 전체 영역은 **Backdrop(0.6) + BoxShadow(0.6)** 이 이중으로 중첩되어 거의 보이지 않게 까맣게(Opacity 약 0.84) 변하는 UI 버그가 발생합니다.

### 🟡 [Minor] PDFViewer의 텍스트 레이아웃 하이라이트 DOM 예외 발생 가능성 방어 (`PDFViewer.tsx`)
- **이슈 구문:** `hlSpan.charEnd` 및 `Range API(createRange)` 기반 하이라이트 오프셋 계산 부문
- **평가:** 텍스트 아이템의 길이를 초과하는 `Range API` 호출은 `DOMException: IndexSizeError`를 발생시키지만, 하부 모듈(`searchEngine.ts`)에서 오프셋 범위를 `Math.min(item.text.length, matchEnd - offset)`로 훌륭하게 안전 처리 해두었습니다. 안정성이 확보된 긍정적인 UI 설계입니다.

---

## 3. 🖱️ 사용자 경험 (UX QA)

### 🟢 [Good] 모바일 최적화 및 플로팅 액션
- 하이라이트된 검색 결과 클릭 시 사이드바가 모바일 뷰어에서 자동으로 `setIsSidebarOpen(false)` 로 닫히도록 설계되어, 결과를 즉시 화면 가득 볼 수 있어 훌륭한 UX를 제공합니다.
- 모바일에서 텍스트 선택 시, 화면 스크롤 시 버튼의 좌표가 빗나가는 것을 방지하기 위해 컨테이너의 절대좌표(Absolute)에 마운트하여 네이티브 스크롤과 동기화한 UX는 매우 우수합니다.

### 🟡 [Minor] Exact Match 텍스트 입력의 피드백 지연 가능성 (`useStore.ts`)
- **문제점:** 상태 관리 내 `progressiveSearchTimer`가 타이핑할 때마다 디바운스(500ms) 처리를 하여 검색 성능 저하를 방지하는 것은 좋습니다. 그러나, 사용자가 검색어를 입력 후 500ms(디바운스) + 동기적 검색 연산 시간 동안 화면에 "검색 중..." 등 시각적 인디케이터(`isSearching` 상태 사용 안 됨)가 노출되지 않아, 매우 큰 논문을 검색할 경우 잠시 화면이 멈추거나 응답하지 않는 것처럼 느껴질 수 있습니다.

### 🟡 [Minor] Semantic 매칭 Threshold 하드코딩 (`useStore.ts`)
- **문제점:** `cosineSimilarity`의 검색 기준 임계값(Threshold)이 0.65로 하드코딩 되어있습니다. Gemini Embedding 결과값들은 텍스트 특성에 따라 점수 편차가 매우 좁은 경향이 있습니다. 아주 유사한 문장인데도 0.65 미만으로 제외되거나 일부만 Fallback 처리로 남는 현상이 있을 수 있습니다. UX 향상을 위해 Threshold를 조절하거나 동적으로 튜닝하는 설정이 있으면 좋습니다.

---

## 📈 총평

현재 PaperLens의 전반적 아키텍처와 성능 최적화 모델(비동기 청크 추출, 레이트 리미트 방어 등)은 훌륭히 설계되어 있습니다. 다만 **(1) "시맨틱 결과 하이라이트 문장 축소 문제"** 와 **(2) "가이드라인 딤 처리(UI 더블 박스섀도우 중첩)"** 부분은 제품의 핵심 기능 퀄리티와 첫 인상을 해치는 요인이므로 가장 먼저 코드로 수정되어야 할 주요 QA 포인트입니다.
