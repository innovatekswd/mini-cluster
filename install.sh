#!/usr/bin/env bash
set -euo pipefail
#
# MiniCluster One-Line Installer — Linux
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/innovatekswd/mini-cluster/main/install.sh | bash
#
# Environment overrides:
#   MINICLUSTER_VERSION=1.0.14   install a specific version (default: latest)
#   MINICLUSTER_PORT=2016        port written to config (default: 2016)
#   MINICLUSTER_NO_SERVICE=1     skip systemd service setup
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

# ── Resolve latest version from GitHub Releases ──────────────────────────────
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

    local base_url="https://github.com/${GITHUB_REPO}/releases/download/v${VERSION}"

    # ── Prefer .deb on Debian/Ubuntu ─────────────────────────────────────────
    if command -v dpkg &>/dev/null && [ "$arch" = "amd64" ]; then
        local deb="minicluster_${VERSION}_amd64.deb"
        local url="${base_url}/${deb}"
        local tmp
        tmp=$(mktemp)

        echo "  → Downloading $deb ..."
        curl -fsSL "$url" -o "$tmp"

        echo "  → Installing .deb ..."
        sudo dpkg -i "$tmp"
        rm -f "$tmp"

        if [ "$PORT" != "2016" ]; then
            sudo sed -i "s/^port:.*/port: $PORT/" /etc/minicluster/config.yaml 2>/dev/null || true
        fi

    # ── Fallback: tar.gz for non-debian or arm64 ─────────────────────────────
    else
        local tarball="minicluster-api-${VERSION}-linux-${arch}.tar.gz"
        local url="${base_url}/${tarball}"
        local tmpdir
        tmpdir=$(mktemp -d)

        echo "  → Downloading $tarball ..."
        curl -fsSL "$url" -o "${tmpdir}/${tarball}"

        echo "  → Extracting..."
        tar -xzf "${tmpdir}/${tarball}" -C "${tmpdir}" --strip-components=1 || \
            tar -xzf "${tmpdir}/${tarball}" -C "${tmpdir}"

        echo "  → Installing to /opt/minicluster ..."
        sudo mkdir -p /opt/minicluster
        sudo cp -r "${tmpdir}"/* /opt/minicluster/
        sudo ln -sf /opt/minicluster/minicluster-api /usr/bin/minicluster-api
        rm -rf "$tmpdir"

        if [ "$PORT" != "2016" ]; then
            sudo mkdir -p /etc/minicluster
            echo "port: $PORT" | sudo tee /etc/minicluster/config.yaml >/dev/null
        fi
    fi

    # ── Systemd service ───────────────────────────────────────────────────────
    if [ -z "$NO_SERVICE" ] && command -v systemctl &>/dev/null; then
        echo "  → Enabling systemd service..."
        sudo systemctl daemon-reload 2>/dev/null || true
        sudo systemctl enable minicluster 2>/dev/null || true
        sudo systemctl start minicluster 2>/dev/null || true
        echo "  ✓ Service enabled and started"
    fi

    echo ""
    echo "  ═══════════════════════════════════════════"
    echo "  ✓ MiniCluster v${VERSION} installed!"
    echo ""
    echo "  Open: http://localhost:${PORT}"
    echo "  Login: admin / admin"
    echo ""
    if command -v systemctl &>/dev/null; then
        echo "  Manage service:"
        echo "    sudo systemctl status minicluster"
        echo "    sudo systemctl restart minicluster"
        echo ""
    fi
    echo "  ═══════════════════════════════════════════"
    echo ""
}

main "$@"
