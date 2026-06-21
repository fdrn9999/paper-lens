# 검색 정확도 개선 (어휘 검색) — 설계

날짜: 2026-06-22
대상 모듈: `src/lib/searchEngine.ts` (+ 신규 `searchEngine.test.ts`)
범위: 어휘(lexical) 검색 정확도. **시맨틱/AI 검색(임베딩)은 보류** — 본 설계에 포함하지 않음.

## 1. 배경 / 문제

현재 문서 내 검색은 `exactSearch()` 단일 함수로, **정확 토큰 일치**만 수행한다 (`useStore.ts:345`에서 호출). 다음을 놓친다:

- **어형 변화**: "model" 검색 시 "models / modeling" 미매칭
- **악센트/분음부호**: "café" ↔ "cafe", "Schrödinger" ↔ "Schrodinger" 미매칭
- **오타**: 쿼리 오타 시 결과 0건
- **PDF 줄바꿈 하이픈**: "learn-\ning" 분리어 미매칭 (합자 ﬁ 등은 일부만 처리)
- **관련도**: 결과가 문서 순서로만 나열되고 매칭 품질 구분 없음

목표: 위 5가지를 보완하되, **정확 일치 결과가 항상 최상위에 오도록** 보장한다.

## 2. 핵심 결정 (확정)

- **티어드 랭킹**: 매칭은 항상 켜두되, 결과를 매칭 품질 티어로 정렬한다. 정확 일치가 항상 먼저, 넓힌 매칭(악센트/어간/오타)은 그 아래.
- **어간 처리는 보수적 규칙셋(옵션 A)**: 복수형·-ing·-ed 정도만. 완전 Porter 스테머(공격적 과매칭)는 채택하지 않음. 학술 논문은 정밀도 우선.
- **별도 검색 모드/토글 신설 없음**: 기존 UI 그대로. 정확/변형이 티어 순서로 자연 노출.

## 3. 아키텍처

`exactSearch`를 **정규화 → 다단계 매칭 → 티어 dedup·정렬** 파이프라인으로 재구성한다.

```
searchDocument(pageContents, keyword, caseSensitive)
  ├─ (load 시 1회) buildIndex: 문서 → vocab(고유 토큰) + 토큰→위치
  ├─ Tier 0: 정확 토큰/구 일치              (현재 exactSearch 로직)
  ├─ Tier 1: 대소문자·악센트 폴딩 일치        (foldText 적용)
  ├─ Tier 2: 어간 일치                       (보수적 stem)
  ├─ Tier 3: 오타 허용 (편집거리 fallback)    (vocab 대상 Levenshtein)
  └─ merge: 같은 위치는 최상위 티어만 유지, 티어순+문서순 정렬
```

각 `SearchResult`에 `matchTier: 0|1|2|3` 필드를 추가한다 (UI는 우선 무시 가능; 향후 배지 표시 여지).

### 3.1 정규화 레이어 (③④)

- `foldText(s): { folded, toOriginal }`
  - **NFKC** 정규화 (합자 ﬁ→fi, 전각→반각 등 자동)
  - **NFD → 결합 분음부호(U+0300–U+036F) 제거** (악센트 폴딩: é→e)
  - 소문자화 (caseSensitive=false일 때)
  - **원본 인덱스 매핑** 동반 — 기존 `buildStrippedMapping` 패턴 재사용, 하이라이트 위치는 항상 원본 기준
- **하이픈 줄바꿈 결합(④)**: `buildConcatText` 단계에서, 한 아이템이 `-`로 끝나고 다음 아이템이 소문자/문자로 시작하면 하이픈 제거 후 결합. 결합으로 인한 위치 시프트는 offset 매핑에 반영.

### 3.2 어간 처리 (① — 보수적 규칙셋)

`stem(token)` — 라틴 토큰에만 적용. 적용 순서(긴 접미사 우선):

- `-ies` → `-y` (studies→study), 단 어간 길이 ≥ 2
- `-es` → `` (boxes→box) / `-s` → `` (models→model), 단 `-ss`는 제외(class)
- `-ing` → `` (modeling→model), 어간 길이 ≥ 3
- `-ed` → `` (learned→learn), 어간 길이 ≥ 3

**이중자음 미복원(보수적)**: `-ing`/`-ed` 제거 시 이중자음을 단순화하지 않는다. 따라서 "modeling↔model"은 매칭되지만, **"running↔run"은 매칭되지 않는다**("running"→"runn" ≠ "run"). 이는 과매칭(예: "ledger"의 오축약)을 피하기 위한 의도된 한계로 수용한다.

쿼리 토큰과 문서 토큰을 각각 stem하여 stem이 같으면 매칭. 과매칭 위험 단어(2~3자)는 제외. CJK·숫자·특수문자 토큰은 stem 미적용.

### 3.3 오타 허용 (② — 편집거리)

- 라틴 쿼리 토큰, 길이 ≥ 4에만 적용
- 문서 **vocab(고유 토큰)** 대상으로 Levenshtein 거리 계산 (전체 위치가 아니라 어휘 집합 대상 → 비용 통제)
- 임계: 토큰 길이 ≤ 7 → 거리 1, > 7 → 거리 2
- 매칭된 vocab 토큰의 모든 위치를 Tier 3 결과로 산출
- CJK·특수문자·단위 토큰 제외

### 3.4 티어 병합·랭킹 (⑤)

- 결과를 (page, charStart) 키로 dedup, 충돌 시 **티어 번호가 낮은(=정확한) 쪽** 유지
- 정렬: `matchTier ASC → page ASC → charStart ASC`
- 멀티 검색어(searchTerms)는 기존처럼 각 term을 독립 검색 후 합침 (term별 색상 유지)

## 4. 성능

- `buildIndex`(vocab + 토큰→위치)를 **문서 로드 시 1회** 구축하고 메모이즈. 검색 디바운스(500ms)마다 재구축하지 않음.
- 인덱스는 `pageTextContents` 신원(아이덴티티) 기준 캐시. 문서가 바뀌면 재구축.
- 퍼지 매칭은 vocab(보통 수천 토큰)에만 편집거리 → O(|vocab| × |query| × maxlen), 디바운스 하에서 허용 범위.

## 5. 스코프 / 비범위

- **한국어/CJK**: 기존 `cjkSearch`(substring) 유지. "모델→모델은"은 이미 부분 커버. 어간·악센트 폴딩은 라틴 전용. Tier 0만 사용.
- **특수문자 쿼리**(C++, O(N)): 기존 `specialCharSearch` 유지, Tier 0.
- **비범위**: 시맨틱/임베딩 검색, 동의어 사전, 섹션(제목/초록) 가중 랭킹, 검색 UI 변경.

## 6. 테스트 (TDD)

`searchEngine.ts`는 현재 테스트 없음. 신규 `src/lib/searchEngine.test.ts`(`node --test`)로 구현 전 작성:

- 정규화: 악센트 폴딩(café=cafe), 합자(ﬁ), 대소문자
- 하이픈 결합: "learn-\ning" → "learning" 매칭, 하이라이트 위치 정확
- 어간: model/models/modeling 동일 매칭, class/-ss 미축약, university↔universal **미매칭**(과매칭 방지)
- 오타: "lerning"→"learning"(거리1), 3자 이하 미적용
- 티어/랭킹: 정확 일치가 변형보다 먼저, 같은 위치 dedup 시 정확 티어 유지
- 회귀: 기존 exactSearch 동작(단일/멀티 토큰, CJK, 특수문자, 커닝 fallback) 보존

## 7. 변경 파일

- `src/lib/searchEngine.ts` — 파이프라인 재구성, `foldText`/`stem`/`levenshtein`/`buildIndex` 추가, `matchTier` 부여
- `src/lib/searchEngine.test.ts` — 신규
- `src/lib/types.ts` — `SearchResult`에 `matchTier` 추가
- `package.json` — test 스크립트에 searchEngine.test.ts 포함
- (호출부 `useStore.ts`는 시그니처 호환 유지 시 변경 최소)
