import type { MetadataRoute } from 'next';
import { getAllPosts } from '@/lib/blog';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sprintermate.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const locales = ['en', 'tr'] as const;

  const homePages = locales.map((locale) => ({
    url: `${siteUrl}/${locale}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 1.0,
  }));

  const blogListPages = locales.map((locale) => ({
    url: `${siteUrl}/${locale}/blog`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  const postPages = locales.flatMap((locale) =>
    getAllPosts(locale).map((post) => ({
      url: `${siteUrl}/${locale}/blog/${post.slug}`,
      lastModified: new Date(post.date),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  );

  return [...homePages, ...blogListPages, ...postPages];
}
