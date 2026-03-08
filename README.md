# Sprintermate

**Planning poker that actually helps your team estimate smarter.**

Sprintermate combines real-time collaborative voting with AI-powered story point estimation. Your team votes together, the AI learns from your history, and estimates get better every sprint — no more endless debates or anchoring bias.

- **Real-time voting** — everyone votes simultaneously, reveal when ready
- **AI estimation** — blends AI scope analysis with your team's historical velocity
- **Azure DevOps integration** — pull work items directly, no copy-pasting
- **Works everywhere** — browser, desktop app, or self-hosted
- **Open source** — own your data, run it your way

**Stack:** Next.js 14 · Express · Socket.IO · SQLite/PostgreSQL · TypeScript · Tailwind CSS

# How can I use it?

You can use Sprintermate in the cloud with no setup, or self-host it locally.

## Cloud version

Visit **[sprintermate.com](https://sprintermate.com)** and start a session in seconds.

## Self-host locally

You have 3 options to run Sprintermate locally: a desktop app, Docker, or manually with Node.js. The desktop app is the easiest way to get started without any dependencies.

### Desktop App

No Docker or Node.js required. Downloads and runs as a native app with a built-in ngrok tunnel.

```bash
bash scripts/build-electron.sh
cd electron && npm run dist:mac    # → dist-electron/Sprintermate-*.dmg
cd electron && npm run dist:win    # → dist-electron/Sprintermate-*.exe
cd electron && npm run dist:linux  # → dist-electron/Sprintermate-*.AppImage
```

On first launch you'll be prompted for a free [ngrok auth token](https://dashboard.ngrok.com/get-started/your-authtoken). The app then starts everything and shows a shareable public URL in the system tray.

## Docker

```bash
cp .env.example .env
# Set: JWT_SECRET, ENCRYPTION_KEY, NGROK_AUTHTOKEN
docker compose up --build
# App: http://localhost | ngrok inspector: http://localhost:4040
```

### Manually

Requires Node.js and a free [ngrok](https://dashboard.ngrok.com/get-started/your-authtoken) account for a shareable URL.

```bash
# Terminal 1 — backend
cd backend && npm install && npm run dev     # http://localhost:4000

# Terminal 2 — frontend
cd frontend && npm install && npm run dev    # http://localhost:3000

# Terminal 3 — ngrok (optional, for sharing)
ngrok http 3000
```

Copy `backend/.env.example` to `backend/.env` and set `JWT_SECRET`, `ENCRYPTION_KEY`, and `FRONTEND_URL=http://localhost:3000`.

---

## Environment Variables

| Variable          | Description                                            |
| ----------------- | ------------------------------------------------------ |
| `JWT_SECRET`      | Secret for session signing                             |
| `ENCRYPTION_KEY`  | AES-256-GCM key for encrypted Azure DevOps PAT storage |
| `FRONTEND_URL`    | CORS origin(s) — comma-separated for multiple          |
| `NGROK_AUTHTOKEN` | ngrok token (Docker only)                              |
| `PORT`            | Backend port (default `4000`)                          |
| `DB_PATH`         | SQLite file path (default `data/scrum-poker.db`)       |
