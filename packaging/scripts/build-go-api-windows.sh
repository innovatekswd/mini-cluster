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

# ── Compile Windows binary ────────────────────────────────────────────────────
BINARY="$BUILD_DIR/minicluster-api.exe"
echo "▸ Compiling  GOOS=windows GOARCH=amd64 ..."
cd "$API_DIR"
CGO_ENABLED=0 GOOS=windows GOARCH=amd64 \
    go build -ldflags "$LDFLAGS" -o "$BINARY" ./cmd/server
echo "  ✓ $(du -sh "$BINARY" | cut -f1)  →  $BINARY"

# ── Stage directory ───────────────────────────────────────────────────────────
STAGE_NAME="minicluster-api-${VERSION}-windows-amd64"
STAGE="$BUILD_DIR/$STAGE_NAME"
rm -rf "$STAGE"
mkdir -p "$STAGE"

cp "$BINARY"                   "$STAGE/minicluster-api.exe"
cp "$WIN_ASSETS/install.ps1"   "$STAGE/install.ps1"
cp "$WIN_ASSETS/config.yaml"   "$STAGE/config.yaml"

cat > "$STAGE/README.txt" << EOF
MiniCluster API ${VERSION} — Windows x64
==========================================

Quick start (no install):
  .\minicluster-api.exe

  The server reads config.yaml from the same directory.
  Open http://localhost:5000 in your browser.

Install as a Windows Service (requires Administrator):
  Right-click PowerShell → "Run as Administrator"
  cd <this directory>
  .\install.ps1

  This will:
  - Copy minicluster-api.exe to %ProgramFiles%\MiniCluster
  - Register it as a Windows Service (auto-start)
  - Create data directory at %ProgramData%\MiniCluster
  - Add the install directory to the system PATH

  To uninstall:
  .\install.ps1 -Uninstall

Environment variable overrides (prefix MINICLUSTER_):
  \$env:MINICLUSTER_PORT = "8080"; .\minicluster-api.exe
  \$env:MINICLUSTER_DATA_DIR = "C:\mc-data"; .\minicluster-api.exe

Default URL: http://localhost:5000
EOF

# ── Create ZIP ────────────────────────────────────────────────────────────────
ZIP="$BUILD_DIR/${STAGE_NAME}.zip"
echo "▸ Creating ZIP archive ..."
cd "$BUILD_DIR"
zip -r "$ZIP" "$STAGE_NAME" >/dev/null
rm -rf "$STAGE"

echo "  ✓ ZIP: $ZIP  ($(du -sh "$ZIP" | cut -f1))"
rm -f "$BINARY"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Build complete — v${VERSION}"
echo ""
echo "  $ZIP"
echo "═══════════════════════════════════════════════════"
