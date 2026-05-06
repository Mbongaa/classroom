import '../styles/globals.css';
// LiveKit component styles are scoped to room routes via per-route layouts
// (app/rooms/layout.tsx, app/v2/rooms/layout.tsx, app/custom/layout.tsx) so the
// marketing landing and other product surfaces don't pay for ~30KB of unused CSS.
import type { Metadata, Viewport } from 'next';
import { Poppins, Kalam, Patrick_Hand } from 'next/font/google';
import { headers } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { getDirection, type Locale } from '@/i18n/config';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { ToasterProvider } from './components/ToasterProvider';
import { Providers } from './providers';

// Routes whose surface uses the sketch design system (marketing landing +
// auth pages). On these routes we render <html class="mkt-active"> server
// side so the cream paper bg and body-scroll unlock are in place before
// React hydrates. Prevents a first-paint dark flash on slow connections
// and on browsers where `:has()` isn't supported.
const MARKETING_ROUTES = new Set(['/', '/login', '/signup', '/forgot-password', '/reset-password']);

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

// Marketing-only display fonts. The marketing surface's identity depends on
// these loading, so we use `display: 'swap'` (font swaps in once available)
// + `preload: true` (fetched via <link rel="preload"> in <head>). The previous
// `optional` + no-preload combo locked in a `cursive` fallback per-device on
// uncached visits, which is why fonts looked different across devices.
// Next/Font's default `adjustFontFallback: true` ships size-adjusted metrics
// so the swap doesn't cause layout shift.
const kalam = Kalam({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-kalam',
  display: 'swap',
  preload: true,
});

const patrickHand = Patrick_Hand({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-patrick',
  display: 'swap',
  preload: true,
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://bayaan.ai';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default:
      'Bayaan.ai — Real-time speech translation for classrooms, sermons & conferences',
    template: '%s | Bayaan.ai',
  },
  description:
    'Bayaan.ai delivers real-time speech translation and live captions for classrooms, sermons, and conferences. 50+ languages, ~2.5s latency, no installs for listeners.',
  applicationName: 'Bayaan.ai',
  keywords: [
    'real-time translation',
    'live translation',
    'speech translation',
    'sermon translation',
    'classroom translation',
    'conference translation',
    'live captions',
    'multilingual streaming',
    'Arabic translation',
    'mosque translation',
    'dawah technology',
  ],
  authors: [{ name: 'Bayaan.ai' }],
  creator: 'Bayaan.ai',
  publisher: 'Bayaan.ai',
  alternates: {
    canonical: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title:
      'Bayaan.ai — Real-time speech translation for classrooms, sermons & conferences',
    description:
      'Real-time speech translation with live captions in 50+ languages. Built for classrooms, sermons, and conferences.',
  },
  openGraph: {
    type: 'website',
    siteName: 'Bayaan.ai',
    title:
      'Bayaan.ai — Real-time speech translation for classrooms, sermons & conferences',
    description:
      'Real-time speech translation with live captions in 50+ languages. Built for classrooms, sermons, and conferences.',
    url: '/',
    locale: 'en_US',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Bayaan',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover', // Handles iOS notch/safe areas
  themeColor: '#070707',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = (await getLocale()) as Locale;
  const messages = await getMessages();
  const dir = getDirection(locale);

  // Read the pathname header set by middleware (lib/supabase/middleware.ts).
  // Static export / cases where the header isn't present fall back to no
  // class — the client-side useEffect in MarketingLandingPage / AuthShell
  // will still apply the class as a backstop.
  const headerStore = await headers();
  const pathname = headerStore.get('x-pathname') ?? '';
  const isMarketingSurface = MARKETING_ROUTES.has(pathname);

  return (
    <html
      lang={locale}
      dir={dir}
      className={[
        poppins.variable,
        kalam.variable,
        patrickHand.variable,
        isMarketingSurface ? 'mkt-active' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      suppressHydrationWarning
    >
      <body data-lk-theme="default" className={poppins.className}>
        {/* No-flash backstop: in environments where the middleware header
            isn't available (static export, edge cases) this script applies
            the `mkt-active` class synchronously before first paint based on
            pathname. Idempotent with the SSR class above. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var p=location.pathname;var r={'/':1,'/login':1,'/signup':1,'/forgot-password':1,'/reset-password':1};if(r[p])document.documentElement.classList.add('mkt-active');}catch(e){}})();",
          }}
        />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <ToasterProvider />
            {children}
          </Providers>
        </NextIntlClientProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
