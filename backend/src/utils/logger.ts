import winston from 'winston';
import { SeqTransport } from '@datalust/winston-seq';
import { requestContextStorage } from './asyncContext';

const isProduction = process.env.NODE_ENV === 'production';

// Injects userId/email/ip from AsyncLocalStorage into every log entry
// produced during a request, without requiring callers to pass it manually.
const requestContextFormat = winston.format((info) => {
  const ctx = requestContextStorage.getStore();
  if (ctx) {
    info.userId = ctx.userId;
    info.email = ctx.email;
    info.ip = ctx.ip;
  }
  return info;
})();

const devFormat = winston.format.combine(
  requestContextFormat,
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, component, userId, email, ip, ...meta }) => {
    const comp = component ? `[${component}] ` : '';
    const caller = userId ? ` (user=${userId} email=${email} ip=${ip})` : '';
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level} ${comp}${message}${caller}${metaStr}`;
  }),
);

const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  format: isProduction ? requestContextFormat : undefined,
  transports: isProduction
    ? [
        new SeqTransport({
          serverUrl: process.env.SEQ_URL ?? 'http://seq:5341',
          apiKey: process.env.SEQ_API_KEY || undefined,
          onError: (e) => console.error('[seq]', e),
          handleExceptions: true,
          handleRejections: true,
        }),
      ]
    : [new winston.transports.Console({ format: devFormat })],
});

export default logger;

export function childLogger(component: string): winston.Logger {
  return logger.child({ component });
}
