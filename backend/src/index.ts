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
  const app        = createApp();
  const httpServer = http.createServer(app);
  initSocket(httpServer);

  // Start listening immediately so health checks pass while DB initialises
  await new Promise<void>((resolve) => {
    httpServer.listen(PORT, () => {
      log.info(`listening on http://localhost:${PORT}`, { port: PORT });
      resolve();
    });
  });

  // Initialise schema after the server is already accepting connections.
  // Any API request that arrives before this completes will fail gracefully.
  await initSchema();
}

main().catch((err) => {
  log.error('startup error', { err });
  process.exit(1);
});
