# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Backend (Express + TypeScript)
```bash
cd backend
npm run dev      # ts-node-dev with hot reload (port 4000)
npm run build    # tsc compilation → dist/
npm start        # run compiled dist/index.js
```

### Frontend (Next.js 14)
```bash
cd frontend
npm run dev      # Next.js dev server (port 3000)
npm run build    # production build
npm run lint     # ESLint
```

### Electron (Desktop App)
```bash
# Full build (backend + frontend + Electron packaging)
./scripts/build-electron.sh        # macOS/Linux
./scripts/build-electron.ps1       # Windows

cd electron
npm run build    # compile electron/src → electron/dist
npm run dist     # package for current platform
npm run dist:win # Windows NSIS installer
```

### Docker (full stack)
```bash
docker-compose up --build
```

## Architecture Overview

### Stack
- **Backend**: Express + TypeScript + Socket.IO + Sequelize (SQLite) on port 4000
- **Frontend**: Next.js 14 App Router + React 18 + Tailwind CSS + next-intl (en/tr)
- **Desktop**: Electron 31 wrapper that spawns backend & frontend as child processes + ngrok tunneling
- **Auth**: Passport.js local strategy with express-session (7-day cookies)

### Request Flow
In Docker/production: Browser → nginx (port 80) → backend (:4000) or frontend (:3000)
In dev: Frontend Next.js rewrites `/api/*` and `/socket.io/*` to `http://localhost:4000`
In Electron: `electron/src/proxy.ts` routes /api + /socket.io to backend

### Backend Structure (`backend/src/`)
- `index.ts` → initializes schema, creates app, starts server
- `app.ts` → Express setup: CORS, sessions, Passport, route mounts
- `db/schema.ts` → all Sequelize model associations in one place
- `db/models/` → User, Project, Sprint, Room, ReferenceScore, UserAISettings
- `routes/` → auth, projects, rooms, ai
- `socket/index.ts` → all real-time voting logic (in-memory room state)
- `services/aiService.ts` → AI estimation across providers
- `services/azDevops.ts` → Azure DevOps REST API + PAT encryption
- `utils/crypto.ts` → AES-256-GCM encryption for stored secrets
- `middleware/requireAuth.ts` → session authentication guard

### Frontend Structure (`frontend/src/`)
- `app/[locale]/` → App Router pages (server components fetch data with cookie forwarding)
- `components/` → client components use `'use client'` + useState/useCallback
- `i18n/routing.ts` → locales: en, tr; defaultLocale: en
- `middleware.ts` → next-intl routing middleware

Key components:
- `RoomClient.tsx` → real-time voting session (Socket.IO client)
- `WorkItemDetail.tsx` → current work item UI + AI estimate button (moderator-only)
- `DashboardClient.tsx` → project/room management
- `AISettingsModal.tsx` → per-user AI provider config

## Key Patterns

### Database
- Always use `model.get({ plain: true })` when accessing fields from Sequelize query results
- Associations are defined in `db/schema.ts`, not in individual model files
- ADO PAT is stored AES-256-GCM encrypted; use `utils/crypto.ts` to encrypt/decrypt

### Frontend Conventions
- Server pages fetch data via `fetch()` with `credentials: 'include'` and cookie forwarding
- `NEXT_PUBLIC_BACKEND_URL` env var for frontend→backend URL
- Modal pattern: `fixed inset-0 z-50` with `bg-black/70 backdrop-blur-sm`
- Colors: slate-950 bg, indigo primary, violet for AI features, emerald for success

### Socket.IO Real-time
- Room state is in-memory in `socket/index.ts`
- Moderator sees AI estimate immediately on `vote:reveal`; other participants see it only after the reveal broadcast (`vote:revealed`)
- ADO team param: use `project.team ?? project.name`

### AI Integration
- Settings stored per-user in `user_ai_settings` table
- Providers: claude CLI, copilot CLI (`gh`), codex CLI, gemini API, chatgpt API
- API: `GET/PUT /api/ai/settings`, `POST /api/ai/test`, `POST /api/ai/estimate`

## Environment Variables

Required (see `.env.example`):
- `SESSION_SECRET` — express-session signing key
- `ENCRYPTION_KEY` — AES-256-GCM key for PAT/API key encryption
- `FRONTEND_URL` — comma-separated allowed CORS origins
- `NEXT_PUBLIC_BACKEND_URL` — backend base URL for frontend fetch calls
- `NGROK_AUTHTOKEN` — required for Electron's public URL tunneling
