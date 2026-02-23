import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Exclude /api/* and socket.io from locale middleware — those go straight to the backend
  matcher: ['/((?!_next|_vercel|api|socket.io|.*\..*).*)'],
};
