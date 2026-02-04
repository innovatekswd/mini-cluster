#!/bin/bash
set -e

# MiniCluster Full Build Script for Snap (Build + Package)
# This script builds from source AND packages into .snap
# For packaging prebuilt binaries only, use: ./packaging/scripts/package-snap.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGING_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_DIR="$(dirname "$PACKAGING_DIR")"

cd "$PROJECT_DIR"

echo "=== Step 1: Building API ==="
mkdir -p ./build
dotnet publish ControlCenter.Api/Innovatek.ControlCenter.Api.csproj \
    -c Release \
    -o ./build/publish \
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
echo "=== Step 3: Packaging Snap ==="
"$SCRIPT_DIR/package-snap.sh" ./build/publish "$UI_DIR"

echo ""
echo "Build complete!"
echo ""
echo "To install locally:"
echo "  sudo snap install minicluster_*.snap --dangerous"
echo ""
echo "To publish to Snap Store:"
echo "  snapcraft login"
echo "  snapcraft upload minicluster_*.snap --release=stable"
