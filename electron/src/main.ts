import { app, BrowserWindow, Tray, Menu, clipboard, shell, ipcMain, dialog } from 'electron';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import http from 'http';
import * as ngrok from '@ngrok/ngrok';
import { loadConfig, saveConfig, generateSecrets, getDbPath, AppConfig } from './config';
import { createProxy, closeProxy } from './proxy';

// ── State ──────────────────────────────────────────────────────────────────────

/** Single persistent window used for setup → loading → ready states */
let mainWindow: BrowserWindow | null = null;
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

// ── IPC handlers (registered once) ──────────────────────────────────────────

function registerIpcHandlers(): void {
  ipcMain.handle('open-external', (_e, url: string) => shell.openExternal(url));
  ipcMain.handle('copy-text', (_e, text: string) => { clipboard.writeText(text); });
}

// ── Main window ───────────────────────────────────────────────────────────────

function createMainWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 580,
    height: 520,
    resizable: false,
    title: 'Scrum Poker',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Closing the window always quits the app
  mainWindow.on('close', () => {
    mainWindow = null;
    gracefulShutdown();
  });

  return mainWindow;
}

function showSetupPage(): void {
  mainWindow?.setSize(580, 520);
  mainWindow?.setResizable(false);
  mainWindow?.setTitle('Scrum Poker — Setup');
  mainWindow?.loadURL(
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
    showLoadingPage();
    await startApp(config);
  });
}

function showLoadingPage(): void {
  mainWindow?.setSize(460, 320);
  mainWindow?.setResizable(false);
  mainWindow?.setTitle('Scrum Poker — Starting…');
  mainWindow?.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(getLoadingPageHTML())}`
  );
}

function sendLoadingUpdate(message: string): void {
  mainWindow?.webContents.send('loading:update', message);
}

function showReadyPage(pubUrl: string, localUrl: string): void {
  mainWindow?.setSize(580, 480);
  mainWindow?.setResizable(false);
  mainWindow?.setTitle('Scrum Poker — Running');
  mainWindow?.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(getReadyPageHTML(pubUrl, localUrl))}`
  );
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

// ── Loading page HTML ─────────────────────────────────────────────────────────

function getLoadingPageHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' data:">
<title>Starting…</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0f172a; color: #94a3b8;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    height: 100vh; margin: 0;
    -webkit-font-smoothing: antialiased;
    -webkit-app-region: drag;
    overflow: hidden;
  }

  /* Card glow */
  .logo {
    font-size: 3rem;
    margin-bottom: 28px;
    filter: drop-shadow(0 0 18px rgba(99,102,241,0.6));
    animation: float 3s ease-in-out infinite;
  }
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50%       { transform: translateY(-6px); }
  }

  /* Concentric ring spinner */
  .rings {
    position: relative;
    width: 56px; height: 56px;
    margin-bottom: 28px;
  }
  .ring {
    position: absolute; inset: 0;
    border-radius: 50%;
    border: 3px solid transparent;
  }
  .ring-1 {
    border-top-color: #6366f1;
    animation: spin 0.9s linear infinite;
  }
  .ring-2 {
    inset: 8px;
    border-top-color: #818cf8;
    animation: spin 1.3s linear infinite reverse;
  }
  .ring-3 {
    inset: 16px;
    border-top-color: #a5b4fc;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Steps list */
  .steps {
    list-style: none; margin: 0; padding: 0;
    display: flex; flex-direction: column; gap: 8px;
    width: 280px;
  }
  .step {
    display: flex; align-items: center; gap: 10px;
    font-size: 0.82rem;
    opacity: 0.35;
    transition: opacity 0.4s, color 0.4s;
    -webkit-app-region: no-drag;
  }
  .step.active  { opacity: 1;    color: #e2e8f0; }
  .step.done    { opacity: 0.55; color: #6ee7b7; }
  .step .dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: currentColor; flex-shrink: 0;
  }
  .step.active .dot { animation: pulse 1s ease-in-out infinite; }
  @keyframes pulse {
    0%, 100% { transform: scale(1);   opacity: 1; }
    50%       { transform: scale(1.5); opacity: 0.6; }
  }
</style>
</head>
<body>
  <div class="logo">🃏</div>
  <div class="rings">
    <div class="ring ring-1"></div>
    <div class="ring ring-2"></div>
    <div class="ring ring-3"></div>
  </div>
  <ul class="steps" id="steps">
    <li class="step" data-key="proxy">  <span class="dot"></span> Starting proxy server</li>
    <li class="step" data-key="ngrok">  <span class="dot"></span> Connecting ngrok tunnel</li>
    <li class="step" data-key="backend"><span class="dot"></span> Starting backend</li>
    <li class="step" data-key="frontend"><span class="dot"></span> Starting frontend</li>
  </ul>

  <script>
    const ORDER = ['proxy', 'ngrok', 'backend', 'frontend'];
    let currentIdx = -1;

    function activate(key) {
      const idx = ORDER.indexOf(key);
      if (idx === -1) return;
      // mark previous steps done
      for (let i = 0; i < idx; i++) {
        const el = document.querySelector('[data-key="' + ORDER[i] + '"]');
        el.classList.remove('active');
        el.classList.add('done');
      }
      if (currentIdx >= 0 && currentIdx < idx) {
        const prev = document.querySelector('[data-key="' + ORDER[currentIdx] + '"]');
        prev?.classList.remove('active');
        prev?.classList.add('done');
      }
      document.querySelector('[data-key="' + key + '"]').classList.add('active');
      currentIdx = idx;
    }

    window.electronAPI.onLoadingUpdate((msg) => {
      if (msg.includes('proxy'))    activate('proxy');
      else if (msg.includes('ngrok'))   activate('ngrok');
      else if (msg.includes('backend')) activate('backend');
      else if (msg.includes('frontend')) activate('frontend');
    });
  </script>
</body>
</html>`;
}

// ── Ready page HTML ───────────────────────────────────────────────────────────

function getReadyPageHTML(pubUrl: string, localUrl: string): string {
  const safePublic = pubUrl.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeLocal  = localUrl.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' data:">
<title>Scrum Poker — Ready</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0f172a; color: #e2e8f0;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    height: 100vh; margin: 0; padding: 32px;
    -webkit-font-smoothing: antialiased;
    gap: 0;
  }

  /* Animated checkmark circle */
  .check-wrap {
    width: 72px; height: 72px;
    border-radius: 50%;
    background: linear-gradient(135deg, #4f46e5, #7c3aed);
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 24px;
    box-shadow: 0 0 0 0 rgba(99,102,241,0.5);
    animation: ripple 2s ease-out infinite;
  }
  @keyframes ripple {
    0%   { box-shadow: 0 0 0 0   rgba(99,102,241,0.45); }
    70%  { box-shadow: 0 0 0 20px rgba(99,102,241,0);   }
    100% { box-shadow: 0 0 0 0   rgba(99,102,241,0);   }
  }
  .check-wrap svg { width: 36px; height: 36px; stroke: white; }

  h1 { font-size: 1.45rem; font-weight: 700; color: #f1f5f9;
       margin: 0 0 6px; text-align: center; }
  .sub { font-size: 0.82rem; color: #64748b; margin: 0 0 28px; text-align: center; }

  /* URL card */
  .url-card {
    width: 100%; max-width: 440px;
    background: #1e293b; border: 1px solid #334155;
    border-radius: 14px; padding: 18px 20px;
    margin-bottom: 12px;
  }
  .url-label {
    font-size: 0.7rem; font-weight: 700; letter-spacing: 0.08em;
    text-transform: uppercase; color: #6366f1; margin-bottom: 8px;
  }
  .url-row {
    display: flex; align-items: center; gap: 8px;
  }
  .url-text {
    flex: 1; font-family: ui-monospace, monospace; font-size: 0.82rem;
    color: #a5b4fc; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .icon-btn {
    flex-shrink: 0;
    width: 32px; height: 32px;
    background: #0f172a; border: 1px solid #334155;
    border-radius: 8px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    color: #64748b; transition: color 0.15s, background 0.15s;
    -webkit-app-region: no-drag;
  }
  .icon-btn:hover { color: #e2e8f0; background: #1e293b; }
  .icon-btn svg { width: 15px; height: 15px; stroke: currentColor; fill: none;
                  stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .icon-btn.copied { color: #6ee7b7; border-color: #6ee7b7; }

  .open-btn {
    width: 100%; max-width: 440px;
    padding: 12px 20px;
    background: linear-gradient(135deg, #4f46e5, #7c3aed);
    color: white; border: none; border-radius: 12px;
    font-size: 0.95rem; font-weight: 600; cursor: pointer;
    transition: opacity 0.15s, transform 0.15s;
    margin-bottom: 16px;
    -webkit-app-region: no-drag;
  }
  .open-btn:hover { opacity: 0.9; transform: translateY(-1px); }
  .open-btn:active { transform: translateY(0); }

  .close-hint {
    font-size: 0.75rem; color: #475569; text-align: center; margin-top: 4px;
  }
  .local-row {
    font-size: 0.75rem; color: #475569; display: flex; align-items: center; gap: 6px;
    margin-top: 6px;
  }
  .local-row a { color: #6366f1; cursor: pointer; text-decoration: none; -webkit-app-region: no-drag; }
  .local-row a:hover { text-decoration: underline; }
</style>
</head>
<body>
  <div class="check-wrap">
    <svg viewBox="0 0 24 24" fill="none" stroke-width="2.5"
         stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  </div>

  <h1>Scrum Poker is ready!</h1>
  <p class="sub">Share the link below with your team</p>

  <div class="url-card">
    <div class="url-label">Public URL (share with teammates)</div>
    <div class="url-row">
      <span class="url-text" id="pub-url">${safePublic}</span>
      <button class="icon-btn" id="copy-pub" title="Copy">
        <svg viewBox="0 0 24 24">
          <rect x="9" y="9" width="13" height="13" rx="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
      </button>
    </div>
  </div>

  <button class="open-btn" id="open-pub">
    Open in Browser
  </button>

  <div class="local-row">
    Local access: <a id="open-local">${safeLocal}</a>
  </div>

  <p class="close-hint">Closing this window will stop Scrum Poker.</p>

  <script>
    const pubUrl   = ${JSON.stringify(pubUrl)};
    const localUrl = ${JSON.stringify(localUrl)};

    document.getElementById('open-pub').addEventListener('click', () => {
      window.electronAPI.openExternal(pubUrl);
    });
    document.getElementById('open-local').addEventListener('click', () => {
      window.electronAPI.openExternal(localUrl);
    });

    const copyBtn = document.getElementById('copy-pub');
    copyBtn.addEventListener('click', () => {
      window.electronAPI.copyText(pubUrl);
      copyBtn.classList.add('copied');
      copyBtn.innerHTML = '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';
      setTimeout(() => {
        copyBtn.classList.remove('copied');
        copyBtn.innerHTML = '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
      }, 2000);
    });
  </script>
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
      label: 'Open local URL',
      click: () => shell.openExternal(localUrl),
    },
    ...(publicUrl
      ? [
          {
            label: 'Open public URL (ngrok)',
            click: () => shell.openExternal(publicUrl),
          },
        ]
      : []),
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
  try {
    // 1. Start proxy
    sendLoadingUpdate('proxy');
    proxyServer = createProxy();

    // 2. Connect ngrok
    sendLoadingUpdate('ngrok');
    publicUrl = await startNgrok(config.ngrokAuthToken);
    console.log(`[main] ngrok URL: ${publicUrl}`);

    // 3. Start backend
    sendLoadingUpdate('backend');
    const frontendUrl = `http://localhost:8080,${publicUrl}`;
    backendProcess = spawnBackend(config, frontendUrl);
    await pollHealth('http://127.0.0.1:4000/api/health');
    console.log('[main] backend ready');

    // 4. Start frontend
    sendLoadingUpdate('frontend');
    frontendProcess = spawnFrontend();
    await sleep(4000);
    console.log('[main] frontend ready');

    // 5. Build system tray
    buildTray('http://localhost:8080');

    // 6. Show ready page — window stays open
    showReadyPage(publicUrl, 'http://localhost:8080');

    console.log('[main] startup complete');
    console.log(`[main] local:  http://localhost:8080`);
    console.log(`[main] public: ${publicUrl}`);

  } catch (err) {
    console.error('[main] startup error:', err);
    dialog.showErrorBox(
      'Startup Failed',
      `Scrum Poker could not start:\n\n${(err as Error).message}\n\nCheck your ngrok auth token and try again.`
    );
    await gracefulShutdown();
  }
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  registerIpcHandlers();

  // Always keep running — only quit via window close or tray Quit
  app.on('window-all-closed', () => { /* intentional: tray app */ });

  // Intercept quit so graceful shutdown always runs
  app.on('before-quit', (event) => {
    if (!isShuttingDown) {
      event.preventDefault();
      void gracefulShutdown();
    }
  });

  createMainWindow();

  const config = loadConfig();

  if (!config) {
    showSetupPage();
  } else {
    showLoadingPage();
    await startApp(config);
  }
});
