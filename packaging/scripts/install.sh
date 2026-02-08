#!/usr/bin/env bash
set -euo pipefail

#
# MiniCluster One-Line Installer
#
# Usage:
#   curl -fsSL https://get.minicluster.dev | bash
#
# Options (via environment variables):
#   MINICLUSTER_VERSION=1.0.0    Specific version (default: latest)
#   MINICLUSTER_DIR=/opt/minicluster  Install directory
#   MINICLUSTER_PORT=5147        Port to bind (written to config)
#

VERSION="${MINICLUSTER_VERSION:-latest}"
INSTALL_DIR="${MINICLUSTER_DIR:-/opt/minicluster}"
PORT="${MINICLUSTER_PORT:-5147}"
GITHUB_REPO="innovatek/minicluster"    # TODO: Update with actual repo
BASE_URL="https://github.com/$GITHUB_REPO/releases"

# ── Detect platform ─────────────────────────────────────────

detect_platform() {
    local os arch rid

    os="$(uname -s | tr '[:upper:]' '[:lower:]')"
    arch="$(uname -m)"

    case "$os" in
        linux)  os="linux" ;;
        darwin) os="osx" ;;
        *)      echo "Error: Unsupported OS: $os"; exit 1 ;;
    esac

    case "$arch" in
        x86_64|amd64)   arch="x64" ;;
        aarch64|arm64)  arch="arm64" ;;
        *)              echo "Error: Unsupported architecture: $arch"; exit 1 ;;
    esac

    rid="${os}-${arch}"
    echo "$rid"
}

# ── Main ─────────────────────────────────────────────────────

main() {
    echo ""
    echo "  ╔══════════════════════════════════════╗"
    echo "  ║     MiniCluster Installer            ║"
    echo "  ╚══════════════════════════════════════╝"
    echo ""

    local rid
    rid="$(detect_platform)"
    echo "  Platform:      $rid"
    echo "  Version:       $VERSION"
    echo "  Install to:    $INSTALL_DIR"
    echo "  Port:          $PORT"
    echo ""

    # Resolve version
    if [ "$VERSION" = "latest" ]; then
        echo "  → Fetching latest release..."
        VERSION=$(curl -fsSL "https://api.github.com/repos/$GITHUB_REPO/releases/latest" \
            | grep '"tag_name"' | sed -E 's/.*"v?([^"]+)".*/\1/')
        echo "  → Latest version: $VERSION"
    fi

    # Download
    local filename="minicluster-${VERSION}-${rid}.tar.gz"
    local url="$BASE_URL/download/v${VERSION}/${filename}"

    echo "  → Downloading $filename..."
    local tmpdir
    tmpdir="$(mktemp -d)"

    if ! curl -fsSL "$url" -o "$tmpdir/$filename"; then
        echo ""
        echo "  Error: Failed to download from $url"
        echo "  Check the version and try again."
        rm -rf "$tmpdir"
        exit 1
    fi

    # Extract
    echo "  → Extracting..."
    tar -xzf "$tmpdir/$filename" -C "$tmpdir"

    # Install
    echo "  → Installing to $INSTALL_DIR..."
    sudo mkdir -p "$INSTALL_DIR"
    sudo cp -r "$tmpdir"/minicluster* "$INSTALL_DIR/" 2>/dev/null || \
        sudo cp -r "$tmpdir"/* "$INSTALL_DIR/"
    sudo chmod +x "$INSTALL_DIR/minicluster"

    # Create symlink
    sudo ln -sf "$INSTALL_DIR/minicluster" /usr/local/bin/minicluster

    # Create data directory
    sudo mkdir -p /var/lib/minicluster
    sudo chown "$(whoami)" /var/lib/minicluster

    # Clean up
    rm -rf "$tmpdir"

    # Create systemd service (optional)
    if command -v systemctl &>/dev/null; then
        echo "  → Creating systemd service..."
        sudo tee /etc/systemd/system/minicluster.service >/dev/null <<SYSTEMD
[Unit]
Description=MiniCluster Process Orchestrator
After=network.target

[Service]
Type=simple
ExecStart=$INSTALL_DIR/minicluster --urls "http://0.0.0.0:$PORT"
WorkingDirectory=$INSTALL_DIR
Restart=always
RestartSec=5
Environment=ASPNETCORE_ENVIRONMENT=Production
Environment=DOTNET_CONTENTROOT=$INSTALL_DIR

[Install]
WantedBy=multi-user.target
SYSTEMD
        sudo systemctl daemon-reload
    fi

    echo ""
    echo "  ═══════════════════════════════════════"
    echo "  ✓ MiniCluster installed!"
    echo ""
    echo "  Start now:"
    echo "    minicluster --urls \"http://0.0.0.0:$PORT\""
    echo ""
    if command -v systemctl &>/dev/null; then
        echo "  Or start as a service:"
        echo "    sudo systemctl enable --now minicluster"
        echo ""
    fi
    echo "  Then open: http://localhost:$PORT"
    echo "  Default login: admin / admin"
    echo "  ═══════════════════════════════════════"
    echo ""
}

main "$@"
