import type { Metadata, Viewport } from 'next';
import './globals.css';
import CookieConsent from '@/components/CookieConsent';

// Runs before paint to set the theme class, preventing a flash of the wrong theme.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('paperlens-theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;var d=t==='dark'||(t!=='light'&&m);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

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
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="antialiased overflow-x-hidden">
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
