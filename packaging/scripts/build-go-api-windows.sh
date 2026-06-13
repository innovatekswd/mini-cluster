#!/usr/bin/env bash
set -euo pipefail
#
# Build and package the MiniCluster Go API server for Windows.
#
# Produces:
#   build/minicluster-api-<version>-windows-amd64.zip   — ZIP with .exe + installer
#
# Usage:
#   ./packaging/scripts/build-go-api-windows.sh [version]
#
#   version  defaults to git describe or "0.0.0"
#
# Requirements:
#   - Go toolchain (cross-compilation; no Windows host needed)
#   - zip

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
API_DIR="$ROOT_DIR/api-go"
BUILD_DIR="$ROOT_DIR/build"
WIN_ASSETS="$ROOT_DIR/packaging/windows-go"

VERSION="${1:-$(git -C "$ROOT_DIR" describe --tags --always --dirty 2>/dev/null || echo "0.0.0")}"
VERSION="${VERSION#v}"
if [[ ! "$VERSION" =~ ^[0-9] ]]; then
    VERSION="0.0.0+${VERSION}"
fi

GIT_COMMIT="$(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)"
BUILD_TIME="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
LDFLAGS="-s -w \
  -X main.Version=${VERSION} \
  -X main.GitCommit=${GIT_COMMIT} \
  -X main.BuildTime=${BUILD_TIME}"

echo "╔══════════════════════════════════════════════════╗"
echo "║  MiniCluster Go API — Windows Build              ║"
echo "╠══════════════════════════════════════════════════╣"
printf "║  Version  : %-36s ║\n" "$VERSION"
printf "║  Commit   : %-36s ║\n" "$GIT_COMMIT"
echo "╚══════════════════════════════════════════════════╝"
echo ""

mkdir -p "$BUILD_DIR"

# ── Build the React UI and embed it ───────────────────────────────────
STATIC_DIR="$API_DIR/cmd/server/static"
echo "▸ Building UI ..."
cd "$ROOT_DIR/ui"
[ ! -d node_modules ] && npm ci --silent
npm run build --silent
rm -rf "$STATIC_DIR"
mkdir -p "$STATIC_DIR"
cp -r "$ROOT_DIR/ui/build/client/"* "$STATIC_DIR/"
echo "  ✓ UI embedded into $STATIC_DIR"

# ── Compile Windows binaries ──────────────────────────────────────────────────
BINARY="$BUILD_DIR/minicluster-api.exe"
CLI_BINARY="$BUILD_DIR/mc.exe"

echo "▸ Compiling API  GOOS=windows GOARCH=amd64 ..."
cd "$API_DIR"
CGO_ENABLED=0 GOOS=windows GOARCH=amd64 \
    go build -ldflags "$LDFLAGS" -o "$BINARY" ./cmd/server
echo "  ✓ $(du -sh "$BINARY" | cut -f1)  →  $BINARY"

CLI_LDFLAGS="-s -w \
  -X github.com/innovatek/minicluster-cli/internal/version.Version=${VERSION} \
  -X github.com/innovatek/minicluster-cli/internal/version.GitCommit=${GIT_COMMIT} \
  -X github.com/innovatek/minicluster-cli/internal/version.BuildTime=${BUILD_TIME}"

echo "▸ Compiling CLI  GOOS=windows GOARCH=amd64 ..."
cd "$ROOT_DIR/cli"
CGO_ENABLED=0 GOOS=windows GOARCH=amd64 \
    go build -ldflags "$CLI_LDFLAGS" -o "$CLI_BINARY" ./cmd/mc
echo "  ✓ $(du -sh "$CLI_BINARY" | cut -f1)  →  $CLI_BINARY"

# ── Stage directory ───────────────────────────────────────────────────────────
STAGE_NAME="minicluster-${VERSION}-windows-amd64"
STAGE="$BUILD_DIR/$STAGE_NAME"
rm -rf "$STAGE"
mkdir -p "$STAGE"

cp "$BINARY"                   "$STAGE/minicluster-api.exe"
cp "$CLI_BINARY"               "$STAGE/mc.exe"
cp "$WIN_ASSETS/install.ps1"   "$STAGE/install.ps1"
cp "$WIN_ASSETS/config.yaml"   "$STAGE/config.yaml"

cat > "$STAGE/README.txt" << EOF
MiniCluster ${VERSION} — Windows x64
==========================================

Binaries:
  minicluster-api.exe   — API server (web UI embedded)
  mc.exe                — CLI client

Quick start (no install):
  .\minicluster-api.exe

  The server reads config.yaml from the same directory.
  Open http://localhost:2016 in your browser.

  Use the CLI:
  .\mc.exe --help

Install as a Windows Service (requires Administrator):
  Right-click PowerShell → "Run as Administrator"
  cd <this directory>
  .\install.ps1

  This will:
  - Copy minicluster-api.exe and mc.exe to %ProgramFiles%\MiniCluster
  - Register the API as a Windows Service (auto-start)
  - Create data directory at %ProgramData%\MiniCluster
  - Add the install directory to the system PATH (mc available everywhere)

  To uninstall:
  .\install.ps1 -Uninstall

Environment variable overrides (prefix MINICLUSTER_):
  \$env:MINICLUSTER_PORT = "8080"; .\minicluster-api.exe
  \$env:MINICLUSTER_DATA_DIR = "C:\mc-data"; .\minicluster-api.exe

Default URL: http://localhost:2016
EOF

# ── Create ZIP ────────────────────────────────────────────────────────────────
ZIP="$BUILD_DIR/${STAGE_NAME}.zip"
echo "▸ Creating ZIP archive ..."
cd "$BUILD_DIR"
zip -r "$ZIP" "$STAGE_NAME" >/dev/null
rm -rf "$STAGE"

echo "  ✓ ZIP: $ZIP  ($(du -sh "$ZIP" | cut -f1))"
rm -f "$BINARY" "$CLI_BINARY"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Build complete — v${VERSION}"
echo ""
echo "  $ZIP"
echo "═══════════════════════════════════════════════════"
