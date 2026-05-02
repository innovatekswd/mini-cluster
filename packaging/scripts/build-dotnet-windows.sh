#!/usr/bin/env bash
set -euo pipefail

#
# Build MiniCluster .NET API Server for Windows (win-x64)
#
# Produces a self-contained single-file .exe packaged as a .zip with
# a PowerShell Windows Service installer.
#
# Usage:
#   ./packaging/scripts/build-dotnet-windows.sh [version]
#
# Examples:
#   ./packaging/scripts/build-dotnet-windows.sh          # version from git tag
#   ./packaging/scripts/build-dotnet-windows.sh 1.0.12   # explicit version
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
BUILD_DIR="$ROOT_DIR/build"
ASSETS_DIR="$ROOT_DIR/packaging/windows-dotnet"

RAW_VERSION="${1:-$(git -C "$ROOT_DIR" describe --tags --always 2>/dev/null || echo "dev")}"
# Normalize to a semver-compatible string for the ZIP/folder name
VERSION="$RAW_VERSION"
# Extract only the numeric semver part for dotnet publish (e.g. v1.0.12-3-gabcd -> 1.0.12)
DOTNET_VERSION=$(echo "$RAW_VERSION" | grep -oP '^\d+\.\d+\.\d+' || echo "1.0.0")

API_PROJECT="$ROOT_DIR/api/Innovatek.Parallel.MiniCluster.Api/Innovatek.Parallel.MiniCluster.Api.csproj"
STAGE="$BUILD_DIR/dotnet-win-stage"
PKG_DIR="$STAGE/minicluster-$VERSION-windows-x64"
ZIP_OUT="$BUILD_DIR/minicluster-$VERSION-windows-x64.zip"

echo "╔══════════════════════════════════════════════════╗"
echo "║  MiniCluster .NET API — Windows Build            ║"
echo "╠══════════════════════════════════════════════════╣"
printf "║  Version  : %-36s ║\n" "$VERSION"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── Step 1: Build the UI ─────────────────────────────────────
echo "▸ Building UI..."
UI_DIR="$ROOT_DIR/ui"
cd "$UI_DIR"
if [ ! -d "node_modules" ]; then
    echo "  Installing npm dependencies..."
    npm ci --silent
fi
npm run build --silent
echo "  ✓ UI built"

# ── Step 2: Copy UI into API wwwroot ─────────────────────────
echo "▸ Embedding UI into wwwroot..."
WWWROOT="$ROOT_DIR/api/Innovatek.Parallel.MiniCluster.Api/wwwroot"
rm -rf "$WWWROOT"
mkdir -p "$WWWROOT"
cp -r "$UI_DIR/build/client/"* "$WWWROOT/"
echo "  ✓ UI embedded"

# ── Step 3: dotnet publish (self-contained, single file) ─────
echo "▸ Publishing .NET win-x64 (self-contained)..."
DOTNET_STAGE="$BUILD_DIR/dotnet-win-publish"
rm -rf "$DOTNET_STAGE"
mkdir -p "$DOTNET_STAGE"

dotnet publish "$API_PROJECT" \
    -c Release \
    -r win-x64 \
    -o "$DOTNET_STAGE" \
    --self-contained true \
    /p:PublishSingleFile=true \
    /p:IncludeNativeLibrariesForSelfExtract=true \
    /p:EnableCompressionInSingleFile=true \
    /p:Version="$DOTNET_VERSION" \
    /p:DebugType=none \
    /p:DebugSymbols=false \
    2>&1 | tail -5

# Locate the .exe
EXE=$(find "$DOTNET_STAGE" -maxdepth 1 -name "*.exe" | head -1)
if [ -z "$EXE" ]; then
    echo "  ✗ Could not find .exe in $DOTNET_STAGE"
    ls "$DOTNET_STAGE"
    exit 1
fi

SIZE=$(du -sh "$EXE" | cut -f1)
echo "  ✓ ${SIZE}  →  $(basename "$EXE")"

# ── Step 4: Stage ZIP contents ───────────────────────────────
echo "▸ Staging package contents..."
rm -rf "$STAGE"
mkdir -p "$PKG_DIR"

# Binary — rename to minicluster.exe
cp "$EXE" "$PKG_DIR/minicluster.exe"

# wwwroot — NOT bundled inside the single-file exe; must ship alongside it
if [ -d "$DOTNET_STAGE/wwwroot" ]; then
    cp -r "$DOTNET_STAGE/wwwroot" "$PKG_DIR/wwwroot"
    echo "  ✓ wwwroot copied ($(du -sh "$PKG_DIR/wwwroot" | cut -f1))"
else
    echo "  ⚠  No wwwroot in publish output — UI will not be served"
fi

# PowerShell installer + default config
cp "$ASSETS_DIR/install.ps1"   "$PKG_DIR/install.ps1"
cp "$ASSETS_DIR/config.json"   "$PKG_DIR/config.json"

# README
cat > "$PKG_DIR/README.txt" << EOF
MiniCluster API Server for Windows — v${VERSION}
=================================================

Requirements:
  - Windows 10 / Server 2019 or later (x64)
  - No .NET runtime required (self-contained)

Quick Start (as Windows Service):
  1. Open PowerShell as Administrator
  2. cd to this folder
  3. Run:  .\\install.ps1

Manual run:
  .\\minicluster.exe

Service Management:
  Install:    .\\install.ps1
  Uninstall:  .\\install.ps1 -Uninstall

Default URL:  http://localhost:5147
Data dir:     C:\\ProgramData\\MiniCluster

Configuration:
  Edit config.json before running install.ps1, or place it at:
    C:\\ProgramData\\MiniCluster\\config.json

Documentation:
  https://github.com/innovatek/minicluster
EOF

echo "  ✓ Staged to $PKG_DIR"

# ── Step 5: Create ZIP ───────────────────────────────────────
echo "▸ Creating ZIP archive..."
rm -f "$ZIP_OUT"
cd "$STAGE"
zip -r "$ZIP_OUT" "$(basename "$PKG_DIR")" -x "*.DS_Store" > /dev/null
SIZE_ZIP=$(du -sh "$ZIP_OUT" | cut -f1)
echo "  ✓ ZIP: $ZIP_OUT  (${SIZE_ZIP})"

# Cleanup staging
rm -rf "$STAGE" "$DOTNET_STAGE"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Build complete — v${VERSION}"
echo ""
echo "  $ZIP_OUT"
echo "═══════════════════════════════════════════════════"
