import type { Metadata, Viewport } from 'next';
import './globals.css';
import CookieConsent from '@/components/CookieConsent';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

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
  twitter: {
    card: 'summary_large_image',
    title: 'PaperLens - AI 기반 논문 탐색 도구',
    description: '논문을 빠르게 이해하고 원하는 정보를 정확히 찾게 해주는 AI 기반 PDF 탐색 도구',
  },
  robots: { index: true, follow: true },
  metadataBase: new URL('https://paperlens.site'),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7165994147929640"
          crossOrigin="anonymous"
        />
      </head>
      <body className="antialiased overflow-x-hidden">
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
