#!/usr/bin/env bash
# NE6DMCP Linux installer — copies the bundled runtime + app into your home and
# configures Claude Desktop. No root, no prerequisites.
#
#   ./install.sh                 # installs to ~/.local/share/ne6dmcp
#   NE6_INSTALL_DIR=/opt/ne6dmcp ./install.sh
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="${NE6_INSTALL_DIR:-$HOME/.local/share/ne6dmcp}"

echo "Installing NE6DMCP -> $DEST"
mkdir -p "$DEST"
cp -R "$SRC/runtime" "$SRC/app" "$DEST/"
cp "$SRC/configure-claude.mjs" "$DEST/"
[ -f "$SRC/VERSION" ] && cp "$SRC/VERSION" "$DEST/" || true
[ -f "$SRC/LICENSE" ] && cp "$SRC/LICENSE" "$DEST/" || true
chmod +x "$DEST/runtime/node"

"$DEST/runtime/node" "$DEST/configure-claude.mjs" --install --install-dir "$DEST"

echo
echo "Installed. Quit and reopen Claude Desktop to load the Nord Electro 6D tools."
echo "To remove later:  $DEST/uninstall.sh   (or re-download and run uninstall.sh)"
cp "$SRC/uninstall.sh" "$DEST/uninstall.sh" 2>/dev/null && chmod +x "$DEST/uninstall.sh" || true
