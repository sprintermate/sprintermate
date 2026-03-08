import winston from 'winston';
import { SeqTransport } from '@datalust/winston-seq';

const isProduction = process.env.NODE_ENV === 'production';

const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, component, ...meta }) => {
    const comp = component ? `[${component}] ` : '';
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level} ${comp}${message}${metaStr}`;
  }),
);

const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
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
