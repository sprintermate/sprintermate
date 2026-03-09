import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { getAllPosts } from '@/lib/blog';

export default function BlogSection({ locale }: { locale: string }) {
  const t = useTranslations('blog');
  const posts = getAllPosts(locale).slice(0, 3);

  if (posts.length === 0) return null;

  return (
    <section className="py-24 sm:py-32 border-t border-gray-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-12">
          <div>
            <p className="text-sm font-semibold text-cyan-600 dark:text-indigo-400 uppercase tracking-widest mb-3">
              {t('sectionLabel')}
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
              {t('sectionTitle')}
            </h2>
          </div>
          <Link
            href="/blog"
            className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-cyan-600 dark:text-indigo-400 hover:underline shrink-0"
          >
            {t('viewAll')} →
          </Link>
        </div>

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
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-cyan-600 dark:group-hover:text-indigo-400 transition-colors">
                {post.title}
              </h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 line-clamp-3 mb-4">
                {post.description}
              </p>
              <time
                dateTime={post.date}
                className="text-xs text-gray-400 dark:text-slate-500"
              >
                {new Date(post.date).toLocaleDateString(
                  locale === 'tr' ? 'tr-TR' : 'en-US',
                  { year: 'numeric', month: 'long', day: 'numeric' },
                )}
              </time>
            </Link>
          ))}
        </div>

        <div className="mt-8 sm:hidden">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1 text-sm font-medium text-cyan-600 dark:text-indigo-400 hover:underline"
          >
            {t('viewAll')} →
          </Link>
        </div>
      </div>
    </section>
  );
}
