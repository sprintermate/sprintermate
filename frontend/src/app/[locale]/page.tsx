import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import Header from '@/components/Header';
import Hero from '@/components/Hero';
import Features from '@/components/Features';
import HowItWorks from '@/components/HowItWorks';
import Integrations from '@/components/Integrations';
import Footer from '@/components/Footer';

type Props = { params: Promise<{ locale: string }> };

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sprintermate.com';

const localeMeta: Record<string, { title: string; description: string; ogLocale: string }> = {
  en: {
    title: 'Sprintermate AI — AI-Powered Agile',
    description:
      'Real-time planning poker, AI story-point estimation, Azure DevOps integration, and AI-powered retrospectives for agile teams.',
    ogLocale: 'en_US',
  },
  tr: {
    title: 'Sprintermate AI — Yapay Zeka Destekli Agile',
    description:
      'Gerçek zamanlı planlama pokeri, YZ hikaye puanı tahmini, Azure DevOps entegrasyonu ve agile ekipler için YZ destekli retrospektifler.',
    ogLocale: 'tr_TR',
  },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const meta = localeMeta[locale] ?? localeMeta.en;

  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: `${siteUrl}/${locale}`,
      languages: {
        en: `${siteUrl}/en`,
        tr: `${siteUrl}/tr`,
        'x-default': `${siteUrl}/en`,
      },
    },
    openGraph: {
      type: 'website',
      url: `${siteUrl}/${locale}`,
      title: meta.title,
      description: meta.description,
      locale: meta.ogLocale,
      siteName: 'Sprintermate AI',
      images: [
        {
          url: '/en/opengraph-image',
          width: 1200,
          height: 630,
          alt: 'Sprintermate AI — AI-Powered Agile planning poker and estimation',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: meta.title,
      description: meta.description,
      images: ['/en/opengraph-image'],
    },
  };
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Sprintermate AI',
    url: siteUrl,
    description:
      'AI-powered agile planning platform with real-time planning poker, story-point estimation, and retrospectives.',
    inLanguage: ['en', 'tr'],
  };

  const softwareSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Sprintermate AI',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: siteUrl,
    description:
      'Real-time planning poker with AI story-point estimation, Azure DevOps integration, and AI-powered sprint retrospectives for agile teams.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    featureList: [
      'Real-time planning poker',
      'AI story-point estimation',
      'Azure DevOps integration',
      'AI-powered retrospectives',
      'Fibonacci voting',
      'Historical sprint analysis',
    ],
    screenshot: `${siteUrl}/en/opengraph-image`,
  };

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Sprintermate AI',
    url: siteUrl,
    logo: {
      '@type': 'ImageObject',
      url: `${siteUrl}/android-chrome-512x512.png`,
      width: 512,
      height: 512,
    },
    sameAs: [] as string[],
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([websiteSchema, softwareSchema, organizationSchema]),
        }}
      />
      <Header />
      <Hero />
      <Features />
      <HowItWorks />
      <Integrations />
      <Footer />
    </main>
  );
}
