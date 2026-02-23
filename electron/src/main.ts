import { app, BrowserWindow, Tray, Menu, clipboard, shell, ipcMain, dialog } from 'electron';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import http from 'http';
import * as ngrok from '@ngrok/ngrok';
import { loadConfig, saveConfig, generateSecrets, getDbPath, AppConfig } from './config';
import { createProxy, closeProxy } from './proxy';

// ── State ──────────────────────────────────────────────────────────────────────

let setupWindow: BrowserWindow | null = null;
let loadingWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let backendProcess: ChildProcess | null = null;
let frontendProcess: ChildProcess | null = null;
let proxyServer: http.Server | null = null;
let ngrokListener: ngrok.Listener | null = null;
let publicUrl = '';

// ── Resource paths ────────────────────────────────────────────────────────────

function getResourcesPath(): string {
  // Packaged: process.resourcesPath = .../Contents/Resources
  // Dev: electron/dist/main.js → go up to repo root
  return app.isPackaged
    ? process.resourcesPath
    : path.join(__dirname, '..', '..');
}

function getBackendEntrypoint(): string {
  return path.join(getResourcesPath(), 'backend', 'dist', 'index.js');
}

function getFrontendEntrypoint(): string {
  return path.join(getResourcesPath(), 'frontend', '.next', 'standalone', 'server.js');
}

function getFrontendCwd(): string {
  return path.join(getResourcesPath(), 'frontend', '.next', 'standalone');
}

// ── Setup window ──────────────────────────────────────────────────────────────

function showSetupWindow(): void {
  setupWindow = new BrowserWindow({
    width: 580,
    height: 500,
    resizable: false,
    title: 'Scrum Poker — Setup',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  setupWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(getSetupHTML())}`
  );

  ipcMain.once('setup:save-token', async (_event, token: string) => {
    const existing = loadConfig();
    const secrets = existing ?? generateSecrets();
    const config: AppConfig = {
      ngrokAuthToken: token.trim(),
      sessionSecret: secrets.sessionSecret,
      encryptionKey: secrets.encryptionKey,
    };
    saveConfig(config);
    setupWindow?.close();
    setupWindow = null;
    await startApp(config);
  });
}

function getSetupHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' data:">
<title>Scrum Poker Setup</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0f172a;
    color: #e2e8f0;
    padding: 40px 48px;
    margin: 0;
    -webkit-font-smoothing: antialiased;
  }
  h1 { color: #818cf8; font-size: 1.6rem; margin: 0 0 6px; font-weight: 700; }
  .subtitle { color: #64748b; font-size: 0.85rem; margin: 0 0 24px; }
  p { color: #94a3b8; font-size: 0.9rem; line-height: 1.65; margin: 0 0 16px; }
  strong { color: #cbd5e1; }
  a { color: #818cf8; text-decoration: none; }
  a:hover { text-decoration: underline; }
  label { display: block; font-size: 0.8rem; font-weight: 600; color: #64748b;
          text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
  input {
    width: 100%; padding: 10px 14px;
    background: #1e293b; border: 1px solid #334155;
    border-radius: 8px; color: #e2e8f0; font-size: 0.9rem; font-family: monospace;
    outline: none; transition: border-color 0.15s;
  }
  input:focus { border-color: #6366f1; }
  .error { color: #f87171; font-size: 0.82rem; margin: 6px 0 0; display: none; }
  button {
    width: 100%; margin-top: 20px;
    background: #6366f1; color: white; border: none;
    padding: 12px 24px; border-radius: 8px; font-size: 0.95rem;
    font-weight: 600; cursor: pointer; transition: background 0.15s;
  }
  button:hover { background: #4f46e5; }
  .hint { margin-top: 20px; padding: 14px 16px; background: #1e293b;
          border: 1px solid #334155; border-radius: 8px; font-size: 0.82rem; color: #64748b; }
  .hint strong { color: #94a3b8; }
</style>
</head>
<body>
  <h1>Scrum Poker Desktop</h1>
  <p class="subtitle">First-time setup — takes less than a minute</p>

  <p>
    This app uses <strong>ngrok</strong> to create a secure public link so your
    teammates can join your planning sessions without any server setup.
  </p>

  <p>
    Create a free account and copy your auth token from
    <a href="#" id="ngrok-link">dashboard.ngrok.com/get-started/your-authtoken</a>.
  </p>

  <label for="token">ngrok Auth Token</label>
  <input
    type="text"
    id="token"
    placeholder="2abc1DEF..."
    autocomplete="off"
    spellcheck="false"
  >
  <p class="error" id="error">Please enter your ngrok auth token.</p>

  <button id="save">Save &amp; Launch Scrum Poker</button>

  <div class="hint">
    <strong>Why ngrok?</strong> It creates an encrypted tunnel from the internet to
    your machine so colleagues can join without configuring routers or firewalls.
    Your auth token is saved locally and never sent anywhere except ngrok.
  </div>

  <script>
    document.getElementById('ngrok-link').addEventListener('click', (e) => {
      e.preventDefault();
      window.electronAPI.openExternal(
        'https://dashboard.ngrok.com/get-started/your-authtoken'
      );
    });

    document.getElementById('save').addEventListener('click', () => {
      const token = document.getElementById('token').value.trim();
      const errorEl = document.getElementById('error');
      if (!token) {
        errorEl.style.display = 'block';
        return;
      }
      errorEl.style.display = 'none';
      document.getElementById('save').textContent = 'Launching…';
      document.getElementById('save').disabled = true;
      window.electronAPI.saveToken(token);
    });

    document.getElementById('token').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('save').click();
    });
  </script>
</body>
</html>`;
}

// ── Loading window ────────────────────────────────────────────────────────────

function showLoadingWindow(): BrowserWindow {
  loadingWindow = new BrowserWindow({
    width: 420,
    height: 280,
    resizable: false,
    frame: false,
    transparent: false,
    title: 'Scrum Poker',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  loadingWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(getLoadingHTML('Starting Scrum Poker…'))}`
  );
  return loadingWindow;
}

function updateLoadingWindow(message: string): void {
  loadingWindow?.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(getLoadingHTML(message))}`
  );
}

function getLoadingHTML(message: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #0f172a; color: #94a3b8;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    height: 100vh; margin: 0;
    -webkit-font-smoothing: antialiased;
    -webkit-app-region: drag;
  }
  .logo { font-size: 2rem; margin-bottom: 16px; }
  .spinner {
    width: 36px; height: 36px;
    border: 3px solid #1e293b;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    margin-bottom: 20px;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  p { font-size: 0.88rem; color: #64748b; margin: 0; text-align: center; padding: 0 24px; }
</style>
</head>
<body>
  <div class="logo">🃏</div>
  <div class="spinner"></div>
  <p>${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
</body>
</html>`;
}

// ── Child process helpers ─────────────────────────────────────────────────────

function spawnBackend(config: AppConfig, frontendUrl: string): ChildProcess {
  const entrypoint = getBackendEntrypoint();
  const cwd = path.dirname(path.dirname(entrypoint)); // backend/ dir

  const proc = spawn(
    process.execPath,
    [entrypoint],
    {
      cwd,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        PORT: '4000',
        FRONTEND_URL: frontendUrl,
        SESSION_SECRET: config.sessionSecret,
        ENCRYPTION_KEY: config.encryptionKey,
        DB_PATH: getDbPath(),
        NODE_ENV: 'production',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  proc.stdout?.on('data', (d: Buffer) => console.log('[backend]', d.toString().trim()));
  proc.stderr?.on('data', (d: Buffer) => console.error('[backend:err]', d.toString().trim()));
  proc.on('exit', (code) => console.log(`[backend] exited with code ${code}`));

  return proc;
}

function spawnFrontend(): ChildProcess {
  const entrypoint = getFrontendEntrypoint();
  const cwd = getFrontendCwd();

  const proc = spawn(
    process.execPath,
    [entrypoint],
    {
      cwd,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        PORT: '3000',
        HOSTNAME: '127.0.0.1',
        NODE_ENV: 'production',
        BACKEND_URL: 'http://127.0.0.1:4000',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  proc.stdout?.on('data', (d: Buffer) => console.log('[frontend]', d.toString().trim()));
  proc.stderr?.on('data', (d: Buffer) => console.error('[frontend:err]', d.toString().trim()));
  proc.on('exit', (code) => console.log(`[frontend] exited with code ${code}`));

  return proc;
}

// ── Health polling ────────────────────────────────────────────────────────────

function pollHealth(url: string, maxAttempts = 40, intervalMs = 1000): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts++;
      const req = http.get(url, (res) => {
        if (res.statusCode === 200) {
          clearInterval(timer);
          resolve();
        }
      });
      req.on('error', () => {
        if (attempts >= maxAttempts) {
          clearInterval(timer);
          reject(new Error(`Backend did not become healthy after ${maxAttempts} attempts.`));
        }
      });
      req.setTimeout(800, () => req.destroy());
    }, intervalMs);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── System tray ───────────────────────────────────────────────────────────────

function buildTray(localUrl: string): void {
  // Use a template image (macOS) or a regular icon
  const trayIcon = path.join(__dirname, '..', 'assets', 'tray.png');

  try {
    tray = new Tray(trayIcon);
  } catch {
    // If custom icon not found, fall back gracefully (uses default Electron icon)
    tray = new Tray(path.join(__dirname, '..', 'assets', 'icon.png'));
  }

  tray.setToolTip('Scrum Poker is running');
  updateTrayMenu(localUrl);
}

function updateTrayMenu(localUrl: string): void {
  if (!tray) return;

  const menu = Menu.buildFromTemplate([
    { label: 'Scrum Poker', enabled: false },
    { type: 'separator' },
    {
      label: publicUrl ? `Public URL ready` : 'Connecting to ngrok…',
      enabled: false,
    },
    ...(publicUrl
      ? [
          {
            label: publicUrl,
            enabled: false,
            toolTip: 'Share this URL with your teammates',
          },
          {
            label: 'Copy public URL',
            click: () => clipboard.writeText(publicUrl),
          },
        ]
      : []),
    { type: 'separator' as const },
    {
      label: 'Open in browser',
      click: () => shell.openExternal(localUrl),
    },
    { type: 'separator' as const },
    {
      label: 'Quit',
      click: () => gracefulShutdown(),
    },
  ]);

  tray.setContextMenu(menu);
}

// ── ngrok ─────────────────────────────────────────────────────────────────────

async function startNgrok(authToken: string): Promise<string> {
  ngrokListener = await ngrok.forward({
    addr: 8080,
    authtoken: authToken,
    // Skips the ngrok browser warning page shown to free-tier users
    response_header_add: ['ngrok-skip-browser-warning:true'],
  });
  return ngrokListener.url() ?? '';
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────

let isShuttingDown = false;

async function gracefulShutdown(): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log('[main] shutting down…');

  try {
    if (ngrokListener) {
      await ngrok.disconnect();
      ngrokListener = null;
    }
  } catch (e) {
    console.error('[main] ngrok disconnect error:', e);
  }

  if (proxyServer) {
    await closeProxy(proxyServer);
    proxyServer = null;
  }

  frontendProcess?.kill('SIGTERM');
  backendProcess?.kill('SIGTERM');

  await sleep(800);

  app.exit(0);
}

// ── Main startup flow ─────────────────────────────────────────────────────────

async function startApp(config: AppConfig): Promise<void> {
  showLoadingWindow();

  try {
    // 1. Start proxy (port 8080 must be open before ngrok connects)
    updateLoadingWindow('Starting proxy server…');
    proxyServer = createProxy();

    // 2. Connect ngrok — needs port 8080 open; 502s from proxy are fine
    updateLoadingWindow('Connecting ngrok tunnel…\n(this may take a few seconds)');
    publicUrl = await startNgrok(config.ngrokAuthToken);
    console.log(`[main] ngrok URL: ${publicUrl}`);

    // 3. Start backend with ngrok URL in FRONTEND_URL so CORS + secure cookies work
    updateLoadingWindow('Starting backend…');
    const frontendUrl = `http://localhost:8080,${publicUrl}`;
    backendProcess = spawnBackend(config, frontendUrl);
    await pollHealth('http://127.0.0.1:4000/api/health');
    console.log('[main] backend ready');

    // 4. Start frontend (Next.js standalone has no health endpoint)
    updateLoadingWindow('Starting frontend…');
    frontendProcess = spawnFrontend();
    await sleep(4000);
    console.log('[main] frontend ready');

    // 5. Build system tray
    buildTray('http://localhost:8080');

    // 6. Auto-open browser to local URL (faster than going through ngrok)
    await shell.openExternal('http://localhost:8080');

    // 7. Close loading window
    loadingWindow?.close();
    loadingWindow = null;

    console.log('[main] startup complete');
    console.log(`[main] local:  http://localhost:8080`);
    console.log(`[main] public: ${publicUrl}`);

  } catch (err) {
    console.error('[main] startup error:', err);
    loadingWindow?.close();
    dialog.showErrorBox(
      'Startup Failed',
      `Scrum Poker could not start:\n\n${(err as Error).message}\n\nCheck your ngrok auth token and try again.`
    );
    await gracefulShutdown();
  }
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  // Tray app — do not quit when all windows close
  app.on('window-all-closed', () => { /* intentional no-op */ });

  // Intercept quit to run graceful shutdown
  app.on('before-quit', (event) => {
    if (!isShuttingDown) {
      event.preventDefault();
      gracefulShutdown();
    }
  });

  const config = loadConfig();

  if (!config) {
    showSetupWindow();
  } else {
    await startApp(config);
  }
});
