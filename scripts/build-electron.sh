#!/usr/bin/env bash
# build-electron.sh — Full build pipeline for the Electron desktop app.
# Run from the repository root: bash scripts/build-electron.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
ELECTRON="$ROOT/electron"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   Sprintermate AI — Electron Build Pipeline  ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── 1. Backend TypeScript build ───────────────────────────────────────────────
echo "▶ [1/6] Building backend TypeScript…"
cd "$BACKEND"
# Ensure all deps (including devDeps like TypeScript) are present before building.
# Step 2 will prune back to production-only after the build.
npm install
npm run build
echo "  ✓ backend/dist/ ready"
echo ""

# ── 2. Backend production dependencies ───────────────────────────────────────
echo "▶ [2/6] Installing backend production dependencies…"
# This prunes devDependencies from node_modules so the packaged app is smaller.
# Re-run 'npm install' in backend/ to restore dev deps for local development.
npm install --omit=dev --ignore-scripts
echo "  ✓ backend/node_modules/ trimmed to production"
echo ""

# ── 3. Frontend Next.js standalone build ─────────────────────────────────────
echo "▶ [3/6] Building Next.js frontend (standalone, empty NEXT_PUBLIC_BACKEND_URL)…"
cd "$FRONTEND"
NEXT_PUBLIC_BACKEND_URL="" \
BACKEND_URL="http://127.0.0.1:4000" \
npm run build
echo "  ✓ frontend/.next/standalone/ ready"

# Copy static assets that Next.js standalone does NOT auto-include
echo "  → Copying public/ and .next/static/ into standalone dir…"
cp -r "$FRONTEND/public" "$FRONTEND/.next/standalone/public" 2>/dev/null || true
mkdir -p "$FRONTEND/.next/standalone/.next"
cp -r "$FRONTEND/.next/static" "$FRONTEND/.next/standalone/.next/static"
echo "  ✓ Static assets copied"
echo ""

# ── 4. Electron npm install ───────────────────────────────────────────────────
echo "▶ [4/6] Installing Electron dependencies…"
cd "$ELECTRON"
npm install
echo "  ✓ electron/node_modules/ ready"
echo ""

# ── 5. Rebuild native modules for Electron's Node.js ABI ─────────────────────
echo "▶ [5/6] Rebuilding native modules (sqlite3, better-sqlite3) for Electron…"
# Determine the exact Electron version installed
ELECTRON_VER=$(node -e "console.log(require('$ELECTRON/node_modules/electron/package.json').version)")
echo "  → Electron version: $ELECTRON_VER"

# Rebuild native modules inside backend/node_modules against Electron's Node.js.
# --module-dir must point to the project dir (where package.json lives), not node_modules/.
npx --prefix "$ELECTRON" @electron/rebuild \
  --version "$ELECTRON_VER" \
  --module-dir "$BACKEND" \
  --which-module "sqlite3,better-sqlite3"

echo "  ✓ Native modules rebuilt"
echo ""

# ── 6. Electron TypeScript build ─────────────────────────────────────────────
echo "▶ [6/6] Building Electron TypeScript…"
cd "$ELECTRON"
npm run build
echo "  ✓ electron/dist/ ready"
echo ""

echo "╔══════════════════════════════════════════════╗"
echo "║              Build complete! 🎉              ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "  Dev test:   cd electron && npx electron dist/main.js"
echo "  Package:    cd electron && npm run dist:mac"
echo "              cd electron && npm run dist:win"
echo "              cd electron && npm run dist:linux"
echo ""
