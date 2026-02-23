import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produce a self-contained build so the Docker image only needs `node server.js`
  output: 'standalone',

  // In dev mode (no electron proxy) forward /api/* and /socket.io/* to the backend.
  // In production the electron proxy or nginx handles this routing instead.
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL ?? 'http://127.0.0.1:4000';
    return [
      { source: '/api/:path*',       destination: `${backendUrl}/api/:path*` },
      { source: '/socket.io/:path*', destination: `${backendUrl}/socket.io/:path*` },
    ];
  },
};

export default withNextIntl(nextConfig);
