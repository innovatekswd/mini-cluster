#!/usr/bin/env bash
set -euo pipefail
#
# MiniCluster Release Script
#
# Builds all packages and publishes them as a GitHub Release.
#
# Usage:
#   ./release.sh <version>               # e.g. ./release.sh 1.0.0
#   ./release.sh <version> --draft       # create as draft (don't publish yet)
#   ./release.sh <version> --no-build    # skip build, upload existing packages
#   ./release.sh <version> --linux-only  # skip Windows build
#
# Requirements:
#   - GITHUB_TOKEN env var (repo write access)
#   - Go toolchain
#   - npm / node
#   - zip, curl, dpkg-deb
#
# Set token:
#   export GITHUB_TOKEN=ghp_xxxxxxxxxxxx
#

GITHUB_REPO="innovatekswd/mini-cluster"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Args ──────────────────────────────────────────────────────────────────────
VERSION="${1:-}"
DRAFT=false
NO_BUILD=false
LINUX_ONLY=false

if [ -z "$VERSION" ]; then
    echo "Usage: $0 <version> [--draft] [--no-build] [--linux-only]"
    echo "  e.g: $0 1.0.0"
    exit 1
fi

for arg in "$@"; do
    case "$arg" in
        --draft)       DRAFT=true ;;
        --no-build)    NO_BUILD=true ;;
        --linux-only)  LINUX_ONLY=true ;;
    esac
done

# ── Require GITHUB_TOKEN ──────────────────────────────────────────────────────
if [ -z "${GITHUB_TOKEN:-}" ]; then
    echo ""
    echo "  Error: GITHUB_TOKEN is not set."
    echo ""
    echo "  Generate one at: https://github.com/settings/tokens"
    echo "  Required scopes: repo (or contents:write for fine-grained tokens)"
    echo ""
    echo "  Then run:"
    echo "    export GITHUB_TOKEN=ghp_xxxxxxxxxxxx"
    echo "    $0 $VERSION"
    echo ""
    exit 1
fi

BUILD_DIR="$PROJECT_DIR/build"

echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║         MiniCluster Release Publisher        ║"
echo "  ╠══════════════════════════════════════════════╣"
printf "  ║  Version  : %-31s ║\n" "$VERSION"
printf "  ║  Repo     : %-31s ║\n" "$GITHUB_REPO"
printf "  ║  Draft    : %-31s ║\n" "$DRAFT"
printf "  ║  Build    : %-31s ║\n" "$( $NO_BUILD && echo "skip (use existing)" || echo "yes")"
echo "  ╚══════════════════════════════════════════════╝"
echo ""

# ── Build ─────────────────────────────────────────────────────────────────────
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

ARTIFACTS=()

# Linux .deb
DEB=$(find "$BUILD_DIR" -maxdepth 1 -name "minicluster_${VERSION}_amd64.deb" 2>/dev/null | head -1)
[ -f "$DEB" ] && ARTIFACTS+=("$DEB") && echo "  + $(basename "$DEB")"

# Linux tarballs
for f in "$BUILD_DIR"/minicluster-api-${VERSION}-linux-*.tar.gz; do
    [ -f "$f" ] && ARTIFACTS+=("$f") && echo "  + $(basename "$f")"
done

# Windows ZIP
WIN_ZIP=$(find "$BUILD_DIR" -maxdepth 1 -name "minicluster-${VERSION}-windows-amd64.zip" 2>/dev/null | head -1)
[ -f "$WIN_ZIP" ] && ARTIFACTS+=("$WIN_ZIP") && echo "  + $(basename "$WIN_ZIP")"

if [ ${#ARTIFACTS[@]} -eq 0 ]; then
    echo ""
    echo "  Error: no artifacts found for version $VERSION in $BUILD_DIR"
    echo "  Run without --no-build, or build manually first."
    exit 1
fi

echo ""

# ── Create GitHub Release ─────────────────────────────────────────────────────
echo "▸ Creating GitHub release v${VERSION} ..."

TAG="v${VERSION}"
RELEASE_BODY=$(cat <<EOF
## MiniCluster v${VERSION}

### Install

**Linux (one-liner):**
\`\`\`bash
curl -fsSL https://raw.githubusercontent.com/${GITHUB_REPO}/main/install.sh | bash
\`\`\`

**Windows (PowerShell — run as Administrator):**
\`\`\`powershell
irm https://raw.githubusercontent.com/${GITHUB_REPO}/main/install.ps1 | iex
\`\`\`

### Packages

| Platform | File |
|----------|------|
| Linux amd64 (.deb) | \`minicluster_${VERSION}_amd64.deb\` |
| Linux amd64 (tarball) | \`minicluster-api-${VERSION}-linux-amd64.tar.gz\` |
| Linux arm64 (tarball) | \`minicluster-api-${VERSION}-linux-arm64.tar.gz\` |
| Windows x64 | \`minicluster-${VERSION}-windows-amd64.zip\` |

See the [README](https://github.com/${GITHUB_REPO}#readme) for full install and usage instructions.
EOF
)

RELEASE_PAYLOAD=$(jq -n \
    --arg tag "$TAG" \
    --arg name "v${VERSION}" \
    --arg body "$RELEASE_BODY" \
    --argjson draft "$DRAFT" \
    '{
        tag_name: $tag,
        name: $name,
        body: $body,
        draft: $draft,
        prerelease: false
    }')

RELEASE_RESPONSE=$(curl -fsSL \
    -X POST \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/repos/${GITHUB_REPO}/releases" \
    -d "$RELEASE_PAYLOAD")

RELEASE_ID=$(echo "$RELEASE_RESPONSE" | jq -r '.id')
UPLOAD_URL=$(echo "$RELEASE_RESPONSE" | jq -r '.upload_url' | sed 's/{?name,label}//')

if [ -z "$RELEASE_ID" ] || [ "$RELEASE_ID" = "null" ]; then
    echo ""
    echo "  Error creating release:"
    echo "$RELEASE_RESPONSE" | jq .
    exit 1
fi

echo "  ✓ Release created (id: $RELEASE_ID)"
echo ""

# ── Upload artifacts ──────────────────────────────────────────────────────────
echo "▸ Uploading artifacts ..."

for artifact in "${ARTIFACTS[@]}"; do
    name="$(basename "$artifact")"
    size="$(du -sh "$artifact" | cut -f1)"
    echo -n "  Uploading $name ($size) ... "

    # Determine MIME type
    case "$artifact" in
        *.deb)    mime="application/vnd.debian.binary-package" ;;
        *.tar.gz) mime="application/gzip" ;;
        *.zip)    mime="application/zip" ;;
        *)        mime="application/octet-stream" ;;
    esac

    UPLOAD_RESPONSE=$(curl -fsSL \
        -X POST \
        -H "Authorization: Bearer $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github+json" \
        -H "Content-Type: $mime" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        "${UPLOAD_URL}?name=${name}" \
        --data-binary "@$artifact")

    DOWNLOAD_URL=$(echo "$UPLOAD_RESPONSE" | jq -r '.browser_download_url')
    if [ -z "$DOWNLOAD_URL" ] || [ "$DOWNLOAD_URL" = "null" ]; then
        echo "FAILED"
        echo "$UPLOAD_RESPONSE" | jq .
        exit 1
    fi
    echo "✓"
done

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "  ═══════════════════════════════════════════════"
echo "  ✓ Release published!"
echo ""
echo "  https://github.com/${GITHUB_REPO}/releases/tag/${TAG}"
echo ""
if $DRAFT; then
    echo "  (Draft — go to the URL above to publish it)"
    echo ""
fi
echo "  Install now:"
echo "    curl -fsSL https://raw.githubusercontent.com/${GITHUB_REPO}/main/install.sh | bash"
echo "  ═══════════════════════════════════════════════"
echo ""
