#!/bin/bash
set -e

# Build MiniCluster CLI Debian Package

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
BUILD_DIR="$PROJECT_ROOT/build/cli-deb"
VERSION="1.0.11"

echo "Building MiniCluster CLI v${VERSION}..."

# Clean build directory
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/minicluster-cli_${VERSION}"

# Copy project files
echo "Copying source files..."
cp -r "$PROJECT_ROOT/cli" "$BUILD_DIR/minicluster-cli_${VERSION}/"
cp -r "$PROJECT_ROOT/packaging/debian-cli" "$BUILD_DIR/minicluster-cli_${VERSION}/debian"

# Build CLI binary
echo "Building CLI binary..."
cd "$PROJECT_ROOT/cli"
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w -X 'main.Version=${VERSION}' -X 'main.BuildTime=$(date -u +%Y-%m-%dT%H:%M:%SZ)' -X 'main.GitCommit=$(git rev-parse --short HEAD 2>/dev/null || echo unknown)'" -o build/mc ./cmd/mc

# Generate shell completions
echo "Generating shell completions..."
mkdir -p "$PROJECT_ROOT/cli/completions/bash"
mkdir -p "$PROJECT_ROOT/cli/completions/zsh"
mkdir -p "$PROJECT_ROOT/cli/completions/fish"
"$PROJECT_ROOT/cli/build/mc" completion bash > "$PROJECT_ROOT/cli/completions/bash/mc.bash" 2>/dev/null || true
"$PROJECT_ROOT/cli/build/mc" completion zsh > "$PROJECT_ROOT/cli/completions/zsh/_mc" 2>/dev/null || true
"$PROJECT_ROOT/cli/build/mc" completion fish > "$PROJECT_ROOT/cli/completions/fish/mc.fish" 2>/dev/null || true

# Build package
echo "Building Debian package..."
cd "$BUILD_DIR/minicluster-cli_${VERSION}"
dpkg-buildpackage -us -uc -b

# Move package to final location
echo "Moving package to build directory..."
mv "$BUILD_DIR"/minicluster-cli_*.deb "$PROJECT_ROOT/build/"
mv "$BUILD_DIR"/minicluster-cli_*.changes "$PROJECT_ROOT/build/" 2>/dev/null || true
mv "$BUILD_DIR"/minicluster-cli_*.buildinfo "$PROJECT_ROOT/build/" 2>/dev/null || true

echo ""
echo "✓ Debian package built successfully!"
echo "Package: $PROJECT_ROOT/build/minicluster-cli_${VERSION}_amd64.deb"
ls -lh "$PROJECT_ROOT/build/minicluster-cli_${VERSION}_amd64.deb"
