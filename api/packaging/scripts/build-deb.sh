#!/bin/bash
set -e

# MiniCluster Full Build Script (Build + Package)
# This script builds from source AND packages into .deb
# For packaging prebuilt binaries only, use: ./packaging/scripts/package-deb.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGING_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_DIR="$(dirname "$PACKAGING_DIR")"
CLI_DIR="$(dirname "$PROJECT_DIR")/minicluster-cli"

VERSION="${1:-1.0.0}"

cd "$PROJECT_DIR"

echo "=== Step 1: Building API ==="
mkdir -p ./build
dotnet publish ControlCenter.Api/Innovatek.ControlCenter.Api.csproj \
    -c Release \
    -o ./build/publish \
    /p:UseAppHost=false \
    --self-contained false

echo ""
echo "=== Step 2: Building UI ==="
if [ -d "../minicluster-ui" ]; then
    cd ../minicluster-ui
    npm ci
    npm run build
    cd "$PROJECT_DIR"
    UI_DIR="../minicluster-ui/build/client"
else
    echo "UI not found, skipping..."
    UI_DIR=""
fi

echo ""
echo "=== Step 3: Building CLI ==="
CLI_BIN=""
if [ -d "$CLI_DIR" ]; then
    cd "$CLI_DIR"
    echo "Building MiniCluster CLI (mc)..."
    # Build for current platform (linux/amd64 for packaging)
    GOOS=linux GOARCH=amd64 go build -ldflags "-s -w \
        -X github.com/innovatek/minicluster-cli/internal/version.Version=$VERSION \
        -X github.com/innovatek/minicluster-cli/internal/version.GitCommit=$(git rev-parse --short HEAD 2>/dev/null || echo unknown) \
        -X github.com/innovatek/minicluster-cli/internal/version.BuildTime=$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
        -o build/mc ./cmd/mc
    CLI_BIN="$CLI_DIR/build/mc"
    cd "$PROJECT_DIR"
    echo "CLI built: $CLI_BIN"
else
    echo "CLI not found at $CLI_DIR, skipping..."
fi

echo ""
echo "=== Step 4: Packaging ==="
"$SCRIPT_DIR/package-deb.sh" "$VERSION" ./build/publish "$UI_DIR" "$CLI_BIN"

echo ""
echo "Build complete!"
