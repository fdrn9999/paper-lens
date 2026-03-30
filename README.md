<p align="center">
  <img src="public/favicon.svg" alt="PaperLens Logo" width="120" />
</p>

<h1 align="center">PaperLens</h1>

<p align="center">
  <strong>논문을 '읽는' 것이 아니라 '탐색'하게 만든다</strong>
</p>

<p align="center">
  AI 기반 PDF 논문 탐색 도구 &mdash; 다중 키워드 색상 검색, 키워드 자동 추출, 의미 기반 AI 검색, 드래그 번역까지 한 곳에서
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?logo=nextdotjs" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-38bdf8?logo=tailwindcss" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Gemini_AI-Flash_3.0-4285F4?logo=google" alt="Gemini" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License" />
</p>

<p align="center">
  <a href="https://paperlens.site"><strong>paperlens.site 바로가기</strong></a>
</p>

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| **PDF 업로드** | 드래그 앤 드롭 또는 클릭으로 논문 업로드 (최대 10MB) |
| **다중 키워드 색상 검색** | 여러 검색어를 등록하여 각각 고유 색상으로 PDF 하이라이트 — 최대 10색 동시 표시 |
| **키워드 자동 추출** | TF-IDF, TextRank, N-gram 3가지 알고리즘으로 핵심 키워드 자동 추출 (100% 로컬 처리) |
| **Exact 검색** | 토큰 기반 정확한 단어 매칭 — 한글/영문 지원, 부분 문자열 제거 |
| **AI 시맨틱 검색** | Gemini Embedding으로 의미 기반 하이브리드 검색 (exact + semantic RRF 병합, MMR 중복 제거) |
| **드래그 번역** | 텍스트 선택 후 Gemini Flash로 즉시 한국어 번역 (한국어 텍스트 자동 감지 및 차단) |
| **키워드 하이라이트** | 추출된 키워드를 PDF에서 고유 색상으로 하이라이트 (여러 키워드 동시 표시) |
| **사용자 키워드** | 수동으로 키워드를 추가하여 출현 통계 + PDF 하이라이트 확인 |
| **사용량 대시보드** | 헤더에서 AI 검색/번역 사용량을 실시간 퍼센트로 확인 |
| **반응형 디자인** | 데스크톱 / 모바일 대응, 핀치 줌 지원 |

## 검색이 다릅니다

기존 PDF 뷰어의 `Ctrl+F`는 단순 문자열 매칭이라 "ai"를 검색하면 cl**ai**m, s**ai**d 같은 불필요한 결과가 포함됩니다.

PaperLens는 **세 가지 검색 레벨**로 이 문제를 해결합니다:

- **Level 1 — Exact Match**: 단어 경계를 인식하는 토큰 기반 검색으로 정확한 단어만 매칭
- **Level 2 — Multi-Term Color Search**: 여러 검색어를 동시에 등록하고, 각 검색어를 고유 색상으로 PDF에 하이라이트하여 한눈에 비교
- **Level 3 — AI Semantic Search**: 문장 단위 임베딩을 비교하여 동의어/유사 표현까지 탐색

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS |
| 상태 관리 | Zustand |
| PDF 렌더링 | pdfjs-dist (CDN) |
| AI | Gemini 3.0 Flash (번역), Gemini text-embedding-004 (시맨틱 검색) |
| 키워드 추출 | TF-IDF, TextRank, N-gram CNN (브라우저 로컬 처리) |
| 배포 | Vercel Serverless Functions |

## 시스템 아키텍처

```
[Client — Next.js App Router]
   ├── PDF 렌더링 (pdfjs-dist CDN)
   ├── 텍스트 추출 (로컬)
   ├── 키워드 추출 (로컬, 3가지 알고리즘)
   ├── Exact 검색 (로컬)
   └── 다중 검색어 색상 관리
        |
[Vercel Serverless Functions]
   ├── /api/embed      → 문장 임베딩 생성
   ├── /api/translate   → 번역 처리
        |
[Google Gemini API]
   ├── Gemini 3.0 Flash       → 번역
   └── text-embedding-004     → 임베딩
```

## 시작하기

### 사전 요구사항

- Node.js 18+
- [Google Gemini API 키](https://aistudio.google.com/apikey) (무료 발급)

### 설치 및 실행

```bash
# 클론
git clone https://github.com/fdrn9999/paperlens.git
cd paperlens

# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일에 GEMINI_API_KEY 입력

# 개발 서버
npm run dev
```

http://localhost:3000 에서 확인할 수 있습니다.

### 환경 변수

| 변수 | 설명 | 필수 |
|------|------|:----:|
| `GEMINI_API_KEY` | Google Gemini API 키 | O |
| `DAILY_GLOBAL_TRANSLATE_LIMIT` | 일일 번역 요청 한도 (기본 500) | |
| `DAILY_GLOBAL_EMBED_LIMIT` | 일일 임베딩 요청 한도 (기본 200) | |

## 프로젝트 구조

```
src/
├── app/
│   ├── layout.tsx              # 루트 레이아웃
│   ├── page.tsx                # 메인 페이지
│   ├── globals.css             # 글로벌 스타일
│   └── api/
│       ├── translate/route.ts  # Gemini 번역 API
│       └── embed/route.ts      # Gemini 임베딩 API
├── components/
│   ├── FileUploader.tsx        # PDF 업로드 (클릭 + 드래그 앤 드롭)
│   ├── PDFViewer.tsx           # PDF 렌더링 + 색상별 하이라이트
│   ├── SearchBar.tsx           # 다중 검색어 칩 입력 + 모드 토글
│   ├── ResultList.tsx          # 검색 결과 리스트 + 검색어 색상 배지
│   ├── KeywordPanel.tsx        # 키워드 추출 결과 패널
│   ├── PageNavigator.tsx       # 페이지 탐색 + 줌
│   ├── TranslationPanel.tsx    # 번역 결과 패널
│   ├── GuideOverlay.tsx        # 온보딩 가이드
│   ├── HelpButton.tsx          # 도움말 버튼
│   ├── UsageButton.tsx         # 사용량 표시 버튼
│   ├── ErrorBoundary.tsx       # 에러 바운더리
│   └── Toast.tsx               # 토스트 알림
├── store/
│   └── useStore.ts             # Zustand 글로벌 상태
└── lib/
    ├── types.ts                # TypeScript 타입 정의
    ├── searchEngine.ts         # 검색 엔진 (Exact + CJK)
    ├── keywordExtractor.ts     # 키워드 추출 (TF-IDF, TextRank, N-gram)
    ├── pdfLoader.ts            # PDF.js CDN 로더
    ├── env.ts                  # 환경 변수 유틸
    ├── rateLimit.ts            # API Rate Limiting
    └── messages.ts             # 메시지 상수
```

## 배포 (Vercel)

```bash
# Vercel CLI
npm i -g vercel
vercel

# Vercel 대시보드에서 환경 변수 설정
# GEMINI_API_KEY = your_api_key
```

> **참고**: Vercel Serverless 요청 body 제한(4.5MB)으로 인해, 대용량 PDF는 클라이언트에서 텍스트를 추출한 후 텍스트만 서버로 전송합니다.

## 라이선스

MIT
