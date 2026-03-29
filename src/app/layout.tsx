import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PaperLens - AI 기반 논문 탐색 도구',
  description: '논문을 빠르게 이해하고 원하는 정보를 정확히 찾게 해주는 AI 기반 PDF 탐색 도구',
  icons: {
    icon: { url: '/favicon.svg', type: 'image/svg+xml' },
  },
  openGraph: {
    title: 'PaperLens - AI 기반 논문 탐색 도구',
    description: '논문을 빠르게 이해하고 원하는 정보를 정확히 찾게 해주는 AI 기반 PDF 탐색 도구',
    type: 'website',
    siteName: 'PaperLens',
    locale: 'ko_KR',
  },
  robots: { index: true, follow: true },
  metadataBase: new URL('https://paperlens.app'),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
