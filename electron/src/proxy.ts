import http from 'http';
import httpProxy from 'http-proxy';

const PROXY_PORT = 8080;
const BACKEND_PORT = 4000;
const FRONTEND_PORT = 3000;

export function createProxy(): http.Server {
  const proxy = httpProxy.createProxyServer({});

  proxy.on('error', (err, _req, res) => {
    console.error('[proxy] error:', (err as Error).message);
    if (res instanceof http.ServerResponse && !res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('Bad Gateway — service is starting up, please retry.');
    }
  });

  const server = http.createServer((req, res) => {
    const url = req.url ?? '/';

    // Preserve the real host/proto so Next.js builds correct redirect Location headers
    // (e.g. when accessed via the ngrok public URL instead of localhost).
    const forwardedHost  = (req.headers['x-forwarded-host'] as string | undefined) ?? req.headers.host ?? '';
    const forwardedProto = (req.headers['x-forwarded-proto'] as string | undefined) ?? 'http';

    if (url.startsWith('/api/') || url.startsWith('/socket.io/')) {
      proxy.web(req, res, {
        target: `http://127.0.0.1:${BACKEND_PORT}`,
        xfwd: true,
      });
    } else {
      // Inject headers BEFORE handing off so Next.js sees the real public host/proto
      // and generates correct Location headers in redirects.
      req.headers['x-forwarded-host']  = forwardedHost;
      req.headers['x-forwarded-proto'] = forwardedProto;
      proxy.web(req, res, {
        target: `http://127.0.0.1:${FRONTEND_PORT}`,
        xfwd: false,
      });
    }
  });

  // WebSocket upgrade — required for Socket.io
  server.on('upgrade', (req, socket, head) => {
    const url = req.url ?? '/';
    if (url.startsWith('/socket.io/')) {
      proxy.ws(req, socket, head, {
        target: `http://127.0.0.1:${BACKEND_PORT}`,
      });
    } else {
      proxy.ws(req, socket, head, {
        target: `http://127.0.0.1:${FRONTEND_PORT}`,
      });
    }
  });

  server.listen(PROXY_PORT, '127.0.0.1', () => {
    console.log(`[proxy] listening on http://127.0.0.1:${PROXY_PORT}`);
  });

  return server;
}

export function closeProxy(server: http.Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}
