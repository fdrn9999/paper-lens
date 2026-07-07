import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';

export const metadata: Metadata = {
  title: '소개 - PaperLens',
  description: 'PaperLens는 논문을 "읽는" 것이 아니라 "탐색"하게 만들기 위한 AI 기반 PDF 도구입니다. 만든 배경, 철학, 기술 스택과 프라이버시 정책을 소개합니다.',
  openGraph: {
    title: '소개 - PaperLens',
    description: '논문을 "읽는" 것이 아니라 "탐색"하게 만드는 AI 기반 PDF 도구',
    type: 'article',
  },
};

export default function AboutPage() {
  return (
    <div className="min-h-[100dvh] bg-white max-w-[100vw] overflow-x-hidden">
      <Script
        id="adsbygoogle-init"
        async
        strategy="afterInteractive"
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7165994147929640"
        crossOrigin="anonymous"
      />

      <a href="#about-content" className="skip-to-content">본문으로 건너뛰기</a>
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b bg-white">
        <Link href="/" className="flex items-center gap-2 hover:opacity-70 transition-opacity">
          <img src="/favicon.svg" alt="PaperLens 로고" className="w-7 h-7" />
          <h1 className="text-xl font-bold text-gray-800">PaperLens</h1>
        </Link>
        <p className="text-sm text-gray-500 hidden sm:block">AI 기반 논문 탐색 도구</p>
        <Link href="/" className="text-sm text-blue-600 hover:text-blue-700 transition-colors sm:hidden">홈으로</Link>
      </header>

      <main id="about-content" className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">PaperLens 소개</h1>
        <p className="text-sm text-gray-400 mb-8">논문을 &quot;읽는&quot; 것이 아니라 &quot;탐색&quot;하게 만든다</p>

        <div className="prose prose-gray prose-sm max-w-none space-y-10 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">PaperLens란?</h2>
            <p>
              PaperLens는 PDF 논문을 브라우저에 업로드하면, 지능형 키워드 검색·드래그 번역·AI 논문 분석을 한 화면에서
              사용할 수 있게 해주는 웹 애플리케이션입니다. 별도의 설치나 회원가입 없이, 파일 한 개를 올리는 순간 바로 사용할 수 있습니다.
            </p>
            <p className="mt-3">
              기존의 PDF 뷰어가 &quot;단순 문자열 일치&quot;에 머물러 있었다면, PaperLens는 단어 경계를 이해하는 다층 검색으로
              대소문자·활용형·오타·악센트 차이를 넘어 원하는 표현을 찾아냅니다. 찾은 문장에서 바로 번역하고,
              나아가 AI에게 &quot;이 부분이 무슨 뜻이냐&quot;고 물어볼 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">왜 만들었나</h2>
            <p>
              논문을 읽다 보면 PDF 뷰어의 Ctrl+F가 생각보다 자주 아쉽습니다. <code>ai</code>를 검색하면 <code>claim</code>,
              <code>said</code>, <code>maintain</code>처럼 글자만 일치하는 단어가 한가득 잡히고, 약어(LLM)와 풀네임(large language model)은
              서로를 찾지 못합니다. 저자가 쓰는 용어를 정확히 알지 못하면 검색 자체가 실패하기도 합니다.
            </p>
            <p className="mt-3">
              PaperLens는 이런 불편을 &quot;한 화면 안에서&quot; 해결하려는 시도입니다. 정확한 표기는 빠른 토큰 검색으로,
              활용형·오타·대소문자 차이는 자동 보정으로, 이해가 안 되는 구절은 드래그 번역과 AI 분석으로 — 탭을 바꾸거나 외부 도구를 열 필요가 없습니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">어떤 사람을 위한 도구인가</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>영어 논문을 자주 읽어야 하는 대학생·대학원생</li>
              <li>새로운 분야의 논문을 빠르게 훑어야 하는 연구자·개발자</li>
              <li>기술 문서·백서·리포트에서 특정 개념을 추적해야 하는 실무자</li>
              <li>Ctrl+F의 한계에 답답함을 느껴본 적 있는 모든 독자</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">동작 방식과 프라이버시 철학</h2>
            <p>
              PaperLens는 &quot;가능한 한 사용자의 기기에서 처리한다&quot;는 원칙을 지킵니다. PDF 파싱·텍스트 추출·검색 인덱싱은
              모두 브라우저에서 이루어지며, 원본 PDF 파일은 어떤 서버로도 전송되지 않습니다.
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-3">
              <li><strong>업로드된 PDF:</strong> 서버로 전송되지 않고, 브라우저를 닫으면 사라집니다.</li>
              <li><strong>검색:</strong> 텍스트 추출·인덱싱·매칭이 모두 브라우저에서 처리되며, 검색어는 외부로 전송되지 않습니다.</li>
              <li><strong>번역·AI 분석:</strong> 요청 시점에 필요한 텍스트만 Gemini API로 전송되며, 처리 후 서버에 남지 않습니다.</li>
              <li><strong>사용량 관리:</strong> API 남용을 막기 위해 IP 기반으로 일일 호출 횟수를 집계하며, 매일 자정에 초기화됩니다.</li>
            </ul>
            <p className="mt-3">
              데이터 흐름과 외부 서비스 연동에 대한 상세 내용은 <Link href="/privacy" className="text-blue-600 hover:underline">개인정보처리방침</Link>에서 확인할 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">핵심 기능 한눈에 보기</h2>
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              <table className="w-full mt-3 text-sm border-collapse min-w-0">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-2 px-3 font-medium text-gray-700">기능</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-700">설명</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 px-3 align-top">정확 매칭 검색</td>
                    <td className="py-2 px-3 align-top">단어 경계를 이해하는 빠른 토큰 기반 키워드 검색</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-3 align-top">스마트 매칭</td>
                    <td className="py-2 px-3 align-top">대소문자·악센트·영어 활용형·오타를 자동 보정하는 다층 검색</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-3 align-top">키워드 패널</td>
                    <td className="py-2 px-3 align-top">논문의 핵심 키워드를 자동으로 추출해 보여줌</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-3 align-top">AI 논문 분석</td>
                    <td className="py-2 px-3 align-top">논문 본문을 컨텍스트로 삼는 질문-응답</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-3 align-top">드래그 번역</td>
                    <td className="py-2 px-3 align-top">선택한 문장·문단을 한국어로 번역</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-3 align-top">두 가지 뷰어 모드</td>
                    <td className="py-2 px-3 align-top">스크롤·페이지 모드 전환과 풍부한 단축키</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3">
              각 기능의 사용법은 <Link href="/guide" className="text-blue-600 hover:underline">사용 가이드</Link>에서 단계별로 확인할 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">기술 스택</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Frontend:</strong> Next.js (App Router), TypeScript, Tailwind CSS, Zustand</li>
              <li><strong>PDF 처리:</strong> pdfjs-dist — 브라우저에서 텍스트 레이어 추출과 렌더링</li>
              <li><strong>검색:</strong> 토큰 기반 다층 검색 엔진 (정확 매칭 · 대소문자/악센트 정규화 · 영어 어간 · 오타 교정 · 한국어 검색)</li>
              <li><strong>AI 모델:</strong> Gemini (번역·논문 분석)</li>
              <li><strong>인프라:</strong> Vercel — 서버리스 함수와 정적 호스팅</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">로드맵</h2>
            <p>다음 기능들을 검토·실험 중입니다.</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>의미 기반 검색(임베딩) — 표현이 달라도 개념으로 찾기</li>
              <li>논문 요약과 섹션별 자동 하이라이트</li>
              <li>키워드 자동 추천과 관련어 확장</li>
              <li>여러 논문 동시 비교</li>
              <li>인용 자동 추출과 참고문헌 네비게이션</li>
              <li>사용자 메모·북마크 기능</li>
            </ul>
            <p className="mt-3">
              특정 기능이 필요하거나 버그를 발견하면 언제든 제보해 주세요. 피드백은 다음 기능 우선순위에 바로 반영됩니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">연락처</h2>
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              <table className="w-full mt-3 text-sm border-collapse">
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 px-3 font-medium text-gray-700 bg-gray-50 w-32">제작</td>
                    <td className="py-2 px-3">정진호</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-3 font-medium text-gray-700 bg-gray-50">이메일</td>
                    <td className="py-2 px-3">
                      <a href="mailto:ckato9173@gmail.com" className="text-blue-600 hover:underline">ckato9173@gmail.com</a>
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-3 font-medium text-gray-700 bg-gray-50">GitHub</td>
                    <td className="py-2 px-3">
                      <a href="https://github.com/fdrn9999" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">github.com/fdrn9999</a>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">지금 바로 사용해 보기</h2>
            <p>
              회원가입이나 설치는 필요 없습니다. <Link href="/" className="text-blue-600 hover:underline">홈으로 이동</Link>해서
              PDF 파일을 업로드 영역에 끌어다 놓기만 하면, 몇 초 안에 검색·번역·AI 분석을 바로 시작할 수 있습니다.
            </p>
          </section>

        </div>
      </main>

      <footer className="py-4 pb-safe flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-gray-400 px-4">
        <span className="whitespace-nowrap">Made by 정진호(fdrn9999)</span>
        <a href="https://github.com/fdrn9999" target="_blank" rel="noopener noreferrer"
           className="whitespace-nowrap hover:text-gray-600 transition-colors">GitHub</a>
        <a href="mailto:ckato9173@gmail.com"
           className="whitespace-nowrap hover:text-gray-600 transition-colors">ckato9173@gmail.com</a>
        <span className="text-gray-300">|</span>
        <Link href="/about"
           className="whitespace-nowrap hover:text-gray-600 transition-colors">소개</Link>
        <Link href="/guide"
           className="whitespace-nowrap hover:text-gray-600 transition-colors">사용 가이드</Link>
        <Link href="/privacy"
           className="whitespace-nowrap hover:text-gray-600 transition-colors">개인정보처리방침</Link>
        <Link href="/"
           className="whitespace-nowrap hover:text-gray-600 transition-colors">홈으로</Link>
      </footer>
    </div>
  );
}
