#!/usr/bin/env bash
set -euo pipefail
#
# MiniCluster One-Line Installer — Linux
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/innovatekswd/mini-cluster/main/install.sh | bash
#
# Environment overrides:
#   MINICLUSTER_VERSION=1.2.0   install a specific version (default: latest)
#   MINICLUSTER_PORT=2016       port written to config (default: 2016)
#   MINICLUSTER_NO_SERVICE=1    skip systemd service setup
#

GITHUB_REPO="innovatekswd/mini-cluster"
VERSION="${MINICLUSTER_VERSION:-latest}"
PORT="${MINICLUSTER_PORT:-2016}"
NO_SERVICE="${MINICLUSTER_NO_SERVICE:-}"

# ── Detect arch ───────────────────────────────────────────────────────────────
detect_arch() {
    case "$(uname -m)" in
        x86_64|amd64)  echo "amd64" ;;
        aarch64|arm64) echo "arm64" ;;
        *) echo "Unsupported architecture: $(uname -m)" >&2; exit 1 ;;
    esac
}

# ── Resolve latest version from GitHub ───────────────────────────────────────
resolve_version() {
    local ver
    ver=$(curl -fsSL "https://api.github.com/repos/$GITHUB_REPO/releases/latest" \
        | grep '"tag_name"' | sed -E 's/.*"v?([^"]+)".*/\1/')
    if [ -z "$ver" ]; then
        echo "Error: could not resolve latest version from GitHub." >&2
        exit 1
    fi
    echo "$ver"
}

main() {
    echo ""
    echo "  ╔══════════════════════════════════════════╗"
    echo "  ║        MiniCluster Installer             ║"
    echo "  ╚══════════════════════════════════════════╝"
    echo ""

    if [ "$(uname -s)" != "Linux" ]; then
        echo "This script is for Linux only. For Windows, use install.ps1." >&2
        exit 1
    fi

    local arch
    arch=$(detect_arch)

    if [ "$VERSION" = "latest" ]; then
        echo "  → Resolving latest version..."
        VERSION=$(resolve_version)
    fi
    echo "  Version : $VERSION"
    echo "  Arch    : $arch"
    echo "  Port    : $PORT"
    echo ""

    # ── Prefer .deb on Debian/Ubuntu ─────────────────────────────────────────
    if command -v dpkg &>/dev/null && [ "$arch" = "amd64" ]; then
        local deb="minicluster_${VERSION}_amd64.deb"
        local url="https://github.com/$GITHUB_REPO/releases/download/v${VERSION}/${deb}"
        local tmp
        tmp=$(mktemp)

        echo "  → Downloading $deb ..."
        curl -fsSL "$url" -o "$tmp"

        echo "  → Installing .deb ..."
        sudo dpkg -i "$tmp"
        rm -f "$tmp"

        if [ "$PORT" != "2016" ]; then
            sudo sed -i "s/^port:.*/port: $PORT/" /etc/minicluster/config.yaml
        fi

        if [ -z "$NO_SERVICE" ]; then
            sudo systemctl enable --now minicluster
        fi

    # ── Fallback: tarball ─────────────────────────────────────────────────────
    else
        local tar="minicluster-api-${VERSION}-linux-${arch}.tar.gz"
        local url="https://github.com/$GITHUB_REPO/releases/download/v${VERSION}/${tar}"
        local tmpdir
        tmpdir=$(mktemp -d)

        echo "  → Downloading $tar ..."
        curl -fsSL "$url" -o "$tmpdir/$tar"

        echo "  → Extracting ..."
        tar -xzf "$tmpdir/$tar" -C "$tmpdir"
        local stage
        stage=$(find "$tmpdir" -maxdepth 1 -type d | grep -v "^$tmpdir$" | head -1)

        echo "  → Installing binaries ..."
        sudo cp "$stage/minicluster-api" /usr/local/bin/minicluster-api
        sudo chmod 0755 /usr/local/bin/minicluster-api
        if [ -f "$stage/mc" ]; then
            sudo cp "$stage/mc" /usr/local/bin/mc
            sudo chmod 0755 /usr/local/bin/mc
        fi

        sudo mkdir -p /etc/minicluster /var/lib/minicluster
        if [ ! -f /etc/minicluster/config.yaml ] && [ -f "$stage/config.yaml.example" ]; then
            sudo cp "$stage/config.yaml.example" /etc/minicluster/config.yaml
        fi
        sudo sed -i "s/^port:.*/port: $PORT/" /etc/minicluster/config.yaml

        if [ -z "$NO_SERVICE" ] && command -v systemctl &>/dev/null && [ -f "$stage/minicluster.service" ]; then
            sudo cp "$stage/minicluster.service" /lib/systemd/system/minicluster.service
            sudo systemctl daemon-reload
            sudo systemctl enable --now minicluster
        fi

        rm -rf "$tmpdir"
    fi

    echo ""
    echo "  ═══════════════════════════════════════════"
    echo "  ✓ MiniCluster installed!"
    echo ""
    echo "  Open: http://localhost:$PORT"
    echo ""
    echo "  Service commands:"
    echo "    sudo systemctl start   minicluster"
    echo "    sudo systemctl stop    minicluster"
    echo "    sudo systemctl status  minicluster"
    echo "    journalctl -u minicluster -f"
    echo ""
    echo "  CLI:"
    echo "    mc login --server http://localhost:$PORT"
    echo "  ═══════════════════════════════════════════"
    echo ""
}

main "$@"
