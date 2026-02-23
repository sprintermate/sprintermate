# Scrum Poker

Real-time planning poker with AI-powered story point estimation and Azure DevOps integration.

**Stack:** Next.js 14 · Express · Socket.IO · SQLite · TypeScript · Tailwind CSS

---

## Desktop App (recommended)

No Docker or Node.js required. Downloads and runs as a native app.

```bash
bash scripts/build-electron.sh
cd electron && npx electron dist/main.js    # Test locally (dev mode)
cd electron && npm run dist:mac             # → dist-electron/ScrumPoker-*.dmg
cd electron && npm run dist:win             # → dist-electron/ScrumPoker-*.exe
cd electron && npm run dist:linux           # → dist-electron/ScrumPoker-*.AppImage
```

On first launch you'll be prompted for a free [ngrok auth token](https://dashboard.ngrok.com/get-started/your-authtoken). The app then starts everything and shows a shareable public URL in the system tray.

---

## Docker

Requires Docker, Docker Compose, and a free [ngrok](https://dashboard.ngrok.com/get-started/your-authtoken) account.

```bash
cp .env.example .env
# fill in NGROK_AUTHTOKEN, JWT_SECRET, ENCRYPTION_KEY
docker compose up --build
```

| URL                   | Description                       |
| --------------------- | --------------------------------- |
| http://localhost      | App (nginx → frontend + API)      |
| http://localhost:4040 | ngrok inspector to get public url |

---

## Local (no Docker)

```bash
# terminal 1 — backend
cd backend && npm install && npm run dev     # http://localhost:4000

# terminal 2 — frontend
cd frontend && npm install && npm run dev    # http://localhost:3000
```

Copy `.env.example` to `.env` in `backend/` and set `JWT_SECRET` and `FRONTEND_URL=http://localhost:3000`.

---

## Environment Variables

| Variable          | Description                                        |
| ----------------- | -------------------------------------------------- |
| `JWT_SECRET`  | Secret for session cookie signing                  |
| `FRONTEND_URL`    | CORS origin — comma-separated for multiple origins |
| `ENCRYPTION_KEY`  | AES-256-GCM key for encrypted PAT storage          |
| `NGROK_AUTHTOKEN` | ngrok token (Docker only; desktop app prompts GUI) |
| `PORT`            | Backend port (default `4000`)                      |
| `DB_PATH`         | SQLite file path (default `data/scrum-poker.db`)   |
