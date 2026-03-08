import http from 'http';
import dotenv from 'dotenv';
import { createApp } from './app';
import { initSocket } from './socket';
import { initSchema } from './db/schema';
import { childLogger } from './utils/logger';

dotenv.config();

const log = childLogger('backend');
const PORT = process.env.PORT ?? 4000;

async function main() {
  await initSchema();

  const app        = createApp();
  const httpServer = http.createServer(app);
  initSocket(httpServer);

  httpServer.listen(PORT, () => {
    log.info(`listening on http://localhost:${PORT}`, { port: PORT });
  });
}

main().catch((err) => {
  log.error('startup error', { err });
  process.exit(1);
});
