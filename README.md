<p align="center">
  <img src="public/favicon.svg" alt="PaperLens Logo" width="120" />
</p>

<h1 align="center">PaperLens</h1>

<p align="center">
  <strong>논문을 '읽는' 것이 아니라 '탐색'하게 만든다</strong>
</p>

<p align="center">
  AI 기반 PDF 논문 탐색 도구 &mdash; AI 논문 분석 챗봇, 다중 키워드 색상 검색, 키워드 자동 추출, 드래그 번역까지 한 곳에서
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?logo=nextdotjs" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-38bdf8?logo=tailwindcss" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Gemini_AI-Flash_2.0-4285F4?logo=google" alt="Gemini" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License" />
</p>

<p align="center">
  <a href="https://paperlens.site"><strong>paperlens.site 바로가기</strong></a>
</p>

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| **AI 논문 분석** | 논문 업로드 시 자동 요약 + 자유 질문 챗봇 (Gemini Flash 2.0, 프롬프트 인젝션 방어 내장) |
| **PDF 업로드** | 드래그 앤 드롭 또는 클릭으로 논문 업로드 (최대 10MB) |
| **다중 키워드 색상 검색** | 여러 검색어를 등록하여 각각 고유 색상으로 PDF 하이라이트 + 검색어별 통계 표시 |
| **키워드 자동 추출** | TF-IDF, TextRank, N-gram CNN 3가지 알고리즘으로 핵심 키워드 자동 추출 (100% 로컬 처리) |
| **드래그 번역** | 텍스트 선택 후 Gemini Flash로 즉시 한국어 번역 (한국어 텍스트 자동 감지 및 차단) |
| **키워드 하이라이트** | 추출된 키워드를 PDF에서 고유 색상으로 하이라이트 (여러 키워드 동시 표시) |
| **사용량 대시보드** | 헤더에서 AI 분석/번역 사용량을 실시간 퍼센트로 확인 |
| **반응형 디자인** | 데스크톱 / 태블릿 / 모바일 완전 대응, 핀치 줌 지원 |

## AI 논문 분석

PaperLens의 AI 기능은 단순 검색을 넘어 **논문 전문 분석 챗봇**을 제공합니다:

- **자동 요약**: 논문 업로드 시 제목, 목적, 방법론, 결과, 결론을 구조화하여 자동 요약
- **자유 질문**: "핵심 연구 방법은?", "한계점은?", "주요 결론은?" 등 논문에 대한 자유로운 질문
- **보안**: 프롬프트 인젝션 방어 내장 — 논문 외적인 질문이나 시스템 우회 시도를 자동 차단
- **사용량 관리**: 일일 사용량 제한으로 안정적인 서비스 운영

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS |
| 상태 관리 | Zustand |
| PDF 렌더링 | pdfjs-dist (CDN) |
| AI | Gemini 2.0 Flash (챗봇 + 번역) |
| 키워드 추출 | TF-IDF, TextRank, N-gram CNN (브라우저 로컬 처리) |
| 배포 | Vercel Serverless Functions |

## 시스템 아키텍처

```
[Client — Next.js App Router]
   ├── PDF 렌더링 (pdfjs-dist CDN)
   ├── 텍스트 추출 (로컬)
   ├── 키워드 추출 (로컬, 3가지 알고리즘)
   ├── 다중 검색어 색상 관리 (로컬)
   └── AI 챗 UI (사이드바 탭)
        |
[Vercel Serverless Functions]
   ├── /api/chat       → AI 논문 분석 + Q&A (프롬프트 인젝션 방어)
   └── /api/translate   → 번역 처리
        |
[Google Gemini API]
   └── Gemini 2.0 Flash → 챗봇 + 번역
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
| `DAILY_GLOBAL_TRANSLATE_LIMIT` | 일일 번역 글로벌 한도 (기본 500K자) | |
| `DAILY_GLOBAL_CHAT_CHAR_LIMIT` | 일일 AI 분석 글로벌 한도 (기본 1M자) | |
| `DAILY_CHAT_CHAR_LIMIT` | 일일 AI 분석 사용자별 한도 (기본 100K자) | |

## 프로젝트 구조

```
src/
├── app/
│   ├── layout.tsx              # 루트 레이아웃
│   ├── page.tsx                # 메인 페이지
│   ├── globals.css             # 글로벌 스타일
│   └── api/
│       ├── chat/route.ts       # AI 챗봇 API (프롬프트 인젝션 방어)
│       └── translate/route.ts  # Gemini 번역 API
├── components/
│   ├── FileUploader.tsx        # PDF 업로드 (클릭 + 드래그 앤 드롭)
│   ├── PDFViewer.tsx           # PDF 렌더링 + 색상별 하이라이트
│   ├── SearchBar.tsx           # 다중 검색어 칩 입력
│   ├── ResultList.tsx          # 검색 결과 리스트 + 검색어 색상 배지
│   ├── ChatPanel.tsx           # AI 논문 분석 챗봇 패널
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
    ├── keywordExtractor.ts     # 키워드 추출 (TF-IDF, TextRank, N-gram CNN)
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

## 라이선스

MIT
