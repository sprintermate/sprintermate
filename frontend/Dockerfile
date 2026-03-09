# ─── Dependencies stage ───────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package*.json ./
RUN npm install

# ─── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_BACKEND_URL is intentionally empty so the browser uses the
# same origin (nginx), which then proxies /api and /socket.io to the backend.
ARG NEXT_PUBLIC_BACKEND_URL=""
ENV NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL}

ARG NEXT_PUBLIC_IS_PRODUCTION_AI=""
ENV NEXT_PUBLIC_IS_PRODUCTION_AI=${NEXT_PUBLIC_IS_PRODUCTION_AI}

RUN npm run build && mkdir -p /app/public

# ─── Runtime stage ────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=development
ENV PORT=3000

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# Copy standalone output produced by `output: 'standalone'` in next.config.mjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
