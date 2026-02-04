#!/bin/bash
set -e

# MiniCluster Debian Package Builder (from prebuilt binaries)
# Usage: ./packaging/scripts/package-deb.sh <version> <api-publish-dir> [ui-build-dir] [cli-binary]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGING_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_DIR="$(dirname "$PACKAGING_DIR")"

VERSION="${1:-1.0.0}"
API_PUBLISH_DIR="${2:-$PROJECT_DIR/build/publish}"
UI_BUILD_DIR="${3:-}"
CLI_BINARY="${4:-}"
ARCH="amd64"
PKG_NAME="minicluster"
BUILD_DIR="$PROJECT_DIR/build/deb"
PKG_DIR="${BUILD_DIR}/${PKG_NAME}_${VERSION}_${ARCH}"

# Validate inputs
if [ ! -d "$API_PUBLISH_DIR" ]; then
    echo "Error: API publish directory not found: $API_PUBLISH_DIR"
    echo ""
    echo "Usage: ./package-deb.sh <version> <api-publish-dir> [ui-build-dir] [cli-binary]"
    echo ""
    echo "First build the API:"
    echo "  dotnet publish api/Innovatek.Parallel.MiniCluster.Api/Innovatek.Parallel.MiniCluster.Api.csproj -c Release -o ./build/publish --self-contained false"
    echo ""
    echo "Then package:"
    echo "  ./package-deb.sh 1.0.0 ./build/publish ui/build/client cli/build/mc"
    exit 1
fi

echo "Packaging MiniCluster ${VERSION} .deb from prebuilt binaries..."
echo "  API source: $API_PUBLISH_DIR"
if [ -n "$UI_BUILD_DIR" ] && [ -d "$UI_BUILD_DIR" ]; then
    echo "  UI source:  $UI_BUILD_DIR"
fi
if [ -n "$CLI_BINARY" ] && [ -f "$CLI_BINARY" ]; then
    echo "  CLI binary: $CLI_BINARY"
fi

# Clean previous builds
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"

# Create package directory structure
mkdir -p "${PKG_DIR}/DEBIAN"
mkdir -p "${PKG_DIR}/opt/minicluster"
mkdir -p "${PKG_DIR}/etc/minicluster"
mkdir -p "${PKG_DIR}/lib/systemd/system"
mkdir -p "${PKG_DIR}/var/lib/minicluster"
mkdir -p "${PKG_DIR}/var/log/minicluster"
mkdir -p "${PKG_DIR}/usr/bin"

echo "Copying prebuilt API binaries..."
cp -r "${API_PUBLISH_DIR}"/* "${PKG_DIR}/opt/minicluster/"

# Copy UI if provided
if [ -n "$UI_BUILD_DIR" ] && [ -d "$UI_BUILD_DIR" ]; then
    echo "Copying prebuilt UI..."
    mkdir -p "${PKG_DIR}/opt/minicluster/wwwroot"
    cp -r "${UI_BUILD_DIR}"/* "${PKG_DIR}/opt/minicluster/wwwroot/"
fi

# Copy CLI if provided
if [ -n "$CLI_BINARY" ] && [ -f "$CLI_BINARY" ]; then
    echo "Installing CLI binary..."
    cp "$CLI_BINARY" "${PKG_DIR}/usr/bin/mc"
    chmod 755 "${PKG_DIR}/usr/bin/mc"
fi

# Copy configuration (use from package or from publish dir)
if [ -f "${PKG_DIR}/opt/minicluster/appsettings.json" ]; then
    cp "${PKG_DIR}/opt/minicluster/appsettings.json" "${PKG_DIR}/etc/minicluster/"
elif [ -f "$PROJECT_DIR/api/Innovatek.Parallel.MiniCluster.Api/appsettings.json" ]; then
    cp "$PROJECT_DIR/api/Innovatek.Parallel.MiniCluster.Api/appsettings.json" "${PKG_DIR}/etc/minicluster/"
fi

# Update connection strings for production paths
sed -i 's|Data Source=data/controlcenter.db|Data Source=/var/lib/minicluster/controlcenter.db|g' "${PKG_DIR}/etc/minicluster/appsettings.json"
sed -i 's|Data Source=data/logs.db|Data Source=/var/lib/minicluster/logs.db|g' "${PKG_DIR}/etc/minicluster/appsettings.json"

# Create symlink for config
rm -f "${PKG_DIR}/opt/minicluster/appsettings.json"
ln -sf /etc/minicluster/appsettings.json "${PKG_DIR}/opt/minicluster/appsettings.json"

# Copy systemd service
cp "$PACKAGING_DIR/debian/minicluster.service" "${PKG_DIR}/lib/systemd/system/"

# Calculate installed size
INSTALLED_SIZE=$(du -sk "${PKG_DIR}" | cut -f1)

# Create control file
cat > "${PKG_DIR}/DEBIAN/control" << EOF
Package: ${PKG_NAME}
Version: ${VERSION}
Section: admin
Priority: optional
Architecture: ${ARCH}
Installed-Size: ${INSTALLED_SIZE}
Pre-Depends: wget
Recommends: aspnetcore-runtime-10.0 | dotnet-runtime-10.0
Maintainer: Innovatek <support@innovatek.com>
Homepage: https://github.com/innovatek/minicluster
Description: MiniCluster - Lightweight Process Management Platform
 MiniCluster is a modern process management and monitoring platform
 that provides a web-based control center for managing applications,
 services, and deployments across multiple machines.
EOF

# Copy maintainer scripts
cp "$PACKAGING_DIR/debian/postinst" "${PKG_DIR}/DEBIAN/"
cp "$PACKAGING_DIR/debian/prerm" "${PKG_DIR}/DEBIAN/"
cp "$PACKAGING_DIR/debian/postrm" "${PKG_DIR}/DEBIAN/"
chmod 755 "${PKG_DIR}/DEBIAN/postinst"
chmod 755 "${PKG_DIR}/DEBIAN/prerm"
chmod 755 "${PKG_DIR}/DEBIAN/postrm"

# Create conffiles
cat > "${PKG_DIR}/DEBIAN/conffiles" << EOF
/etc/minicluster/appsettings.json
EOF

# Set permissions on main executable
# if [ -f "${PKG_DIR}/opt/minicluster/Innovatek.ControlCenter.Api" ]; then
#     chmod 755 "${PKG_DIR}/opt/minicluster/Innovatek.ControlCenter.Api"
# fi

# Build the .deb package
echo "Creating .deb package..."
dpkg-deb --build --root-owner-group "${PKG_DIR}"

echo ""
echo "Package built successfully!"
echo "Location: ${PKG_DIR}.deb"
echo ""
echo "To install:"
echo "  sudo apt install ${PKG_DIR}.deb"
