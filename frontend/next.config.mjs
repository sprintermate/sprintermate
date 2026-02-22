import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produce a self-contained build so the Docker image only needs `node server.js`
  output: 'standalone',
};

export default withNextIntl(nextConfig);
