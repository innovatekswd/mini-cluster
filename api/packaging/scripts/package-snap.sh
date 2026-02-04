#!/bin/bash
set -e

# MiniCluster Snap Package Builder (from prebuilt binaries)
# Usage: ./packaging/scripts/package-snap.sh <api-publish-dir> [ui-build-dir]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGING_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_DIR="$(dirname "$PACKAGING_DIR")"

API_PUBLISH_DIR="${1:-$PROJECT_DIR/build/publish}"
UI_BUILD_DIR="${2:-}"

cd "$PROJECT_DIR"

# Validate inputs
if [ ! -d "$API_PUBLISH_DIR" ]; then
    echo "Error: API publish directory not found: $API_PUBLISH_DIR"
    echo ""
    echo "Usage: ./packaging/scripts/package-snap.sh <api-publish-dir> [ui-build-dir]"
    echo ""
    echo "First build the API:"
    echo "  dotnet publish ControlCenter.Api/Innovatek.ControlCenter.Api.csproj -c Release -o ./build/publish --self-contained false"
    echo ""
    echo "Then package:"
    echo "  ./packaging/scripts/package-snap.sh ./build/publish ../minicluster-ui/build/client"
    exit 1
fi

echo "Packaging MiniCluster Snap from prebuilt binaries..."
echo "  API source: $API_PUBLISH_DIR"

# Create staging directory
STAGE_DIR="$PROJECT_DIR/build/snap-stage"
rm -rf "${STAGE_DIR}"
mkdir -p "${STAGE_DIR}/opt/minicluster"

# Copy prebuilt API
cp -r "${API_PUBLISH_DIR}"/* "${STAGE_DIR}/opt/minicluster/"

# Copy UI if provided
if [ -n "$UI_BUILD_DIR" ] && [ -d "$UI_BUILD_DIR" ]; then
    echo "  UI source:  $UI_BUILD_DIR"
    mkdir -p "${STAGE_DIR}/opt/minicluster/wwwroot"
    cp -r "${UI_BUILD_DIR}"/* "${STAGE_DIR}/opt/minicluster/wwwroot/"
fi

# Check if snapcraft is installed
if ! command -v snapcraft &> /dev/null; then
    echo "snapcraft not found. Installing..."
    sudo snap install snapcraft --classic
fi

# Create a modified snapcraft.yaml for prebuilt
cat > "$PROJECT_DIR/snapcraft-prebuilt.yaml" << EOF
name: minicluster
version: '1.0.0'
summary: Lightweight Process Management Platform
description: |
  MiniCluster is a modern process management and monitoring platform
  that provides a web-based control center for managing applications,
  services, and deployments across multiple machines.

grade: stable
confinement: strict
base: core22
architectures:
  - build-on: amd64

layout:
  /var/lib/minicluster:
    bind: \$SNAP_COMMON/data
  /var/log/minicluster:
    bind: \$SNAP_COMMON/logs

apps:
  minicluster:
    command: bin/minicluster-wrapper
    daemon: simple
    restart-condition: always
    restart-delay: 10s
    plugs:
      - network
      - network-bind
      - home
      - removable-media
    environment:
      ASPNETCORE_ENVIRONMENT: Production
      ASPNETCORE_URLS: http://0.0.0.0:5147
      DOTNET_PRINT_TELEMETRY_MESSAGE: "false"
      HOME: \$SNAP_COMMON

  cli:
    command: bin/minicluster-cli
    plugs:
      - network
      - home

parts:
  dotnet-runtime:
    plugin: nil
    stage-packages:
      - aspnetcore-runtime-10.0
    override-build: |
      craftctl default

  minicluster-prebuilt:
    plugin: dump
    source: build/snap-stage/
    organize:
      opt/minicluster: opt/minicluster
    after:
      - dotnet-runtime

  wrapper-scripts:
    plugin: dump
    source: packaging/snap/local/
    organize:
      minicluster-wrapper: bin/minicluster-wrapper
      minicluster-cli: bin/minicluster-cli
    after:
      - minicluster-prebuilt
EOF

# Build the snap
echo "Building snap package..."
snapcraft --use-lxd -f "$PROJECT_DIR/snapcraft-prebuilt.yaml" || snapcraft -f "$PROJECT_DIR/snapcraft-prebuilt.yaml"

# Cleanup
rm -f "$PROJECT_DIR/snapcraft-prebuilt.yaml"
rm -rf "${STAGE_DIR}"

echo ""
echo "Snap package built successfully!"
echo ""
echo "To install locally:"
echo "  sudo snap install minicluster_*.snap --dangerous"
