# Copilot Instructions

Real-time planning poker app with AI-powered story point estimation and Azure DevOps integration.

**Stack:** Express + TypeScript + Socket.IO + Sequelize (SQLite) · Next.js 14 App Router · Electron 31 · Tailwind CSS · next-intl (en/tr)

## Development Commands

### Backend
```bash
cd backend
npm run dev      # ts-node-dev with hot reload → http://localhost:4000
npm run build    # tsc → dist/
npm start        # run compiled dist/index.js
```

### Frontend
```bash
cd frontend
npm run dev      # Next.js dev server → http://localhost:3000
npm run build
npm run lint     # ESLint
```

### Electron (Desktop)
```bash
# Full build (backend + frontend + packaging)
./scripts/build-electron.sh   # macOS/Linux
./scripts/build-electron.ps1  # Windows

cd electron
npm run build        # compile src/ → dist/
npm run dist:win     # Windows NSIS installer
npm run dist:mac
npm run dist:linux
```

### Docker (full stack)
```bash
docker-compose up --build     # nginx on :80, ngrok inspector on :4040
```

## Architecture

### Request Flow
- **Docker/production:** Browser → nginx (:80) → backend (:4000) or frontend (:3000)
- **Dev:** Frontend Next.js rewrites `/api/*` and `/socket.io/*` → `http://localhost:4000`
- **Electron:** `electron/src/proxy.ts` routes `/api` + `/socket.io` to the backend child process

### Backend (`backend/src/`)
- `index.ts` — initializes schema, creates app, starts server
- `app.ts` — Express setup: CORS, sessions, Passport, route mounts
- `db/schema.ts` — **all Sequelize model associations defined here** (not in model files)
- `db/models/` — User, Project, Sprint, Room, ReferenceScore, UserAISettings
- `routes/` — auth, projects, rooms, ai
- `socket/index.ts` — all real-time voting logic (in-memory room state)
- `services/aiService.ts` — AI estimation across providers
- `services/azDevops.ts` — Azure DevOps REST API + PAT encryption
- `utils/crypto.ts` — AES-256-GCM encryption for stored secrets
- `middleware/requireAuth.ts` — session authentication guard

### Frontend (`frontend/src/`)
- `app/[locale]/` — App Router pages; server components fetch data with cookie forwarding
- `components/` — client components use `'use client'` + useState/useCallback
- `i18n/routing.ts` — locales: `en`, `tr`; defaultLocale: `en`
- `middleware.ts` — next-intl routing middleware

Key components: `RoomClient.tsx` (Socket.IO voting), `WorkItemDetail.tsx` (AI estimate, moderator-only), `DashboardClient.tsx` (project/room management), `AISettingsModal.tsx` (per-user AI provider config)

## Key Conventions

### Database
- Always use `model.get({ plain: true })` when accessing fields from Sequelize query results
- Define all model associations in `db/schema.ts`, not in individual model files
- ADO PAT is stored AES-256-GCM encrypted — use `utils/crypto.ts` to encrypt/decrypt

### Frontend
- Server pages fetch via `fetch()` with `credentials: 'include'` and cookie forwarding
- Use `NEXT_PUBLIC_BACKEND_URL` env var for frontend → backend URL
- Modal pattern: `fixed inset-0 z-50` overlay with `bg-black/70 backdrop-blur-sm`
- Color palette: `slate-950` background, `indigo` primary, `violet` for AI features, `emerald` for success

### Socket.IO
- Room state is held **in-memory** in `socket/index.ts` (not persisted to DB)
- Moderator receives AI estimate immediately on `vote:reveal`; other participants only after `vote:revealed` broadcast
- ADO team param: use `project.team ?? project.name`

### AI Integration
- Settings stored per-user in `user_ai_settings` table
- Providers: claude CLI, copilot CLI (`gh`), codex CLI, gemini API, chatgpt API
- Endpoints: `GET/PUT /api/ai/settings`, `POST /api/ai/test`, `POST /api/ai/estimate`

### Auth
- Passport.js local strategy with express-session (7-day cookies)
- Protect routes with `middleware/requireAuth.ts`

## Environment Variables

| Variable | Description |
|---|---|
| `JWT_SECRET` | express-session signing key |
| `ENCRYPTION_KEY` | AES-256-GCM key for PAT/API key encryption |
| `FRONTEND_URL` | Comma-separated allowed CORS origins |
| `NEXT_PUBLIC_BACKEND_URL` | Backend base URL for frontend fetch calls |
| `NGROK_AUTHTOKEN` | Required for Electron's public URL tunneling |
| `PORT` | Backend port (default `4000`) |
| `DB_PATH` | SQLite file path (default `data/sprintermate.db`) |

Copy `.env.example` to `.env` before running locally.
