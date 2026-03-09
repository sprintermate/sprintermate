import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { ThemeProvider } from '@/components/ThemeProvider';
import { GoogleAnalytics } from '@next/third-parties/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sprintermate.com';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Sprintermate AI — AI-Powered Agile',
    template: '%s | Sprintermate AI',
  },
  description:
    'Real-time planning poker, AI story-point estimation, Azure DevOps integration, and AI-powered retrospectives for agile teams.',
  applicationName: 'Sprintermate AI',
  keywords: [
    'planning poker',
    'agile estimation',
    'story points',
    'scrum',
    'Azure DevOps',
    'AI estimation',
    'sprint planning',
    'retrospective',
    'agile tools',
  ],
  authors: [{ name: 'Sprintermate AI' }],
  creator: 'Sprintermate AI',
  openGraph: {
    type: 'website',
    siteName: 'Sprintermate AI',
    title: 'Sprintermate AI — AI-Powered Agile',
    description:
      'Real-time planning poker, AI story-point estimation, Azure DevOps integration, and AI-powered retrospectives.',
    locale: 'en_US',
    alternateLocale: ['tr_TR'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sprintermate AI — AI-Powered Agile',
    description:
      'Real-time planning poker, AI story-point estimation, Azure DevOps integration, and AI-powered retrospectives.',
  },
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} className="scroll-smooth dark" suppressHydrationWarning>
      <body className={`${inter.className} bg-gray-50 text-gray-900 dark:bg-slate-950 dark:text-white antialiased`}>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
      <GoogleAnalytics gaId="G-QBJW82V286" />
    </html>
  );
}
