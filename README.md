# Scrum Poker

Real-time planning poker with AI-powered story point estimation and Azure DevOps integration.

**Stack:** Next.js 14 · Express · Socket.IO · SQLite · TypeScript · Tailwind CSS

---

## Docker (recommended)

Requires Docker, Docker Compose, and a free [ngrok](https://dashboard.ngrok.com/get-started/your-authtoken) account.

```bash
cp .env.example .env
# fill in NGROK_AUTHTOKEN, SESSION_SECRET, ENCRYPTION_KEY
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

Copy `.env.example` to `.env` in `backend/` and set `SESSION_SECRET` and `FRONTEND_URL=http://localhost:3000`.

---

## Environment Variables

| Variable          | Description                               |
| ----------------- | ----------------------------------------- |
| `SESSION_SECRET`  | Secret for session cookie signing         |
| `FRONTEND_URL`    | CORS origin (e.g. `http://localhost`)     |
| `ENCRYPTION_KEY`  | AES-256-GCM key for encrypted PAT storage |
| `NGROK_AUTHTOKEN` | ngrok token (Docker only)                 |
| `PORT`            | Backend port (default `4000`)             |
