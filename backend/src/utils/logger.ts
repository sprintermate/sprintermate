import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const seqUrl = process.env.SEQ_URL;

function isPinoSeqAvailable(): boolean {
  try {
    require.resolve('pino-seq');
    return true;
  } catch {
    return false;
  }
}

const logger = (() => {
  if (isProduction) {
    if (seqUrl && isPinoSeqAvailable()) {
      return pino(
        { level: 'info' },
        pino.transport({
          targets: [
            { target: 'pino/file', options: { destination: 1 }, level: 'info' as const },
            {
              target: 'pino-seq',
              options: { serverUrl: seqUrl, apiKey: process.env.SEQ_API_KEY },
              level: 'info' as const,
            },
          ],
        }),
      );
    }
    return pino({ level: 'info' });
  }
  return pino(
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
})();

export default logger;

export function childLogger(component: string): pino.Logger {
  return logger.child({ component });
}
