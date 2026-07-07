import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';

export const metadata: Metadata = {
  title: '사용 가이드 - PaperLens',
  description: 'PaperLens의 PDF 업로드, 지능형 키워드 검색, 키워드 패널, AI 논문 분석, 드래그 번역, 키보드 단축키까지 모든 기능을 단계별로 안내합니다.',
  openGraph: {
    title: '사용 가이드 - PaperLens',
    description: 'PaperLens의 모든 기능을 단계별로 안내하는 사용 가이드',
    type: 'article',
  },
};

export default function GuidePage() {
  return (
    <div className="min-h-[100dvh] bg-white max-w-[100vw] overflow-x-hidden">
      <Script
        id="adsbygoogle-init"
        async
        strategy="afterInteractive"
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7165994147929640"
        crossOrigin="anonymous"
      />

      <a href="#guide-content" className="skip-to-content">본문으로 건너뛰기</a>
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b bg-white">
        <Link href="/" className="flex items-center gap-2 hover:opacity-70 transition-opacity">
          <img src="/favicon.svg" alt="PaperLens 로고" className="w-7 h-7" />
          <h1 className="text-xl font-bold text-gray-800">PaperLens</h1>
        </Link>
        <p className="text-sm text-gray-500 hidden sm:block">AI 기반 논문 탐색 도구</p>
        <Link href="/" className="text-sm text-blue-600 hover:text-blue-700 transition-colors sm:hidden">홈으로</Link>
      </header>

      <main id="guide-content" className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">사용 가이드</h1>
        <p className="text-sm text-gray-400 mb-8">PaperLens의 모든 기능을 단계별로 안내합니다</p>

        {/* 목차 */}
        <nav aria-label="목차" className="mb-10 p-4 border border-gray-200 rounded-lg bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">목차</h2>
          <ol className="list-decimal pl-5 text-sm text-gray-600 space-y-1">
            <li><a href="#upload" className="hover:text-blue-600 hover:underline">PDF 업로드로 시작하기</a></li>
            <li><a href="#search" className="hover:text-blue-600 hover:underline">지능형 키워드 검색</a></li>
            <li><a href="#result-panel" className="hover:text-blue-600 hover:underline">검색 결과 패널 활용법</a></li>
            <li><a href="#keywords" className="hover:text-blue-600 hover:underline">키워드 패널로 논문 구조 파악하기</a></li>
            <li><a href="#chat" className="hover:text-blue-600 hover:underline">AI 논문 분석(Chat)으로 질문하기</a></li>
            <li><a href="#translate" className="hover:text-blue-600 hover:underline">드래그 한 번으로 번역하기</a></li>
            <li><a href="#viewer-mode" className="hover:text-blue-600 hover:underline">뷰어 모드 — 스크롤 vs 페이지</a></li>
            <li><a href="#shortcuts" className="hover:text-blue-600 hover:underline">키보드 단축키 전체 목록</a></li>
            <li><a href="#quota" className="hover:text-blue-600 hover:underline">일일 사용량(Quota) 이해하기</a></li>
            <li><a href="#limits" className="hover:text-blue-600 hover:underline">파일 제한 및 지원 사양</a></li>
            <li><a href="#faq" className="hover:text-blue-600 hover:underline">자주 묻는 질문(FAQ)</a></li>
          </ol>
        </nav>

        <div className="prose prose-gray prose-sm max-w-none space-y-10 text-gray-700 leading-relaxed">

          <section id="upload">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. PDF 업로드로 시작하기</h2>
            <p>
              PaperLens는 별도의 회원가입이나 로그인 없이 홈 화면에서 바로 사용할 수 있습니다.
              홈 화면 가운데의 업로드 영역에 PDF 파일을 드래그해 놓거나, 영역을 클릭해 파일 선택창에서 논문을 고르세요.
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-3">
              <li>업로드 직후 브라우저에서 텍스트 레이어를 추출하고, 토큰 단위의 검색 인덱스를 자동 생성합니다.</li>
              <li>인덱싱은 전부 사용자의 브라우저에서 로컬로 처리되며, 별도의 서버 준비 과정이 없습니다.</li>
              <li>업로드된 원본 PDF는 서버로 전송되지 않으며, 새로고침하거나 탭을 닫으면 흔적 없이 사라집니다.</li>
            </ul>
            <p className="mt-3">
              상단 로고를 누르거나 파일명 옆의 × 버튼을 누르면 언제든 초기화할 수 있으며, 처음 사용하는 경우 PDF 로드 직후
              자동으로 기능 안내 튜토리얼이 표시됩니다. 튜토리얼은 우측 상단의 ? 버튼으로 다시 열 수 있습니다.
            </p>
          </section>

          <section id="search">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. 지능형 키워드 검색</h2>
            <p>
              PaperLens의 가장 핵심적인 기능은 상단 검색바의 지능형 검색입니다.
              일반적인 브라우저 Ctrl+F와 달리 &quot;단어 경계&quot;를 이해합니다. 예를 들어 <code>ai</code>를 검색해도
              <code>claim</code>이나 <code>said</code>처럼 글자만 일치하는 단어는 결과에서 제외됩니다.
            </p>

            <h3 className="text-base font-semibold text-gray-800 mt-5 mb-2">빠른 토큰 검색(정확 매칭)</h3>
            <p>
              입력한 단어와 정확히 일치하는 문장을 찾습니다. 대소문자는 기본적으로 무시되며, 토큰 단위 인덱스에서 검색하므로
              수백 페이지짜리 논문에서도 거의 즉시 결과가 반환됩니다.
              실험 이름, 변수명, 저자 이름, 데이터셋 이름처럼 &quot;표기가 고정된&quot; 대상을 찾을 때 가장 빠르고 정확합니다.
            </p>

            <h3 className="text-base font-semibold text-gray-800 mt-5 mb-2">자동 보정 매칭</h3>
            <p>
              정확히 같은 표기가 아니어도 찾아줍니다. 검색은 여러 계층으로 동작하며, 아래 보정이 자동으로 적용됩니다.
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>대소문자·악센트/발음기호 무시 (<code>Café</code> = <code>cafe</code>, 합자 <code>ﬁ</code> = <code>fi</code>)</li>
              <li>영어 활용형(어간) 매칭 (<code>running</code>으로 검색하면 <code>run</code> 계열도 포함)</li>
              <li>짧은 오타 자동 교정 (퍼지 매칭)</li>
              <li>하이픈이나 줄바꿈으로 쪼개진 단어도 하나로 인식</li>
            </ul>
            <p className="mt-3">
              정확히 일치하는 결과가 항상 위쪽에 정렬되고, 보정으로 찾은 결과가 그 아래에 이어집니다.
              자동 보정이 특히 유용한 순간은 다음과 같습니다.
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>대소문자나 악센트 표기가 헷갈릴 때</li>
              <li>단어의 활용형(복수형·-ing 등)까지 한 번에 찾고 싶을 때</li>
              <li>오타를 냈거나 논문의 정확한 철자가 확실치 않을 때</li>
            </ul>
          </section>

          <section id="result-panel">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. 검색 결과 패널 활용법</h2>
            <p>
              검색을 실행하면 좌측 사이드바의 <strong>검색 결과</strong> 탭이 자동으로 열립니다.
              각 결과 항목은 페이지 번호, 해당 문장 스니펫, 그리고 키워드 주변의 강조 표시를 함께 보여줍니다.
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-3">
              <li>결과를 클릭하면 본문의 해당 위치로 즉시 이동하고 형광펜이 자동으로 표시됩니다.</li>
              <li>모바일·태블릿에서는 햄버거 버튼을 눌러 사이드바를 열 수 있으며, 검색 결과 개수는 배지로 표시됩니다.</li>
              <li>PC에서는 사이드바가 항상 고정되어 있어 결과를 보면서 바로 본문과 비교할 수 있습니다.</li>
            </ul>
          </section>

          <section id="keywords">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. 키워드 패널로 논문 구조 파악하기</h2>
            <p>
              사이드바의 <strong>키워드</strong> 탭은 업로드한 논문에서 중요한 단어와 구를 뽑아 보여줍니다.
              논문을 처음 열었을 때 전체 주제와 주요 용어를 빠르게 파악하는 용도로 쓰기 좋습니다.
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-3">
              <li>제시된 키워드를 누르면 해당 단어에 대한 검색이 실행되고, 결과 탭으로 자연스럽게 넘어갑니다.</li>
              <li>논문의 핵심 개념이 무엇인지 모를 때 좋은 출발점이 됩니다. 키워드 → 검색 → 본문 확인 순서로 훑으면 효율적입니다.</li>
            </ul>
          </section>

          <section id="chat">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. AI 논문 분석(Chat)으로 질문하기</h2>
            <p>
              사이드바의 <strong>AI</strong> 탭에서는 논문 내용을 바탕으로 AI에게 직접 질문할 수 있습니다.
              단순 검색으로는 답하기 어려운 요약성·추론성 질문에 적합합니다.
            </p>
            <p className="mt-3">질문 예시:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>&quot;이 논문이 해결하려는 문제를 세 줄로 요약해줘.&quot;</li>
              <li>&quot;저자가 제안한 방법과 기존 방법의 차이를 표로 정리해줘.&quot;</li>
              <li>&quot;실험에서 사용된 데이터셋과 평가 지표는 무엇인가?&quot;</li>
              <li>&quot;Limitations 섹션의 핵심 주장 세 가지를 뽑아줘.&quot;</li>
            </ul>
            <p className="mt-3">
              답변은 업로드된 논문 본문을 컨텍스트로 생성되므로, 일반 챗봇보다 훨씬 구체적이고 문서 기반의 답을 얻을 수 있습니다.
              단, AI 응답은 참고용입니다 — 중요한 판단이 필요한 대목은 본문을 직접 확인하세요.
            </p>
          </section>

          <section id="translate">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. 드래그 한 번으로 번역하기</h2>
            <p>
              본문에서 번역하고 싶은 문장이나 문단을 마우스로 드래그하면 작은 번역 버튼이 나타납니다.
              버튼을 누르면 하단에 번역 결과 패널이 열리고, Gemini API가 한국어로 번역한 결과를 보여줍니다.
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-3">
              <li>짧은 구절부터 여러 문단까지 유연하게 처리됩니다.</li>
              <li>번역할 텍스트는 요청 시점에만 AI로 전송되며, 서버에 저장되지 않습니다.</li>
              <li>번역 패널은 Esc로 빠르게 닫을 수 있습니다.</li>
            </ul>
          </section>

          <section id="viewer-mode">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. 뷰어 모드 — 스크롤 vs 페이지</h2>
            <p>
              PDF 뷰어는 두 가지 읽기 모드를 지원합니다. 본인의 독서 습관에 맞게 선택하세요.
            </p>
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              <table className="w-full mt-3 text-sm border-collapse min-w-0">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-2 px-3 font-medium text-gray-700">모드</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-700">특징</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-700">페이지 이동</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 px-3 align-top">스크롤 모드</td>
                    <td className="py-2 px-3 align-top">웹 페이지처럼 위아래로 자연스럽게 훑을 수 있습니다. 전체 흐름을 빠르게 스캔할 때 편합니다.</td>
                    <td className="py-2 px-3 align-top">↑ / ↓</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-3 align-top">페이지 모드</td>
                    <td className="py-2 px-3 align-top">한 번에 한 페이지씩 표시됩니다. 논문을 한 페이지 단위로 꼼꼼히 읽을 때 집중력이 더 잘 유지됩니다.</td>
                    <td className="py-2 px-3 align-top">← / →</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3">
              두 모드 모두 Page Up / Page Down, Home / End 키로 페이지를 빠르게 이동할 수 있습니다.
            </p>
          </section>

          <section id="shortcuts">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. 키보드 단축키 전체 목록</h2>
            <p>
              PDF가 로드된 상태에서 다음 단축키를 사용할 수 있습니다. 입력 필드에 포커스가 있을 때는 페이지 이동 단축키가 동작하지 않습니다.
            </p>
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              <table className="w-full mt-3 text-sm border-collapse min-w-0">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-2 px-3 font-medium text-gray-700">단축키</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-700">동작</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 px-3 font-mono">Ctrl / ⌘ + F</td>
                    <td className="py-2 px-3">검색바에 포커스 (사이드바가 닫혀 있으면 자동으로 열림)</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-3 font-mono">Ctrl / ⌘ + 1</td>
                    <td className="py-2 px-3">사이드바를 &quot;검색 결과&quot; 탭으로 전환</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-3 font-mono">Ctrl / ⌘ + 2</td>
                    <td className="py-2 px-3">사이드바를 &quot;키워드&quot; 탭으로 전환</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-3 font-mono">Ctrl / ⌘ + 3</td>
                    <td className="py-2 px-3">사이드바를 &quot;AI&quot; 탭으로 전환</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-3 font-mono">Esc</td>
                    <td className="py-2 px-3">번역 패널과 사이드바를 닫기</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-3 font-mono">↑ / ↓</td>
                    <td className="py-2 px-3">스크롤 모드에서 이전/다음 페이지</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-3 font-mono">← / →</td>
                    <td className="py-2 px-3">페이지 모드에서 이전/다음 페이지</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-3 font-mono">Page Up / Page Down</td>
                    <td className="py-2 px-3">이전 / 다음 페이지 (모드 무관)</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-3 font-mono">Home / End</td>
                    <td className="py-2 px-3">첫 페이지 / 마지막 페이지로 이동</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section id="quota">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">9. 일일 사용량(Quota) 이해하기</h2>
            <p>
              PaperLens는 Gemini API 비용을 안정적으로 운영하기 위해 일부 기능에 하루 단위 사용량 한도를 두고 있습니다.
              상단 우측의 사용량 버튼을 누르면 오늘 남은 한도를 확인할 수 있습니다.
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-3">
              <li>검색과 페이지 이동 등 기본 기능은 브라우저에서 로컬로 처리되어 한도와 무관하게 자유롭게 사용할 수 있습니다.</li>
              <li>번역과 AI 논문 분석은 Gemini API를 사용하므로 하루 단위 한도 안에서 동작합니다.</li>
              <li>한도는 매일 자정에 초기화되며, 초과 시 영향을 받지 않는 기능은 계속 사용할 수 있습니다.</li>
            </ul>
            <p className="mt-3">
              한도 방식에 대한 자세한 정보는 <Link href="/privacy" className="text-blue-600 hover:underline">개인정보처리방침</Link>을 참고하세요.
              IP 기반으로 카운트되며, 별도의 개인정보는 저장하지 않습니다.
            </p>
          </section>

          <section id="limits">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">10. 파일 제한 및 지원 사양</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>파일 형식:</strong> PDF만 지원합니다. 이미지 스캔 PDF는 텍스트 레이어가 없으면 검색·번역이 불가능합니다.</li>
              <li><strong>파일 크기:</strong> 최대 10MB까지 업로드를 권장합니다. 더 큰 파일은 브라우저 메모리 상황에 따라 로딩이 느려질 수 있습니다.</li>
              <li><strong>브라우저:</strong> 최신 Chrome, Edge, Safari, Firefox에서 테스트되었습니다. 모바일 브라우저도 지원합니다.</li>
              <li><strong>네트워크:</strong> 검색은 모두 브라우저에서 로컬로 처리되며, 번역·AI 분석만 인터넷 연결이 필요합니다.</li>
            </ul>
          </section>

          <section id="faq">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">11. 자주 묻는 질문(FAQ)</h2>

            <h3 className="text-base font-semibold text-gray-800 mt-4 mb-1">Q. 업로드한 PDF가 서버에 저장되나요?</h3>
            <p>
              아니요. PDF 파일 자체는 서버로 전송되지 않고, 브라우저 안에서만 처리됩니다. 번역·AI 분석 기능을 사용할
              때는 해당 요청에 필요한 텍스트만 Gemini API로 전송되며, 요청 처리 후에는 서버에 남지 않습니다. 검색은 전송 없이 로컬에서 처리됩니다.
            </p>

            <h3 className="text-base font-semibold text-gray-800 mt-4 mb-1">Q. 검색 결과가 엉뚱한 문장을 포함해요.</h3>
            <p>
              검색은 오타 교정(퍼지)과 활용형 매칭까지 포함하기 때문에, 드물게 의도와 다른 단어가 잡힐 수 있습니다.
              정확히 일치하는 결과가 항상 위쪽에 정렬되므로 상단 결과부터 확인하세요. 더 좁히려면 검색어를 여러 단어로 길게 입력하면 정확도가 올라갑니다.
            </p>

            <h3 className="text-base font-semibold text-gray-800 mt-4 mb-1">Q. 한국어 논문도 지원하나요?</h3>
            <p>
              예. 키워드 검색과 번역 모두 한국어 PDF에서 동작합니다. 다만 이미지로만 구성된 스캔 PDF는
              텍스트 레이어가 없기 때문에 검색 대상이 되지 않습니다.
            </p>

            <h3 className="text-base font-semibold text-gray-800 mt-4 mb-1">Q. 모바일에서도 쓸 수 있나요?</h3>
            <p>
              네. 모바일과 태블릿 모두 지원합니다. 화면이 좁은 환경에서는 사이드바가 기본적으로 숨겨져 있고, 햄버거 버튼으로 열 수 있습니다.
              단, PDF 렌더링은 메모리를 많이 쓰기 때문에 페이지 수가 아주 많은 논문에서는 PC 환경이 더 쾌적합니다.
            </p>

            <h3 className="text-base font-semibold text-gray-800 mt-4 mb-1">Q. 번역 품질이 마음에 안 들어요.</h3>
            <p>
              번역은 Gemini API를 사용합니다. 일반 문장은 자연스럽게 처리되지만, 수식·표·전문 용어가 뒤섞인 구절은 원문 확인을 권장합니다.
              짧게 끊어서 번역하면 대체로 품질이 더 좋아집니다.
            </p>

            <h3 className="text-base font-semibold text-gray-800 mt-4 mb-1">Q. AI 답변을 그대로 믿어도 되나요?</h3>
            <p>
              AI 논문 분석은 빠른 이해를 돕기 위한 보조 수단입니다. 중요한 인용·수치·주장은 반드시 본문을 직접 확인하세요.
              PaperLens는 결과가 본문의 어느 부분에서 왔는지 추적할 수 있도록 검색 결과 패널과 함께 사용하는 것을 권장합니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">더 알아보기</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><Link href="/about" className="text-blue-600 hover:underline">PaperLens 소개</Link> — 이 서비스가 어떤 문제를 해결하려고 만들어졌는지</li>
              <li><Link href="/privacy" className="text-blue-600 hover:underline">개인정보처리방침</Link> — 수집 항목과 외부 서비스 연동 정보</li>
              <li><Link href="/" className="text-blue-600 hover:underline">지금 PDF 업로드해서 써 보기</Link></li>
            </ul>
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
