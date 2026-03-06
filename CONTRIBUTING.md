# Contributing to Scrum Poker

Thank you for considering contributing! This document outlines how to set up your development environment and the process for submitting contributions.

## Development Setup

### Prerequisites
- Node.js 20+
- npm 10+
- Docker & Docker Compose (for integration testing)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/scrum-poker.git
   cd scrum-poker
   ```

2. **Set up the backend**
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env — fill in JWT_SECRET and ENCRYPTION_KEY
   npm install
   npm run dev   # starts on http://localhost:4000
   ```

3. **Set up the frontend** (new terminal)
   ```bash
   cd frontend
   cp .env.example .env.local
   npm install
   npm run dev   # starts on http://localhost:3000
   ```

4. **Full stack with Docker**
   ```bash
   cp .env.example .env
   # Edit .env — set JWT_SECRET and ENCRYPTION_KEY
   docker-compose up --build
   # App available at http://localhost
   ```

### Running with ngrok (for Electron / public sharing)
```bash
# Requires NGROK_AUTHTOKEN in your .env
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

## Code Standards

- **TypeScript** everywhere — no `any` types without justification
- **ESLint** — run `npm run lint` in `frontend/` before committing
- **Type checking** — run `npx tsc --noEmit` in `backend/` before committing
- **Commits** — use conventional commit messages: `feat:`, `fix:`, `docs:`, `chore:`

## Pull Request Process

1. Fork the repository and create a feature branch from `main`
2. Make your changes with clear, focused commits
3. Ensure `npm run lint` passes in `frontend/`
4. Ensure `npx tsc --noEmit` passes in `backend/`
5. Update documentation if you changed behavior or added features
6. Open a PR against `main` with a clear description of what and why

## Reporting Bugs

Please use [GitHub Issues](https://github.com/your-org/scrum-poker/issues). Include:
- Steps to reproduce
- Expected vs actual behavior
- Environment (OS, Node version, Docker version)

## Security Vulnerabilities

See [SECURITY.md](SECURITY.md) for how to responsibly report security issues.
