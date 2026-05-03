import type { Metadata } from 'next';
import { MarketingLandingPage } from '@/components/marketing/LandingPage';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://bayaan.ai';

export const metadata: Metadata = {
  title:
    'Bayaan.ai — Real-time speech translation for classrooms, sermons & conferences',
  description:
    'Bayaan.ai delivers real-time speech translation and live captions for classrooms, sermons, and conferences. 50+ languages, ~2.5s latency, no installs for listeners.',
  alternates: { canonical: '/' },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}#organization`,
      name: 'Bayaan.ai',
      url: SITE_URL,
      logo: `${SITE_URL}/icon.svg`,
      sameAs: ['https://bayaan.app'],
      contactPoint: [
        {
          '@type': 'ContactPoint',
          email: 'support@bayaan.ai',
          contactType: 'customer support',
          availableLanguage: ['English', 'Arabic', 'Dutch'],
        },
      ],
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}#website`,
      url: SITE_URL,
      name: 'Bayaan.ai',
      publisher: { '@id': `${SITE_URL}#organization` },
      inLanguage: 'en',
    },
    {
      '@type': 'SoftwareApplication',
      name: 'Bayaan.ai',
      applicationCategory: 'CommunicationApplication',
      operatingSystem: 'Web, iOS, Android',
      description:
        'Real-time speech translation and live captions for classrooms, sermons, and conferences in 50+ languages.',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      featureList: [
        'Real-time speech translation',
        'Live captions in 50+ languages',
        '~2.5 second latency',
        'Classroom, sermon, and conference modes',
        'No install required for listeners',
      ],
      url: SITE_URL,
    },
  ],
};

export default function Page() {
  return (
    <>
      {/* Paint the hero immediately. The poster JPEG is ~31KB and the video
          source kicks in once the browser has bandwidth (preload="metadata"). */}
      <link
        rel="preload"
        as="image"
        href="/marketing/camera-preview-poster.jpg"
        fetchPriority="high"
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MarketingLandingPage />
    </>
  );
}
