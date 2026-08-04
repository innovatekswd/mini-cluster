#!/usr/bin/env bash
set -euo pipefail
#
# MiniCluster Release Script
#
# Builds all packages and commits them into this repository under releases/.
# Packages are then accessible via raw.githubusercontent.com URLs.
#
# Usage:
#   ./release.sh <version>                    # e.g. ./release.sh 1.0.0
#   ./release.sh <version> --linux-only       # skip Windows build
#   ./release.sh <version> --no-build         # skip build, package existing artifacts
#   ./release.sh <version> --no-publish       # commit packages, create no GitHub Release
#   ./release.sh <version> --notes FILE       # release notes (default: auto-generated)
#
# What a release is, in order: build packages, commit them into this repo,
# bump the README, and publish a GitHub Release. That last step is what
# install.sh reads — without it, `curl … | bash` keeps installing the previous
# version no matter what is committed here.
#
# Requirements:
#   - Go toolchain
#   - npm / node
#   - zip, curl, dpkg-deb
#   - gh CLI, authenticated (for the GitHub Release; --no-publish skips it)
#
# Set token if pushing to a private repo:
#   export GITHUB_TOKEN=ghp_xxxxxxxxxxxx
#

GITHUB_REPO="innovatekswd/mini-cluster"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../minicluster" && pwd)"
RELEASES_DIR="$SCRIPT_DIR/releases"

# ── Args ──────────────────────────────────────────────────────────────────────
VERSION="${1:-}"
NO_BUILD=false
LINUX_ONLY=false
NO_PUBLISH=false
NOTES_FILE=""

if [ -z "$VERSION" ]; then
    echo "Usage: $0 <version> [--no-build] [--linux-only] [--no-publish] [--notes FILE]"
    echo "  e.g: $0 1.0.0"
    exit 1
fi

shift
while [ $# -gt 0 ]; do
    case "$1" in
        --no-build)    NO_BUILD=true ;;
        --linux-only)  LINUX_ONLY=true ;;
        --no-publish)  NO_PUBLISH=true ;;
        --notes)       NOTES_FILE="${2:-}"; shift ;;
        *)             echo "Unknown option: $1"; exit 1 ;;
    esac
    shift
done

echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║       MiniCluster Release Packager           ║"
echo "  ╠══════════════════════════════════════════════╣"
printf "  ║  Version   : %-31s ║\n" "$VERSION"
printf "  ║  Repo      : %-31s ║\n" "$GITHUB_REPO"
printf "  ║  Build     : %-31s ║\n" "$( $NO_BUILD && echo "skip (use existing)" || echo "yes")"
printf "  ║  Publish   : %-31s ║\n" "$( $NO_PUBLISH && echo "no GitHub Release" || echo "GitHub Release + assets")"
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

# Standalone CLI. The build already produces it with the right version stamped
# in; this script used to leave it behind, so the README's own download table
# pointed at a file no release contained.
for f in "$BUILD_DIR"/mc-linux-amd64 "$BUILD_DIR"/mc-linux-arm64; do
    if [ -f "$f" ]; then
        cp "$f" "$VERSION_DIR/"
        chmod +x "$VERSION_DIR/$(basename "$f")"
        echo "  + $(basename "$f")"
    fi
done

# Check we have at least one artifact
ARTIFACT_COUNT=$(find "$VERSION_DIR" -maxdepth 1 -type f 2>/dev/null | wc -l)
if [ "$ARTIFACT_COUNT" -eq 0 ]; then
    echo ""
    echo "  Error: no artifacts found for version $VERSION in $BUILD_DIR"
    echo "  Run without --no-build, or build manually first."
    exit 1
fi

echo ""

# ── Point the README at this version ──────────────────────────────────────────
# The download table names exact filenames, so a stale README links to packages
# from the previous release.
if [ -f "$SCRIPT_DIR/README.md" ]; then
    PREV_VERSION=$(grep -oP '(?<=### Quick Download — v)[0-9]+\.[0-9]+\.[0-9]+' "$SCRIPT_DIR/README.md" | head -1 || true)
    if [ -n "$PREV_VERSION" ] && [ "$PREV_VERSION" != "$VERSION" ]; then
        sed -i "s/${PREV_VERSION}/${VERSION}/g" "$SCRIPT_DIR/README.md"
        echo "▸ README bumped: v${PREV_VERSION} → v${VERSION}"
        echo ""
    fi
fi

# ── Commit to repository ──────────────────────────────────────────────────────
echo "▸ Committing release v${VERSION} to repository ..."

cd "$SCRIPT_DIR"

git add "releases/v${VERSION}/" README.md

# Re-running a release with identical artifacts leaves nothing staged, and a
# failed commit under `set -e` would abort before the GitHub Release — the one
# step most likely to be the reason for the re-run.
if git diff --cached --quiet; then
    echo "  · nothing new to commit"
else
    git commit -m "Release v${VERSION} — add packages

Packages committed to releases/v${VERSION}/ for direct download via:
  https://raw.githubusercontent.com/${GITHUB_REPO}/main/releases/v${VERSION}/"
fi

# ── Push (if GITHUB_TOKEN is set or remote allows) ────────────────────────────
if git push origin main 2>/dev/null; then
    echo "  ✓ Pushed to origin/main"
else
    echo "  ! Push failed. You may need to set GITHUB_TOKEN or push manually:"
    echo "    git push origin main"
fi

# ── Publish a GitHub Release ──────────────────────────────────────────────────
#
# This is the step install.sh depends on, and the one this script used to skip.
# The installer resolves "latest" from the GitHub Releases API and downloads
# from releases/download/v<version>/ — so committing packages into the repo made
# them browsable but left every `curl … | bash` install fetching the previous
# version, with nothing in the output to suggest anything was wrong.
if $NO_PUBLISH; then
    echo "▸ Skipping GitHub Release (--no-publish)"
elif ! command -v gh >/dev/null 2>&1; then
    echo "  ! gh CLI not found — no GitHub Release created."
    echo "    Until one exists, install.sh will keep resolving the previous version."
    echo "    Create it with:"
    echo "      gh release create v${VERSION} --repo ${GITHUB_REPO} --title \"MiniCluster v${VERSION}\" ${VERSION_DIR}/*"
else
    echo "▸ Publishing GitHub Release v${VERSION} ..."

    NOTES_ARG=()
    if [ -n "$NOTES_FILE" ] && [ -f "$NOTES_FILE" ]; then
        NOTES_ARG=(--notes-file "$NOTES_FILE")
    else
        NOTES_ARG=(--generate-notes)
    fi

    if gh release view "v${VERSION}" --repo "$GITHUB_REPO" >/dev/null 2>&1; then
        # Re-running a release should top up its assets, not fail outright.
        echo "  ! Release v${VERSION} already exists — uploading assets over it"
        gh release upload "v${VERSION}" "$VERSION_DIR"/* --repo "$GITHUB_REPO" --clobber
    else
        gh release create "v${VERSION}" \
            --repo "$GITHUB_REPO" \
            --title "MiniCluster v${VERSION}" \
            "${NOTES_ARG[@]}" \
            "$VERSION_DIR"/*
    fi

    LATEST=$(gh release view --repo "$GITHUB_REPO" --json tagName -q .tagName 2>/dev/null || echo "")
    if [ "$LATEST" = "v${VERSION}" ]; then
        echo "  ✓ v${VERSION} is now the latest release — install.sh will resolve it"
    else
        echo "  ! Latest release is ${LATEST:-unknown}, not v${VERSION}."
        echo "    install.sh resolves 'latest', so it will still install ${LATEST}."
    fi
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
