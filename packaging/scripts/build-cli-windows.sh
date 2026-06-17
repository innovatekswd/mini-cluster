#!/bin/bash
set -e

# Build MiniCluster CLI for Windows

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
BUILD_DIR="$PROJECT_ROOT/build/cli-windows"
VERSION="1.0.16"

echo "Building MiniCluster CLI for Windows v${VERSION}..."

# Clean build directory
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/minicluster-cli-${VERSION}-windows-amd64"
mkdir -p "$BUILD_DIR/choco"

# Build Windows binary
echo "Building Windows binary (amd64)..."
cd "$PROJECT_ROOT/cli"
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build \
    -ldflags="-s -w -X 'main.Version=${VERSION}' -X 'main.BuildTime=$(date -u +%Y-%m-%dT%H:%M:%SZ)' -X 'main.GitCommit=$(git rev-parse --short HEAD 2>/dev/null || echo unknown)'" \
    -o "$BUILD_DIR/minicluster-cli-${VERSION}-windows-amd64/mc.exe" \
    ./cmd/mc

# Copy installer scripts
echo "Copying installer scripts..."
cp "$PROJECT_ROOT/packaging/windows/install.ps1" "$BUILD_DIR/minicluster-cli-${VERSION}-windows-amd64/"
cp -r "$PROJECT_ROOT/packaging/windows/choco" "$BUILD_DIR/"

# Create README
cat > "$BUILD_DIR/minicluster-cli-${VERSION}-windows-amd64/README.txt" << 'EOF'
MiniCluster CLI for Windows
===========================

Installation:
1. Right-click PowerShell and select "Run as Administrator"
2. Navigate to this directory
3. Run: .\install.ps1

This will:
- Install mc.exe to C:\Program Files\MiniCluster
- Add it to your system PATH
- Make the 'mc' command globally available

Manual Installation:
- Copy mc.exe to any directory in your PATH
- Or add this directory to your PATH

Uninstallation:
.\install.ps1 -Uninstall

Usage:
mc --help
mc version
mc --server http://your-api-server:5147 login

For more information, visit: https://innovatek.com/minicluster
EOF

# Create ZIP archive
echo "Creating ZIP archive..."
cd "$BUILD_DIR"
zip -r "$PROJECT_ROOT/build/minicluster-cli-${VERSION}-windows-amd64.zip" "minicluster-cli-${VERSION}-windows-amd64"

# Prepare Chocolatey package
echo "Preparing Chocolatey package..."
cp "$BUILD_DIR/minicluster-cli-${VERSION}-windows-amd64/mc.exe" "$BUILD_DIR/choco/tools/"
cd "$BUILD_DIR/choco"
# choco pack would be run here if chocolatey is installed
if command -v choco &> /dev/null; then
    choco pack minicluster-cli.nuspec --outputdirectory "$PROJECT_ROOT/build/"
    echo "✓ Chocolatey package created"
else
    echo "Note: chocolatey not installed, skipping .nupkg creation"
    echo "Chocolatey source files available in: $BUILD_DIR/choco"
fi

echo ""
echo "✓ Windows package built successfully!"
echo "ZIP Package: $PROJECT_ROOT/build/minicluster-cli-${VERSION}-windows-amd64.zip"
ls -lh "$PROJECT_ROOT/build/minicluster-cli-${VERSION}-windows-amd64.zip"

if [ -f "$PROJECT_ROOT/build/minicluster-cli.${VERSION}.nupkg" ]; then
    echo "Chocolatey Package: $PROJECT_ROOT/build/minicluster-cli.${VERSION}.nupkg"
    ls -lh "$PROJECT_ROOT/build/minicluster-cli.${VERSION}.nupkg"
fi
