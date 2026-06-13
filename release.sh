#!/usr/bin/env bash
set -euo pipefail
#
# MiniCluster Release Script
#
# Builds all packages and commits them into this repository under releases/.
# Packages are then accessible via raw.githubusercontent.com URLs.
#
# Usage:
#   ./release.sh <version>               # e.g. ./release.sh 1.0.0
#   ./release.sh <version> --linux-only  # skip Windows build
#   ./release.sh <version> --no-build    # skip build, package existing artifacts
#
# Requirements:
#   - Go toolchain
#   - npm / node
#   - zip, curl, dpkg-deb
#
# Set token if pushing to a private repo:
#   export GITHUB_TOKEN=ghp_xxxxxxxxxxxx
#

GITHUB_REPO="innovatekswd/mini-cluster"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RELEASES_DIR="$SCRIPT_DIR/releases"

# ── Args ──────────────────────────────────────────────────────────────────────
VERSION="${1:-}"
NO_BUILD=false
LINUX_ONLY=false

if [ -z "$VERSION" ]; then
    echo "Usage: $0 <version> [--no-build] [--linux-only]"
    echo "  e.g: $0 1.0.0"
    exit 1
fi

for arg in "$@"; do
    case "$arg" in
        --no-build)    NO_BUILD=true ;;
        --linux-only)  LINUX_ONLY=true ;;
    esac
done

echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║       MiniCluster Release Packager           ║"
echo "  ╠══════════════════════════════════════════════╣"
printf "  ║  Version   : %-31s ║\n" "$VERSION"
printf "  ║  Repo      : %-31s ║\n" "$GITHUB_REPO"
printf "  ║  Build     : %-31s ║\n" "$( $NO_BUILD && echo "skip (use existing)" || echo "yes")"
echo "  ╚══════════════════════════════════════════════╝"
echo ""

# ── Build ─────────────────────────────────────────────────────────────────────
BUILD_DIR="$PROJECT_DIR/build"

if ! $NO_BUILD; then
    echo "▸ Building packages for v${VERSION} ..."
    echo ""

    MINICLUSTER_VERSION="$VERSION" \
        "$PROJECT_DIR/packaging/scripts/build-go-api-linux.sh" "$VERSION"

    if ! $LINUX_ONLY; then
        echo ""
        MINICLUSTER_VERSION="$VERSION" \
            "$PROJECT_DIR/packaging/scripts/build-go-api-windows.sh" "$VERSION"
    fi
    echo ""
fi

# ── Collect artifacts ─────────────────────────────────────────────────────────
echo "▸ Collecting artifacts ..."

VERSION_DIR="$RELEASES_DIR/v${VERSION}"
mkdir -p "$VERSION_DIR"

# Linux .deb
DEB=$(find "$BUILD_DIR" -maxdepth 1 -name "minicluster_${VERSION}_amd64.deb" 2>/dev/null | head -1)
if [ -f "$DEB" ]; then
    cp "$DEB" "$VERSION_DIR/"
    echo "  + $(basename "$DEB")"
fi

# Linux tarballs
for f in "$BUILD_DIR"/minicluster-api-${VERSION}-linux-*.tar.gz; do
    if [ -f "$f" ]; then
        cp "$f" "$VERSION_DIR/"
        echo "  + $(basename "$f")"
    fi
done

# Windows ZIP
WIN_ZIP=$(find "$BUILD_DIR" -maxdepth 1 -name "minicluster-${VERSION}-windows-amd64.zip" 2>/dev/null | head -1)
if [ -f "$WIN_ZIP" ]; then
    cp "$WIN_ZIP" "$VERSION_DIR/"
    echo "  + $(basename "$WIN_ZIP")"
fi

# Check we have at least one artifact
ARTIFACT_COUNT=$(find "$VERSION_DIR" -maxdepth 1 -type f 2>/dev/null | wc -l)
if [ "$ARTIFACT_COUNT" -eq 0 ]; then
    echo ""
    echo "  Error: no artifacts found for version $VERSION in $BUILD_DIR"
    echo "  Run without --no-build, or build manually first."
    exit 1
fi

echo ""

# ── Commit to repository ──────────────────────────────────────────────────────
echo "▸ Committing release v${VERSION} to repository ..."

cd "$SCRIPT_DIR"

git add "releases/v${VERSION}/"
git commit -m "Release v${VERSION} — add packages

Packages committed to releases/v${VERSION}/ for direct download via:
  https://raw.githubusercontent.com/${GITHUB_REPO}/main/releases/v${VERSION}/"

# ── Push (if GITHUB_TOKEN is set or remote allows) ────────────────────────────
if git push origin main 2>/dev/null; then
    echo "  ✓ Pushed to origin/main"
else
    echo "  ! Push failed. You may need to set GITHUB_TOKEN or push manually:"
    echo "    git push origin main"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "  ═══════════════════════════════════════════════"
echo "  ✓ v${VERSION} released!"
echo ""
echo "  Packages available at:"
echo "    https://raw.githubusercontent.com/${GITHUB_REPO}/main/releases/v${VERSION}/"
echo ""
echo "  Install with:"
echo "    curl -fsSL https://raw.githubusercontent.com/${GITHUB_REPO}/main/install.sh | bash"
echo "  ═══════════════════════════════════════════════"
echo ""
