import '../styles/globals.css';
import '@livekit/components-styles';
import '@livekit/components-styles/prefabs';
import type { Metadata, Viewport } from 'next';
import { Poppins, Kalam, Patrick_Hand } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { getDirection, type Locale } from '@/i18n/config';
import { ToasterProvider } from './components/ToasterProvider';
import { Providers } from './providers';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-poppins',
});

// Marketing-only display fonts. Loaded globally so [data-mkt-root] inherits them
// without flash; product UI never references --font-kalam / --font-patrick.
const kalam = Kalam({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-kalam',
  display: 'swap',
});

const patrickHand = Patrick_Hand({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-patrick',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Bayaan.ai | Real-Time Speech Translation for Classrooms',
    template: '%s | Bayaan.ai',
  },
  description:
    'Bayaan.ai provides real-time speech translation for classrooms, enabling multilingual learning experiences with live transcription and translation.',
  twitter: {
    card: 'summary_large_image',
  },
  openGraph: {
    siteName: 'Bayaan.ai',
  },
  icons: {
    icon: {
      rel: 'icon',
      url: '/favicon.ico',
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

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${poppins.variable} ${kalam.variable} ${patrickHand.variable}`}
      suppressHydrationWarning
    >
      <body data-lk-theme="default" className={poppins.className}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <ToasterProvider />
            {children}
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
