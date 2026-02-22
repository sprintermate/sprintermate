import { setRequestLocale } from 'next-intl/server';
import Header from '@/components/Header';
import Hero from '@/components/Hero';
import Features from '@/components/Features';
import HowItWorks from '@/components/HowItWorks';
import Integrations from '@/components/Integrations';
import Footer from '@/components/Footer';

type Props = { params: Promise<{ locale: string }> };

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main>
      <Header />
      <Hero />
      <Features />
      <HowItWorks />
      <Integrations />
      <Footer />
    </main>
  );
}
