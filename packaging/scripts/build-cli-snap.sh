#!/bin/bash
set -e

# Build MiniCluster CLI Snap Package

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR)")"
BUILD_DIR="$PROJECT_ROOT/build/cli-snap"
VERSION="1.0.16"

echo "Building MiniCluster CLI Snap v${VERSION}..."

# Clean build directory
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Copy snap configuration
echo "Copying snap configuration..."
cp -r "$PROJECT_ROOT/packaging/snap-cli"/* "$BUILD_DIR/"
cp -r "$PROJECT_ROOT/cli" "$BUILD_DIR/"

# Build CLI binary
echo "Building CLI binary..."
cd "$PROJECT_ROOT/cli"
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w -X 'main.Version=${VERSION}' -X 'main.BuildTime=$(date -u +%Y-%m-%dT%H:%M:%SZ)' -X 'main.GitCommit=$(git rev-parse --short HEAD 2>/dev/null || echo unknown)'" -o build/mc ./cmd/mc

# Build snap
echo "Building snap package..."
cd "$BUILD_DIR"
snapcraft --destructive-mode

# Move snap to final location
echo "Moving snap to build directory..."
mv "$BUILD_DIR"/*.snap "$PROJECT_ROOT/build/" 2>/dev/null || true

echo ""
echo "✓ Snap package built successfully!"
SNAP_FILE=$(ls "$PROJECT_ROOT/build"/minicluster-cli_*.snap 2>/dev/null | head -1)
if [ -n "$SNAP_FILE" ]; then
    echo "Package: $SNAP_FILE"
    ls -lh "$SNAP_FILE"
fi
