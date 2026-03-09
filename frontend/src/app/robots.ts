import type { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sprintermate.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/en/', '/tr/'],
        disallow: [
          '/en/dashboard',
          '/tr/dashboard',
          '/en/room/',
          '/tr/room/',
          '/en/retro/',
          '/tr/retro/',
          '/en/projects/',
          '/tr/projects/',
          '/api/',
          '/socket.io/',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
