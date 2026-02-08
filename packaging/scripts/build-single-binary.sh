#!/usr/bin/env bash
set -euo pipefail

#
# Build MiniCluster as a self-contained single-file binary.
#
# Usage:
#   ./packaging/scripts/build-single-binary.sh                # linux-x64 (default)
#   ./packaging/scripts/build-single-binary.sh linux-arm64    # linux ARM
#   ./packaging/scripts/build-single-binary.sh osx-x64        # macOS Intel
#   ./packaging/scripts/build-single-binary.sh osx-arm64       # macOS Apple Silicon
#   ./packaging/scripts/build-single-binary.sh win-x64         # Windows
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

RID="${1:-linux-x64}"
VERSION="${MINICLUSTER_VERSION:-1.0.0}"
OUTPUT_DIR="$ROOT_DIR/build/single-binary"
API_PROJECT="$ROOT_DIR/api/Innovatek.Parallel.MiniCluster.Api/Innovatek.Parallel.MiniCluster.Api.csproj"
UI_DIR="$ROOT_DIR/ui"

echo "╔══════════════════════════════════════════════╗"
echo "║       MiniCluster Single Binary Build        ║"
echo "╠══════════════════════════════════════════════╣"
echo "║  Target:   $RID"
echo "║  Version:  $VERSION"
echo "║  Output:   $OUTPUT_DIR/"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── Step 1: Build the UI ─────────────────────────────────────
echo "▸ [1/4] Building UI..."
cd "$UI_DIR"

if [ ! -d "node_modules" ]; then
    echo "  Installing npm dependencies..."
    npm ci --silent
fi

npm run build --silent
echo "  ✓ UI built → ui/build/client/"

# ── Step 2: Copy UI into API wwwroot ─────────────────────────
echo "▸ [2/4] Embedding UI into API wwwroot..."
WWWROOT="$ROOT_DIR/api/Innovatek.Parallel.MiniCluster.Api/wwwroot"
rm -rf "$WWWROOT"
mkdir -p "$WWWROOT"
cp -r "$UI_DIR/build/client/"* "$WWWROOT/"
echo "  ✓ UI copied to wwwroot/"

# ── Step 3: Publish as self-contained single file ────────────
echo "▸ [3/4] Publishing .NET self-contained single-file ($RID)..."
cd "$ROOT_DIR"

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

dotnet publish "$API_PROJECT" \
    -c Release \
    -r "$RID" \
    -o "$OUTPUT_DIR" \
    --self-contained true \
    /p:PublishSingleFile=true \
    /p:IncludeNativeLibrariesForSelfExtract=true \
    /p:EnableCompressionInSingleFile=true \
    /p:Version="$VERSION" \
    /p:DebugType=none \
    /p:DebugSymbols=false

echo "  ✓ Published to $OUTPUT_DIR/"

# ── Step 4: Determine binary name and report ─────────────────
echo "▸ [4/4] Finalizing..."

if [[ "$RID" == win-* ]]; then
    BINARY_NAME="minicluster.exe"
else
    BINARY_NAME="minicluster"
    # Rename the output binary
    API_BINARY="$OUTPUT_DIR/Innovatek.Parallel.MiniCluster.Api"
    if [ -f "$API_BINARY" ]; then
        mv "$API_BINARY" "$OUTPUT_DIR/$BINARY_NAME"
    fi
fi

# Clean up non-essential files (keep only the binary + wwwroot)
find "$OUTPUT_DIR" -name "*.pdb" -delete 2>/dev/null || true
find "$OUTPUT_DIR" -name "*.deps.json" -delete 2>/dev/null || true
find "$OUTPUT_DIR" -name "*.runtimeconfig.json" -delete 2>/dev/null || true
find "$OUTPUT_DIR" -name "*.staticwebassets.endpoints.json" -delete 2>/dev/null || true
rm -rf "$OUTPUT_DIR/BuildHost-net472" 2>/dev/null || true
rm -rf "$OUTPUT_DIR/BuildHost-netcore" 2>/dev/null || true

# Calculate size
BINARY_PATH="$OUTPUT_DIR/$BINARY_NAME"
if [ -f "$BINARY_PATH" ]; then
    SIZE=$(du -sh "$BINARY_PATH" | cut -f1)
    echo ""
    echo "═══════════════════════════════════════════════"
    echo "  ✓ Build complete!"
    echo ""
    echo "  Binary:  $BINARY_PATH"
    echo "  Size:    $SIZE"
    echo "  Target:  $RID"
    echo ""
    echo "  Run it:"
    if [[ "$RID" == win-* ]]; then
        echo "    .\\minicluster.exe --urls \"http://0.0.0.0:5147\""
    else
        echo "    chmod +x $BINARY_PATH"
        echo "    ./$BINARY_NAME --urls \"http://0.0.0.0:5147\""
    fi
    echo "═══════════════════════════════════════════════"
else
    echo "  ✗ Binary not found at $BINARY_PATH"
    echo "  Contents of $OUTPUT_DIR:"
    ls -la "$OUTPUT_DIR"
    exit 1
fi
