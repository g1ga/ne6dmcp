#!/usr/bin/env bash
# NS4MCP Linux installer — copies the bundled runtime + app into your home and
# configures Claude Desktop. No root, no prerequisites.
#
#   ./install.sh                 # installs to ~/.local/share/ns4mcp
#   NS4_INSTALL_DIR=/opt/ns4mcp ./install.sh
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="${NS4_INSTALL_DIR:-$HOME/.local/share/ns4mcp}"

echo "Installing NS4MCP -> $DEST"
mkdir -p "$DEST"
cp -R "$SRC/runtime" "$SRC/app" "$DEST/"
cp "$SRC/configure-claude.mjs" "$DEST/"
[ -f "$SRC/VERSION" ] && cp "$SRC/VERSION" "$DEST/" || true
[ -f "$SRC/LICENSE" ] && cp "$SRC/LICENSE" "$DEST/" || true
chmod +x "$DEST/runtime/node"

"$DEST/runtime/node" "$DEST/configure-claude.mjs" --install --install-dir "$DEST"

echo
echo "Installed. Quit and reopen Claude Desktop to load the Nord Stage 4 tools."
echo "To remove later:  $DEST/uninstall.sh   (or re-download and run uninstall.sh)"
cp "$SRC/uninstall.sh" "$DEST/uninstall.sh" 2>/dev/null && chmod +x "$DEST/uninstall.sh" || true
