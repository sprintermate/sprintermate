# Scrum Poker

Real-time planning poker with AI-powered story point estimation, backed by Azure DevOps sprint data.

---

## Features

- **Azure DevOps integration** — paste a sprint board URL; organization, project, team, and sprint are parsed automatically
- **OAuth 2.0 & PAT authentication** — sign in with Azure DevOps or a Personal Access Token; tokens are stored server-side only
- **Real-time rooms** — moderator creates a 6-character room code; participants join as guests via the code or QR
- **AI estimation engine** — analyzes previous 3 sprints plus onboarding reference scores to suggest Fibonacci story points with a confidence level and similar-item citations
- **Live voting** — Fibonacci card deck (1–55); moderator reveals votes, confirms final score, resets for the next item
- **i18n** — English and Turkish (next-intl)

---

## Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Frontend  | Next.js 14, TypeScript, Tailwind CSS |
| Backend   | Express, Socket.IO, TypeScript       |
| Database  | SQLite (via Sequelize / better-sqlite3) |
| Real-time | Socket.IO (WebSocket)               |
| AI        | GitHub Copilot SDK (abstracted interface) |
| Data      | Azure DevOps REST API v7.0          |

---

## Project Structure

```
scrum-poker/
├── backend/          # Express + Socket.IO API (port 4000)
├── frontend/         # Next.js 14 app (port 3000)
├── nginx/            # Reverse-proxy config
├── docker-compose.yml
└── requirements/     # Detailed feature specs
```

---

## Running Locally (Docker)

### Prerequisites

- Docker & Docker Compose
- An [ngrok account](https://dashboard.ngrok.com/get-started/your-authtoken) (free tier is fine)

### 1 — Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
NGROK_AUTHTOKEN=<your ngrok token>
SESSION_SECRET=<long random string>
FRONTEND_URL=http://localhost        # or your ngrok URL for public access
```

### 2 — Build & start

```bash
docker compose up --build
```

| Service        | URL                          | Notes            |
|----------------|------------------------------|------------------|
| App (nginx)    | http://localhost             | frontend + API   |
| ngrok inspector| http://localhost:4040        | public tunnel UI |
| Backend direct | http://localhost:4000        | optional / debug |

The public ngrok URL is printed in the ngrok inspector or via:

```bash
docker compose logs ngrok | grep url
```

### Traffic routing (nginx)

```
Browser → ngrok (https) → nginx :80
                               ├── /api/*       → backend:4000
                               ├── /socket.io/* → backend:4000
                               └── /*           → frontend:3000
```

---

## Running Locally (without Docker)

```bash
# Backend
cd backend
npm install
cp .env.example .env   # set SESSION_SECRET, FRONTEND_URL
npm run dev            # http://localhost:4000

# Frontend (new terminal)
cd frontend
npm install
npm run dev            # http://localhost:3000
```

---

## Azure DevOps OAuth Setup

1. Register an app at <https://app.vsaex.visualstudio.com/app/register>
2. Set callback URL to `{APP_BASE_URL}/api/auth/ado/callback`
3. Request scopes: `vso.work`, `vso.work_write`, `vso.project`, `vso.profile`
4. Add `ADO_OAUTH_CLIENT_ID` and `ADO_OAUTH_CLIENT_SECRET` to your `.env`

---

## Environment Variables

| Variable                  | Required | Description                                      |
|---------------------------|----------|--------------------------------------------------|
| `SESSION_SECRET`          | ✅        | Secret for express-session cookie signing         |
| `FRONTEND_URL`            | ✅        | Allowed CORS origin (e.g. `http://localhost`)     |
| `NGROK_AUTHTOKEN`         | ✅        | ngrok auth token for public tunnel                |
| `ADO_OAUTH_CLIENT_ID`     | OAuth    | Azure DevOps OAuth app ID                         |
| `ADO_OAUTH_CLIENT_SECRET` | OAuth    | Azure DevOps OAuth client secret                  |
| `PORT`                    | –        | Backend port (default: `4000`)                    |
