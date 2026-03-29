import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '개인정보처리방침 - PaperLens',
  description: 'PaperLens 개인정보처리방침',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <a href="#privacy-content" className="skip-to-content">본문으로 건너뛰기</a>
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b bg-white">
        <Link href="/" className="flex items-center gap-2 hover:opacity-70 transition-opacity">
          <img src="/favicon.svg" alt="PaperLens 로고" className="w-7 h-7" />
          <h1 className="text-xl font-bold text-gray-800">PaperLens</h1>
        </Link>
        <p className="text-sm text-gray-500 hidden sm:block">AI 기반 논문 탐색 도구</p>
        <Link href="/" className="text-sm text-blue-600 hover:text-blue-700 transition-colors sm:hidden">홈으로</Link>
      </header>

      <main id="privacy-content" className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">개인정보처리방침</h1>
        <p className="text-sm text-gray-400 mb-8">시행일: 2025년 1월 1일 | 최종 수정: 2026년 3월 29일</p>

        <div className="prose prose-gray prose-sm max-w-none space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. 개요</h2>
            <p>
              PaperLens(이하 &quot;서비스&quot;)는 이용자의 개인정보를 중요시하며, 「개인정보 보호법」 등 관련 법령을 준수합니다.
              본 개인정보처리방침은 서비스가 어떤 정보를 수집하고, 어떻게 이용 및 보호하는지 안내합니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. 수집하는 개인정보 항목</h2>
            <p>서비스는 회원가입 절차가 없으며, 최소한의 정보만을 자동으로 수집합니다.</p>
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              <table className="w-full mt-3 text-sm border-collapse min-w-[400px]">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-2 px-3 font-medium text-gray-700">구분</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-700">항목</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-700">목적</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 px-3">자동 수집</td>
                    <td className="py-2 px-3">IP 주소</td>
                    <td className="py-2 px-3">API 남용 방지 (Rate Limiting)</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-3">자동 수집</td>
                    <td className="py-2 px-3">브라우저/기기 정보 (User-Agent)</td>
                    <td className="py-2 px-3">서비스 최적화 및 오류 분석</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-3">자동 수집</td>
                    <td className="py-2 px-3">쿠키 및 유사 기술</td>
                    <td className="py-2 px-3">광고 제공, 서비스 이용 분석</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3">
              이용자가 업로드하는 PDF 파일은 서버에 저장되지 않으며, 브라우저 내에서만 처리됩니다.
              번역 및 시맨틱 검색 요청 시 텍스트 일부가 Google Gemini API로 전송되며, 해당 데이터는 요청 처리 후 서버에 보관되지 않습니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. 개인정보의 이용 목적</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>서비스 제공 및 운영 (PDF 검색, 번역 기능)</li>
              <li>API 남용 방지 및 서비스 안정성 확보</li>
              <li>서비스 이용 통계 분석 및 품질 개선</li>
              <li>광고 게재 (Google AdSense 등 제3자 광고 서비스)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. 개인정보의 보유 및 파기</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>IP 주소</strong>: 서버 메모리에서 일시적으로 처리되며, 일일 단위로 자동 초기화됩니다. 별도의 데이터베이스에 저장하지 않습니다.</li>
              <li><strong>업로드 파일</strong>: 서버에 전송되거나 저장되지 않습니다. 모든 PDF 처리는 이용자의 브라우저에서 수행됩니다.</li>
              <li><strong>번역/검색 텍스트</strong>: API 요청 처리 후 즉시 폐기되며, 서버에 로그를 남기지 않습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. 제3자 제공 및 위탁</h2>
            <p>서비스는 다음의 외부 서비스를 이용하며, 이에 따라 이용자의 정보가 제3자에게 전달될 수 있습니다.</p>
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              <table className="w-full mt-3 text-sm border-collapse min-w-[400px]">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-2 px-3 font-medium text-gray-700">제공받는 자</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-700">항목</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-700">목적</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 px-3">Google (Gemini API)</td>
                    <td className="py-2 px-3">번역/검색 대상 텍스트</td>
                    <td className="py-2 px-3">번역 및 시맨틱 검색 처리</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-3">Google (AdSense)</td>
                    <td className="py-2 px-3">쿠키, 기기 정보, 이용 패턴</td>
                    <td className="py-2 px-3">맞춤형 광고 제공</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-3">Vercel</td>
                    <td className="py-2 px-3">IP 주소, 접속 로그</td>
                    <td className="py-2 px-3">서비스 호스팅 및 운영</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. 쿠키 및 광고</h2>
            <p>
              서비스는 Google AdSense를 통해 광고를 게재할 수 있으며, 이 과정에서 Google 및 제3자 광고 네트워크가
              쿠키를 사용하여 이용자의 관심사에 기반한 맞춤형 광고를 제공할 수 있습니다.
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Google은 DoubleClick 쿠키를 사용하여 이용자가 본 서비스 및 다른 웹사이트 방문 기록을 기반으로 광고를 게재합니다.</li>
              <li>이용자는 <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google 광고 설정</a>에서 맞춤 광고를 비활성화할 수 있습니다.</li>
              <li>이용자는 브라우저 설정을 통해 쿠키 저장을 거부할 수 있으며, 이 경우 일부 서비스 이용이 제한될 수 있습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. 이용자의 권리</h2>
            <p>이용자는 언제든지 다음의 권리를 행사할 수 있습니다.</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>브라우저 쿠키 삭제를 통한 추적 정보 초기화</li>
              <li>광고 개인화 설정 변경 또는 비활성화</li>
              <li>개인정보 관련 문의 및 열람/삭제 요청</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. 아동의 개인정보 보호</h2>
            <p>
              서비스는 만 14세 미만 아동의 개인정보를 의도적으로 수집하지 않습니다.
              만 14세 미만 이용자의 개인정보가 수집된 사실을 인지할 경우 즉시 해당 정보를 삭제합니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">9. 개인정보처리방침의 변경</h2>
            <p>
              본 방침은 법령 변경 또는 서비스 변경 사항을 반영하기 위해 수정될 수 있습니다.
              변경 시 서비스 내 공지를 통해 안내하며, 변경된 방침은 게시 즉시 효력이 발생합니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">10. 개인정보 보호책임자 및 연락처</h2>
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              <table className="w-full mt-3 text-sm border-collapse">
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 px-3 font-medium text-gray-700 bg-gray-50 w-32">성명</td>
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

        </div>
      </main>

      <footer className="py-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-gray-400">
        <span className="whitespace-nowrap">Made by 정진호(fdrn9999)</span>
        <a href="https://github.com/fdrn9999" target="_blank" rel="noopener noreferrer"
           className="whitespace-nowrap hover:text-gray-600 transition-colors">GitHub</a>
        <a href="mailto:ckato9173@gmail.com"
           className="whitespace-nowrap hover:text-gray-600 transition-colors">ckato9173@gmail.com</a>
        <span className="text-gray-300">|</span>
        <Link href="/"
           className="whitespace-nowrap hover:text-gray-600 transition-colors">홈으로</Link>
      </footer>
    </div>
  );
}
