#Requires -Version 5.1
# build-electron.ps1 — Full build pipeline for the Electron desktop app.
# Run from the repository root: pwsh scripts/build-electron.ps1
$ErrorActionPreference = "Stop"

$ROOT     = (Resolve-Path "$PSScriptRoot\..").Path
$BACKEND  = "$ROOT\backend"
$FRONTEND = "$ROOT\frontend"
$ELECTRON = "$ROOT\electron"

Write-Host ""
Write-Host "╔══════════════════════════════════════════════╗"
Write-Host "║     Scrum Poker — Electron Build Pipeline    ║"
Write-Host "╚══════════════════════════════════════════════╝"
Write-Host ""

# ── 1. Backend TypeScript build ───────────────────────────────────────────────
Write-Host "▶ [1/6] Building backend TypeScript…"
Set-Location $BACKEND
npm install
npm run build
Write-Host "  ✓ backend/dist/ ready"
Write-Host ""

# ── 2. Backend production dependencies ───────────────────────────────────────
Write-Host "▶ [2/6] Installing backend production dependencies…"
npm install --omit=dev --ignore-scripts
Write-Host "  ✓ backend/node_modules/ trimmed to production"
Write-Host ""

# ── 3. Frontend Next.js standalone build ─────────────────────────────────────
Write-Host "▶ [3/6] Building Next.js frontend (standalone, empty NEXT_PUBLIC_BACKEND_URL)…"
Set-Location $FRONTEND

$env:NEXT_PUBLIC_BACKEND_URL = ""
$env:BACKEND_URL              = "http://127.0.0.1:4000"
npm run build
Remove-Item Env:\NEXT_PUBLIC_BACKEND_URL -ErrorAction SilentlyContinue
Remove-Item Env:\BACKEND_URL             -ErrorAction SilentlyContinue

Write-Host "  ✓ frontend/.next/standalone/ ready"

Write-Host "  → Copying public/ and .next/static/ into standalone dir…"
if (Test-Path "$FRONTEND\public") {
    Copy-Item -Recurse -Force "$FRONTEND\public" "$FRONTEND\.next\standalone\public"
}
New-Item -ItemType Directory -Force -Path "$FRONTEND\.next\standalone\.next" | Out-Null
Copy-Item -Recurse -Force "$FRONTEND\.next\static" "$FRONTEND\.next\standalone\.next\static"
Write-Host "  ✓ Static assets copied"
Write-Host ""

# ── 4. Electron npm install ───────────────────────────────────────────────────
Write-Host "▶ [4/6] Installing Electron dependencies…"
Set-Location $ELECTRON
npm install
Write-Host "  ✓ electron/node_modules/ ready"
Write-Host ""

# ── 5. Rebuild native modules for Electron's Node.js ABI ─────────────────────
Write-Host "▶ [5/6] Rebuilding native modules (sqlite3, better-sqlite3) for Electron…"
$ELECTRON_VER = node -e "console.log(require('$($ELECTRON.Replace('\','/'))/node_modules/electron/package.json').version)"
Write-Host "  → Electron version: $ELECTRON_VER"

npx --prefix "$ELECTRON" @electron/rebuild `
    --version "$ELECTRON_VER" `
    --module-dir "$BACKEND" `
    --which-module "sqlite3,better-sqlite3"

Write-Host "  ✓ Native modules rebuilt"
Write-Host ""

# ── 6. Electron TypeScript build ─────────────────────────────────────────────
Write-Host "▶ [6/6] Building Electron TypeScript…"
Set-Location $ELECTRON
npm run build
Write-Host "  ✓ electron/dist/ ready"
Write-Host ""

Write-Host "╔══════════════════════════════════════════════╗"
Write-Host "║            Build complete!                   ║"
Write-Host "╚══════════════════════════════════════════════╝"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  Dev test:   cd electron; npx electron dist/main.js"
Write-Host "  Package:    cd electron; npm run dist:mac"
Write-Host "              cd electron; npm run dist:win"
Write-Host "              cd electron; npm run dist:linux"
Write-Host ""
