import http from 'http';
import httpProxy from 'http-proxy';

const PROXY_PORT = 8080;
const BACKEND_PORT = 4000;
const FRONTEND_PORT = 3000;

// Per-request store so the proxyRes handler can rewrite Location headers
// using the correct public host/proto for that specific request.
const reqMeta = new WeakMap<http.IncomingMessage, { host: string; proto: string }>();

export function createProxy(): http.Server {
  const proxy = httpProxy.createProxyServer({});

  proxy.on('error', (err, _req, res) => {
    console.error('[proxy] error:', (err as Error).message);
    if (res instanceof http.ServerResponse && !res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('Bad Gateway — service is starting up, please retry.');
    }
  });

  // Rewrite any localhost redirect Location headers that Next.js emits
  // (e.g. next-intl locale redirect) back to the real public URL.
  proxy.on('proxyRes', (proxyRes, req) => {
    const location = proxyRes.headers['location'];
    if (typeof location !== 'string') return;

    const meta = reqMeta.get(req as http.IncomingMessage);
    if (!meta?.host) return;

    const fixed = location.replace(
      /^https?:\/\/(localhost|127\.0\.0\.1):(3000|8080)\b/,
      `${meta.proto}://${meta.host}`
    );
    if (fixed !== location) {
      proxyRes.headers['location'] = fixed;
      console.log(`[proxy] rewrote Location: ${location} → ${fixed}`);
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
      // Explicitly set the host header to the public hostname so Next.js middleware
      // constructs request.url with the correct origin (not localhost:3000).
      if (forwardedHost) {
        req.headers['host'] = forwardedHost;
      }
      // Store metadata for the proxyRes handler to use.
      reqMeta.set(req, { host: forwardedHost, proto: forwardedProto });
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
