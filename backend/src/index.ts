import http from 'http';
import dotenv from 'dotenv';
import { createApp } from './app';
import { initSocket } from './socket';
import { initSchema } from './db/schema';

dotenv.config();

const PORT = process.env.PORT ?? 4000;

async function main() {
  await initSchema();

  const app        = createApp();
  const httpServer = http.createServer(app);
  initSocket(httpServer);

  httpServer.listen(PORT, () => {
    console.log(`[backend] listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('[backend] startup error', err);
  process.exit(1);
});
