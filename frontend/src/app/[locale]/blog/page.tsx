import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getAllPosts } from '@/lib/blog';

type Props = { params: Promise<{ locale: string }> };

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sprintermate.com';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'blog' });

  return {
    title: `${t('listTitle')} — Sprintermate AI`,
    description: t('listDescription'),
    alternates: {
      canonical: `${siteUrl}/${locale}/blog`,
      languages: {
        en: `${siteUrl}/en/blog`,
        tr: `${siteUrl}/tr/blog`,
        'x-default': `${siteUrl}/en/blog`,
      },
    },
    openGraph: {
      type: 'website',
      url: `${siteUrl}/${locale}/blog`,
      title: `${t('listTitle')} — Sprintermate AI`,
      description: t('listDescription'),
      siteName: 'Sprintermate AI',
    },
  };
}

export default async function BlogListPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'blog' });
  const posts = getAllPosts(locale);

  return (
    <main>
      <Header />
      <div className="pt-24 pb-16 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12">
            <p className="text-sm font-semibold text-cyan-600 dark:text-indigo-400 uppercase tracking-widest mb-3">
              {t('sectionLabel')}
            </p>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              {t('listTitle')}
            </h1>
            <p className="text-lg text-gray-500 dark:text-slate-400 max-w-2xl">
              {t('listDescription')}
            </p>
          </div>

          {posts.length === 0 ? (
            <p className="text-gray-500 dark:text-slate-400">{t('noPosts')}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="group block p-6 rounded-2xl border border-gray-200 bg-white/50 hover:border-gray-300 hover:bg-white dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-slate-700 dark:hover:bg-slate-900 transition-all duration-300"
                >
                  <div className="flex flex-wrap gap-2 mb-3">
                    {post.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="text-xs font-medium px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-cyan-600 dark:group-hover:text-indigo-400 transition-colors">
                    {post.title}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-slate-400 line-clamp-3 mb-4">
                    {post.description}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-slate-500">
                    <span>{post.author}</span>
                    <span>·</span>
                    <time dateTime={post.date}>
                      {new Date(post.date).toLocaleDateString(
                        locale === 'tr' ? 'tr-TR' : 'en-US',
                        { year: 'numeric', month: 'long', day: 'numeric' },
                      )}
                    </time>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </main>
  );
}
