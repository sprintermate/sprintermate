import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

const logger = isProduction
  ? pino(
      { level: 'info' },
      pino.transport({
        target: 'pino-seq',
        options: {
          serverUrl: process.env.SEQ_URL,
          apiKey: process.env.SEQ_API_KEY,
        },
      }),
    )
  : pino(
      { level: 'debug' },
      pino.transport({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }),
    );

export default logger;

export function childLogger(component: string): pino.Logger {
  return logger.child({ component });
}
