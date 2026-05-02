#!/usr/bin/env bash
set -euo pipefail
#
# Build and package the MiniCluster Go API server for Linux.
#
# Produces:
#   build/minicluster-api-<version>-linux-amd64.tar.gz   — portable tarball
#   build/minicluster_<version>_amd64.deb                — Debian/Ubuntu package
#   build/minicluster-api-<version>-linux-arm64.tar.gz   — ARM64 tarball (optional)
#
# Usage:
#   ./packaging/scripts/build-go-api-linux.sh [version] [--no-deb] [--arm64]
#
#   version  defaults to git describe or "0.0.0"
#   --no-deb skip Debian package (useful if dpkg-buildpackage is not installed)
#   --arm64  also build ARM64 tarball

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
API_DIR="$ROOT_DIR/api-go"
BUILD_DIR="$ROOT_DIR/build"
DEBIAN_ASSETS="$ROOT_DIR/packaging/debian-go"

VERSION="${1:-$(git -C "$ROOT_DIR" describe --tags --always --dirty 2>/dev/null || echo "0.0.0")}"
# Strip leading 'v'
VERSION="${VERSION#v}"

BUILD_DEB=true
BUILD_ARM=false
for arg in "$@"; do
    case "$arg" in
        --no-deb) BUILD_DEB=false ;;
        --arm64)  BUILD_ARM=true  ;;
    esac
done

GIT_COMMIT="$(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)"
BUILD_TIME="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
LDFLAGS="-s -w \
  -X main.Version=${VERSION} \
  -X main.GitCommit=${GIT_COMMIT} \
  -X main.BuildTime=${BUILD_TIME}"

echo "╔══════════════════════════════════════════════════╗"
echo "║  MiniCluster Go API — Linux Build                ║"
echo "╠══════════════════════════════════════════════════╣"
printf "║  Version  : %-36s ║\n" "$VERSION"
printf "║  Commit   : %-36s ║\n" "$GIT_COMMIT"
printf "║  DEB pkg  : %-36s ║\n" "$BUILD_DEB"
echo "╚══════════════════════════════════════════════════╝"
echo ""

mkdir -p "$BUILD_DIR"

# ── Helper: build one binary ─────────────────────────────────────────────────
build_binary() {
    local GOOS="$1" GOARCH="$2" OUT="$3"
    echo "▸ Compiling  GOOS=$GOOS GOARCH=$GOARCH ..."
    cd "$API_DIR"
    CGO_ENABLED=0 GOOS="$GOOS" GOARCH="$GOARCH" \
        go build -ldflags "$LDFLAGS" -o "$OUT" ./cmd/server
    echo "  ✓ $(du -sh "$OUT" | cut -f1)  →  $OUT"
}

# ── Helper: create tarball ───────────────────────────────────────────────────
make_tarball() {
    local BINARY="$1" ARCH="$2"
    local STAGE="$BUILD_DIR/minicluster-api-${VERSION}-linux-${ARCH}"
    rm -rf "$STAGE"
    mkdir -p "$STAGE"

    cp "$BINARY"                          "$STAGE/minicluster-api"
    cp "$DEBIAN_ASSETS/config.yaml"      "$STAGE/config.yaml.example"
    cp "$DEBIAN_ASSETS/minicluster.service" "$STAGE/minicluster.service"

    cat > "$STAGE/README.txt" << EOF
MiniCluster API ${VERSION} — Linux ${ARCH}
==========================================

Quick start:
  chmod +x ./minicluster-api
  ./minicluster-api                    # listens on :5000

With custom config:
  cp config.yaml.example config.yaml  # edit as needed
  ./minicluster-api                    # reads ./config.yaml automatically

Environment overrides (prefix MINICLUSTER_):
  MINICLUSTER_PORT=8080 ./minicluster-api
  MINICLUSTER_DATA_DIR=/srv/mc ./minicluster-api

Systemd installation (manual):
  sudo cp minicluster-api /usr/bin/minicluster-api
  sudo cp minicluster.service /lib/systemd/system/
  sudo useradd --system --no-create-home minicluster
  sudo mkdir -p /var/lib/minicluster /etc/minicluster
  sudo chown -R minicluster:minicluster /var/lib/minicluster /etc/minicluster
  sudo cp config.yaml.example /etc/minicluster/config.yaml
  sudo systemctl daemon-reload
  sudo systemctl enable --now minicluster

Default URL: http://localhost:5000
EOF

    local TARBALL="$BUILD_DIR/minicluster-api-${VERSION}-linux-${ARCH}.tar.gz"
    tar -czf "$TARBALL" -C "$BUILD_DIR" "$(basename "$STAGE")"
    rm -rf "$STAGE"
    echo "  ✓ Tarball: $TARBALL  ($(du -sh "$TARBALL" | cut -f1))"
}

# ── amd64 ────────────────────────────────────────────────────────────────────
AMD64_BIN="$BUILD_DIR/minicluster-api-linux-amd64"
build_binary linux amd64 "$AMD64_BIN"
make_tarball "$AMD64_BIN" amd64

# ── arm64 (optional) ─────────────────────────────────────────────────────────
if $BUILD_ARM; then
    ARM64_BIN="$BUILD_DIR/minicluster-api-linux-arm64"
    build_binary linux arm64 "$ARM64_BIN"
    make_tarball "$ARM64_BIN" arm64
fi

# ── Debian package ───────────────────────────────────────────────────────────
if $BUILD_DEB; then
    if ! command -v dpkg-deb &>/dev/null; then
        echo "⚠  dpkg-deb not found — skipping .deb (run on a Debian/Ubuntu host, or pass --no-deb)"
    else
        echo "▸ Building Debian package ..."
        STAGE="$BUILD_DIR/deb-go-stage"
        PKG_NAME="minicluster_${VERSION}_amd64"

        rm -rf "$STAGE"
        mkdir -p "$STAGE/$PKG_NAME/DEBIAN"
        mkdir -p "$STAGE/$PKG_NAME/usr/bin"
        mkdir -p "$STAGE/$PKG_NAME/lib/systemd/system"
        mkdir -p "$STAGE/$PKG_NAME/etc/minicluster"

        # Binary
        cp "$AMD64_BIN" "$STAGE/$PKG_NAME/usr/bin/minicluster-api"
        chmod 0755 "$STAGE/$PKG_NAME/usr/bin/minicluster-api"

        # Systemd unit
        cp "$DEBIAN_ASSETS/minicluster.service" "$STAGE/$PKG_NAME/lib/systemd/system/minicluster.service"

        # Default config (shipped as .default — postinst copies to /etc/minicluster/config.yaml if absent)
        cp "$DEBIAN_ASSETS/config.yaml" "$STAGE/$PKG_NAME/etc/minicluster/config.yaml.default"

        # DEBIAN/ control scripts
        for f in control changelog compat copyright postinst prerm postrm; do
            [ -f "$DEBIAN_ASSETS/$f" ] && cp "$DEBIAN_ASSETS/$f" "$STAGE/$PKG_NAME/DEBIAN/$f"
        done

        # Patch version in control
        sed -i "s/^Version:.*/Version: ${VERSION}-1/" "$STAGE/$PKG_NAME/DEBIAN/control" 2>/dev/null || true

        # Add Version field if missing
        if ! grep -q "^Version:" "$STAGE/$PKG_NAME/DEBIAN/control"; then
            sed -i "/^Package:/a Version: ${VERSION}-1" "$STAGE/$PKG_NAME/DEBIAN/control"
        fi

        chmod 0755 "$STAGE/$PKG_NAME/DEBIAN/postinst" \
                   "$STAGE/$PKG_NAME/DEBIAN/prerm" \
                   "$STAGE/$PKG_NAME/DEBIAN/postrm" 2>/dev/null || true

        dpkg-deb --root-owner-group --build "$STAGE/$PKG_NAME" "$BUILD_DIR/${PKG_NAME}.deb"
        rm -rf "$STAGE"

        echo "  ✓ DEB: $BUILD_DIR/${PKG_NAME}.deb  ($(du -sh "$BUILD_DIR/${PKG_NAME}.deb" | cut -f1))"
    fi
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════"
echo "  Build complete — v${VERSION}"
echo ""
echo "  Artifacts in $BUILD_DIR:"
ls -lh "$BUILD_DIR"/minicluster*.tar.gz "$BUILD_DIR"/minicluster_*.deb 2>/dev/null | awk '{print "    "$NF"  ("$5")"}'
echo "═══════════════════════════════════════════════════"
