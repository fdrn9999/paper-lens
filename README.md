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
  <img src="https://img.shields.io/badge/Gemini_AI-Flash_3.0-4285F4?logo=google" alt="Gemini" />
  <img src="https://img.shields.io/badge/Upstash_Redis-KV-dc382d?logo=redis" alt="Upstash" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License" />
</p>

<p align="center">
  <a href="https://paperlens.site"><strong>paperlens.site 바로가기</strong></a>
</p>

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| **AI 논문 분석** | 원클릭 논문 요약 + 자유 질문 챗봇 (Gemini Flash, 프롬프트 인젝션 방어 내장) |
| **PDF 업로드** | 드래그 앤 드롭 또는 클릭으로 논문 업로드 (최대 10MB) |
| **다중 키워드 색상 검색** | 여러 검색어를 등록하여 각각 고유 색상으로 PDF 하이라이트 + 검색어별 통계 표시 |
| **키워드 자동 추출** | TF-IDF, TextRank, N-gram CNN 3가지 알고리즘으로 핵심 키워드 자동 추출 (100% 로컬 처리) |
| **드래그 번역** | 텍스트 선택 후 Gemini Flash로 즉시 한국어 번역 (한국어 텍스트 자동 감지 및 차단) |
| **키워드 하이라이트** | 추출된 키워드를 PDF에서 고유 색상으로 하이라이트 + 전체 토글 + 검색 연동 |
| **클립보드 복사** | 번역 결과, AI 채팅 응답을 원클릭 복사 |
| **키보드 단축키** | Ctrl+F 검색, Ctrl+1/2/3 탭 전환, Enter 검색어 추가, 방향키 페이지 이동 |
| **사용량 대시보드** | 헤더에 항상 표시되는 사용량 게이지 + 상세 팝업, 매일 자정(KST) 초기화 |
| **반응형 디자인** | 데스크톱 / 태블릿 / 모바일 완전 대응, 핀치 줌, 44px 터치 타겟 |
| **부드러운 UX** | 번역 패널 슬라이드 애니메이션, 고정 번역 버튼, 드래그 선택 보정 |

## AI 논문 분석

PaperLens의 AI 기능은 단순 검색을 넘어 **논문 전문 분석 챗봇**을 제공합니다:

- **원클릭 요약**: AI 탭에서 버튼 클릭으로 논문의 제목, 목적, 방법론, 결과, 결론을 구조화 요약
- **자유 질문**: "핵심 연구 방법은?", "한계점은?", "주요 결론은?" 등 논문에 대한 자유로운 질문
- **보안**: 프롬프트 인젝션 방어 내장 — 논문 외적인 질문이나 시스템 우회 시도를 자동 차단
- **사용량 관리**: 일일 사용량 제한으로 안정적인 서비스 운영

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS |
| 상태 관리 | Zustand |
| PDF 렌더링 | pdfjs-dist (CDN) |
| AI | Gemini 3.0 Flash (챗봇 + 번역) |
| Rate Limiting | Upstash Redis (KV) — IP별/글로벌 일일 쿼터, 분당 요청 제한 |
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
   ├── /api/translate   → 번역 처리
   └── /api/quota       → 사용량 조회
        |
[Upstash Redis (KV)]
   └── IP별/글로벌 일일 쿼터 + 분당 Rate Limit (KST 자정 초기화)
        |
[Google Gemini API]
   └── Gemini 3.0 Flash → 챗봇 + 번역
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
| `KV_REST_API_URL` | Upstash Redis REST URL | O |
| `KV_REST_API_TOKEN` | Upstash Redis REST 토큰 | O |
| `DAILY_TRANSLATE_CHAR_LIMIT` | 일일 번역 사용자별 한도 (기본 50K자) | |
| `DAILY_CHAT_CHAR_LIMIT` | 일일 AI 분석 사용자별 한도 (기본 100K자) | |
| `DAILY_GLOBAL_TRANSLATE_CHAR_LIMIT` | 일일 번역 글로벌 한도 (기본 500K자) | |
| `DAILY_GLOBAL_CHAT_CHAR_LIMIT` | 일일 AI 분석 글로벌 한도 (기본 1M자) | |

## 프로젝트 구조

```
src/
├── app/
│   ├── layout.tsx              # 루트 레이아웃
│   ├── page.tsx                # 메인 페이지
│   ├── globals.css             # 글로벌 스타일
│   └── api/
│       ├── chat/route.ts       # AI 챗봇 API (프롬프트 인젝션 방어)
│       ├── translate/route.ts  # Gemini 번역 API
│       └── quota/route.ts      # 사용량 조회 API
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
│   ├── UsageButton.tsx         # 사용량 상세 팝업
│   ├── QuotaIndicator.tsx     # 헤더 인라인 사용량 게이지
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

## UX/반응형 개선 사항

- **iOS 텍스트 선택 수정**: `body` 레벨 `user-select: none` 제거, UI 요소만 선택 차단
- **모바일 헤더 최적화**: 320px 뷰포트에서도 깨지지 않도록 사용량 게이지를 드롭다운으로 이동
- **사이드바 확대**: 모바일 90vw/320px로 검색 칩이 잘 표시됨
- **번역 패널 애니메이션**: 열기/닫기 시 부드러운 슬라이드 전환 (max-h transition)
- **번역 버튼 고정**: 스크롤 시 따라다니지 않는 fixed 포지셔닝
- **줌 리셋 개선**: 하드코딩 1.5x 대신 fit-to-width 스케일로 복원
- **터치 타겟 확대**: 채팅 복사 버튼, 키워드 검색 버튼, 페이지 배지 등 36px+ 확보
- **가이드 오버레이**: z-index 충돌 해결, 스포트라이트 뷰포트 오버플로 방지
- **드래그 선택 보정**: 스팬 간 갭 패딩, micro-drag 필터, 모바일 스크롤/선택 구분
- **시간대 일관성**: 모든 UI에서 "한국시간(KST)" 표기 통일

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
