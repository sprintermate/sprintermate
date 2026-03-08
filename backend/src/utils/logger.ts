import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

const logger = isProduction
  ? pino(
      { level: 'info' },
      pino.transport({
        target: 'pino-seq',
        options: {
          serverUrl: process.env.SEQ_URL ?? 'http://localhost:5341',
          apiKey: process.env.SEQ_API_KEY,
        },
      }),
    )
  : pino({ level: 'silent' });

export default logger;

export function childLogger(component: string): pino.Logger {
  return logger.child({ component });
}
