import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getPostBySlug, getAllSlugs } from '@/lib/blog';
import { routing } from '@/i18n/routing';

type Props = { params: Promise<{ locale: string; slug: string }> };

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sprintermate.com';

export async function generateStaticParams() {
  const params: { locale: string; slug: string }[] = [];

  for (const locale of routing.locales) {
    const slugs = getAllSlugs(locale);
    for (const slug of slugs) {
      params.push({ locale, slug });
    }
  }

  return params;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await getPostBySlug(locale, slug);

  if (!post) return {};

  return {
    title: `${post.title} — Sprintermate AI`,
    description: post.description,
    alternates: {
      canonical: `${siteUrl}/${locale}/blog/${slug}`,
      languages: {
        en: `${siteUrl}/en/blog/${slug}`,
        tr: `${siteUrl}/tr/blog/${slug}`,
        'x-default': `${siteUrl}/en/blog/${slug}`,
      },
    },
    openGraph: {
      type: 'article',
      url: `${siteUrl}/${locale}/blog/${slug}`,
      title: post.title,
      description: post.description,
      siteName: 'Sprintermate AI',
      publishedTime: post.date,
      authors: [post.author],
      tags: post.tags,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const post = await getPostBySlug(locale, slug);

  if (!post) notFound();

  const t = await getTranslations({ locale, namespace: 'blog' });

  const blogPostingSchema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    author: {
      '@type': 'Person',
      name: post.author,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Sprintermate AI',
      url: siteUrl,
    },
    url: `${siteUrl}/${locale}/blog/${slug}`,
    keywords: post.tags.join(', '),
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogPostingSchema) }}
      />
      <Header />
      <div className="pt-24 pb-16 min-h-screen">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <Link
              href="/blog"
              className="inline-flex items-center gap-1 text-sm text-cyan-600 dark:text-indigo-400 hover:underline"
            >
              ← {t('backToBlog')}
            </Link>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs font-medium px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 dark:bg-indigo-900/40 dark:text-indigo-300"
              >
                {tag}
              </span>
            ))}
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            {post.title}
          </h1>

          <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-slate-500 mb-10">
            <span>{post.author}</span>
            <span>·</span>
            <time dateTime={post.date}>
              {new Date(post.date).toLocaleDateString(
                locale === 'tr' ? 'tr-TR' : 'en-US',
                { year: 'numeric', month: 'long', day: 'numeric' },
              )}
            </time>
          </div>

          <div
            className="prose prose-gray dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: post.contentHtml! }}
          />
        </div>
      </div>
      <Footer />
    </main>
  );
}
