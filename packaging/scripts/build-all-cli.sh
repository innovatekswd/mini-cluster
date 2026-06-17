#!/bin/bash
set -e

# Build all MiniCluster CLI packages

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR)")"
VERSION="1.0.16"

echo "========================================"
echo "Building MiniCluster CLI v${VERSION}"
echo "All platforms"
echo "========================================"
echo ""

# Make scripts executable
chmod +x "$SCRIPT_DIR"/build-cli-*.sh

# Build Debian package
echo "=== Building Debian Package ==="
"$SCRIPT_DIR/build-cli-deb.sh"
echo ""

# Build Snap package
if command -v snapcraft &> /dev/null; then
    echo "=== Building Snap Package ==="
    "$SCRIPT_DIR/build-cli-snap.sh"
    echo ""
else
    echo "=== Skipping Snap Package (snapcraft not installed) ==="
    echo ""
fi

# Build Windows package
echo "=== Building Windows Package ==="
"$SCRIPT_DIR/build-cli-windows.sh"
echo ""

echo "========================================"
echo "✓ All CLI packages built successfully!"
echo "========================================"
echo ""
echo "Packages available in: $PROJECT_ROOT/build/"
ls -lh "$PROJECT_ROOT/build/"
echo ""
echo "Debian: minicluster-cli_${VERSION}_amd64.deb"
echo "Windows: minicluster-cli-${VERSION}-windows-amd64.zip"
if [ -f "$PROJECT_ROOT/build/minicluster-cli_${VERSION}_amd64.snap" ]; then
    echo "Snap: minicluster-cli_${VERSION}_amd64.snap"
fi
