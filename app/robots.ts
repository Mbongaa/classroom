import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://bayaan.ai';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard/',
          '/superadmin/',
          '/onboarding/',
          '/auth/',
          '/test-classroom',
          '/v2/',
          '/manage-rooms',
          '/rooms/',
          '/custom/',
          '/s/',
          '/t/',
          '/speech-s/',
          '/speech-t/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
