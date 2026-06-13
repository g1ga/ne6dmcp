#!/usr/bin/env bash
# NS4MCP Linux uninstaller — removes the install dir and cleans the Claude config.
#
#   ./uninstall.sh                       # removes ~/.local/share/ns4mcp
#   NS4_INSTALL_DIR=/opt/ns4mcp ./uninstall.sh
set -euo pipefail

DEST="${NS4_INSTALL_DIR:-$HOME/.local/share/ns4mcp}"

if [ ! -d "$DEST" ]; then
  echo "NS4MCP is not installed at $DEST (set NS4_INSTALL_DIR if you used a custom path)."
  exit 0
fi

if [ -x "$DEST/runtime/node" ] && [ -f "$DEST/configure-claude.mjs" ]; then
  "$DEST/runtime/node" "$DEST/configure-claude.mjs" --uninstall || true
fi
rm -rf "$DEST"
echo "Removed $DEST and cleaned the Claude Desktop config. Restart Claude Desktop."
