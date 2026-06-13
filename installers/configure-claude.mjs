#!/usr/bin/env node
/**
 * configure-claude.mjs — add (or remove) the `nord-stage-4` MCP server entry in
 * the user's Claude Desktop config, pointing at the bundled Node runtime + app.
 *
 * Run by the BUNDLED node at install/uninstall time (so it always works, even on
 * a machine with no system Node). Shared by all three OS installers.
 *
 *   node configure-claude.mjs --install   [--install-dir DIR] [--home DIR] [--config FILE] [--channel N]
 *   node configure-claude.mjs --uninstall [--home DIR] [--config FILE]
 *
 * Path resolution:
 *   --install-dir : root of the installed bundle (contains runtime/ and app/).
 *                   Defaults to the directory this script lives in.
 *   --home        : the target user's home (needed when a macOS .pkg postinstall
 *                   runs as root and process.env.HOME is wrong).
 *   --config      : explicit path to claude_desktop_config.json (overrides everything).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir, platform } from 'node:os';

const SERVER_KEY = 'nord-stage-4';
const HERE = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t.startsWith('--')) {
      const key = t.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) a[key] = true;
      else { a[key] = next; i++; }
    } else a._.push(t);
  }
  return a;
}

/** Default Claude Desktop config path for the current OS, under `home`. */
function defaultConfigPath(home) {
  switch (platform()) {
    case 'darwin':
      return join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    case 'win32':
      // %APPDATA% is normally <home>\AppData\Roaming
      return join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
    default: // linux and others
      return join(process.env.XDG_CONFIG_HOME || join(home, '.config'), 'Claude', 'claude_desktop_config.json');
  }
}

/** Path to the bundled node binary and the server entrypoint, given the install root. */
function bundlePaths(installDir) {
  const nodeBin = platform() === 'win32' ? join(installDir, 'runtime', 'node.exe') : join(installDir, 'runtime', 'node');
  const entry = join(installDir, 'app', 'dist', 'index.js');
  return { nodeBin, entry };
}

function readConfig(file) {
  if (!existsSync(file)) return {};
  const text = readFileSync(file, 'utf8').trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(
      `Existing Claude config is not valid JSON:\n  ${file}\n  ${err.message}\n` +
      `Fix or remove it, then re-run the installer.`,
    );
  }
}

function backup(file) {
  if (!existsSync(file)) return null;
  // Avoid Date in a way that's still unique-ish without locale issues.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = `${file}.bak-${stamp}`;
  copyFileSync(file, dest);
  return dest;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const uninstall = !!args.uninstall;
  const home = typeof args.home === 'string' ? args.home : homedir();
  const installDir = typeof args['install-dir'] === 'string' ? resolve(args['install-dir']) : HERE;
  const configPath = typeof args.config === 'string' ? resolve(args.config) : defaultConfigPath(home);
  const channel = typeof args.channel === 'string' ? args.channel : '1';

  const config = readConfig(configPath);
  if (!config.mcpServers || typeof config.mcpServers !== 'object') config.mcpServers = {};

  if (uninstall) {
    if (!config.mcpServers[SERVER_KEY]) {
      console.log(`No "${SERVER_KEY}" entry found in ${configPath} — nothing to remove.`);
      return;
    }
    const saved = backup(configPath);
    delete config.mcpServers[SERVER_KEY];
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
    console.log(`Removed "${SERVER_KEY}" from ${configPath}`);
    if (saved) console.log(`Backup: ${saved}`);
    console.log('Restart Claude Desktop to apply.');
    return;
  }

  const { nodeBin, entry } = bundlePaths(installDir);
  if (!existsSync(nodeBin)) throw new Error(`Bundled Node runtime not found at ${nodeBin}`);
  if (!existsSync(entry)) throw new Error(`Server entrypoint not found at ${entry}`);

  const saved = backup(configPath);
  mkdirSync(dirname(configPath), { recursive: true });

  config.mcpServers[SERVER_KEY] = {
    command: nodeBin,
    args: [entry],
    env: { NS4_CHANNEL: String(channel) },
  };
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

  console.log(`Configured Claude Desktop:`);
  console.log(`  config : ${configPath}`);
  console.log(`  server : ${SERVER_KEY} -> ${nodeBin} ${entry}`);
  if (saved) console.log(`  backup : ${saved}`);
  console.log('\nDone. Quit and reopen Claude Desktop to load the Nord Stage 4 tools.');
}

try {
  main();
} catch (err) {
  console.error(`configure-claude: ${err.message}`);
  process.exit(1);
}
