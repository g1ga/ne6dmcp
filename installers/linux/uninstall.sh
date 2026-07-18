#!/usr/bin/env bash
# NE6DMCP Linux uninstaller — removes the install dir and cleans the Claude config.
#
#   ./uninstall.sh                       # removes ~/.local/share/ne6dmcp
#   NE6_INSTALL_DIR=/opt/ne6dmcp ./uninstall.sh
set -euo pipefail

DEST="${NE6_INSTALL_DIR:-$HOME/.local/share/ne6dmcp}"

if [ ! -d "$DEST" ]; then
  echo "NE6DMCP is not installed at $DEST (set NE6_INSTALL_DIR if you used a custom path)."
  exit 0
fi

if [ -x "$DEST/runtime/node" ] && [ -f "$DEST/configure-claude.mjs" ]; then
  "$DEST/runtime/node" "$DEST/configure-claude.mjs" --uninstall || true
fi
rm -rf "$DEST"
echo "Removed $DEST and cleaned the Claude Desktop config. Restart Claude Desktop."
