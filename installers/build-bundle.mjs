#!/usr/bin/env node
/**
 * build-bundle.mjs — assemble a self-contained NE6DMCP bundle for one OS/arch:
 * a portable Node runtime + the built app + its production node_modules, so the
 * end user needs nothing preinstalled.
 *
 *   node installers/build-bundle.mjs --platform darwin --arch arm64 --out dist-bundle/macos-arm64
 *
 * Options:
 *   --platform  darwin | win32 | linux   (default: process.platform)
 *   --arch      x64 | arm64              (default: process.arch)
 *   --node      Node version to embed    (default: NODE_BUNDLE_VERSION below)
 *   --out       output bundle directory  (required)
 *
 * Produces:
 *   <out>/runtime/node[.exe]          portable Node runtime
 *   <out>/app/dist/...                compiled server + schema
 *   <out>/app/node_modules/...        production deps (one matching midi prebuild)
 *   <out>/app/package.json
 *   <out>/configure-claude.mjs        the Claude Desktop config patcher
 *   <out>/LICENSE, <out>/VERSION
 *
 * Cross-platform extraction relies on `tar` (bsdtar on the GitHub Windows runners
 * reads .zip too), so this can build any target from any host CI runner.
 */

import { execFileSync } from 'node:child_process';
import {
  existsSync, mkdirSync, rmSync, cpSync, copyFileSync, writeFileSync, readFileSync, readdirSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const NODE_BUNDLE_VERSION = '22.11.0'; // LTS "Jod"; N-API v7 compatible with @julusian/midi prebuilds

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) { a[argv[i].slice(2)] = argv[i + 1]; i++; }
  }
  return a;
}

function run(cmd, cmdArgs, opts = {}) {
  return execFileSync(cmd, cmdArgs, { stdio: 'inherit', ...opts });
}

// npm is a .cmd shim on Windows; Node's execFile can't launch it directly, so
// route npm through a shell on every platform (harmless on macOS/Linux).
function npm(cmdArgs, opts = {}) {
  return execFileSync('npm', cmdArgs, { stdio: 'inherit', shell: true, ...opts });
}

/** Map our platform/arch to the official Node dist file name + the binary inside it. */
function nodeDist(platform, arch, version) {
  const v = `v${version}`;
  if (platform === 'win32') {
    return { file: `node-${v}-win-${arch}.zip`, dir: `node-${v}-win-${arch}`, bin: 'node.exe', binDir: '' };
  }
  const plat = platform === 'darwin' ? 'darwin' : 'linux';
  const ext = plat === 'darwin' ? 'tar.gz' : 'tar.xz';
  return { file: `node-${v}-${plat}-${arch}.${ext}`, dir: `node-${v}-${plat}-${arch}`, bin: 'node', binDir: 'bin' };
}

/** Keep only the @julusian/midi prebuild that matches the target; drop the rest. */
function pruneMidiPrebuilds(nodeModulesDir, platform, arch) {
  const prebuilds = join(nodeModulesDir, '@julusian', 'midi', 'prebuilds');
  if (!existsSync(prebuilds)) return;
  // Prefer glibc on linux (the typical desktop). musl users can fall back to source.
  const keep = `midi-${platform}-${arch}`;
  for (const entry of readdirSync(prebuilds)) {
    if (entry !== keep) rmSync(join(prebuilds, entry), { recursive: true, force: true });
  }
  if (!existsSync(join(prebuilds, keep))) {
    throw new Error(`No @julusian/midi prebuild for ${keep}. Available are reduced; check the package.`);
  }
  console.log(`  pruned midi prebuilds -> kept ${keep}`);
}

async function downloadNode(platform, arch, version, cacheDir) {
  const { file, dir, bin, binDir } = nodeDist(platform, arch, version);
  mkdirSync(cacheDir, { recursive: true });
  const archivePath = join(cacheDir, file);
  if (!existsSync(archivePath)) {
    const url = `https://nodejs.org/dist/v${version}/${file}`;
    console.log(`  downloading ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Node download failed: HTTP ${res.status} for ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(archivePath, buf);
  } else {
    console.log(`  using cached ${file}`);
  }
  const extractDir = join(cacheDir, `extract-${platform}-${arch}`);
  rmSync(extractDir, { recursive: true, force: true });
  mkdirSync(extractDir, { recursive: true });
  // bsdtar (mac/linux/Windows runners) extracts both tarballs and zips.
  run('tar', ['-xf', archivePath, '-C', extractDir]);
  const binPath = join(extractDir, dir, binDir, bin);
  if (!existsSync(binPath)) throw new Error(`Node binary not found after extract: ${binPath}`);
  return { binPath, bin };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const platform = args.platform || process.platform;
  const arch = args.arch || process.arch;
  const version = args.node || NODE_BUNDLE_VERSION;
  if (!args.out) throw new Error('--out <dir> is required');
  const out = resolve(args.out);

  if (!['darwin', 'win32', 'linux'].includes(platform)) throw new Error(`unsupported --platform ${platform}`);
  if (!['x64', 'arm64'].includes(arch)) throw new Error(`unsupported --arch ${arch}`);

  console.log(`Building NE6DMCP bundle: ${platform}/${arch}, Node ${version}`);

  // 0. Ensure the app is built and production deps are installed.
  if (!existsSync(join(ROOT, 'dist', 'index.js'))) {
    console.log('dist/ missing — running `npm run build`');
    npm(['run', 'build'], { cwd: ROOT });
  }

  // Stage a clean production node_modules in a temp dir so we never touch the dev tree.
  const stage = join(tmpdir(), `ne6dmcp-stage-${platform}-${arch}`);
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });
  copyFileSync(join(ROOT, 'package.json'), join(stage, 'package.json'));
  if (existsSync(join(ROOT, 'package-lock.json'))) copyFileSync(join(ROOT, 'package-lock.json'), join(stage, 'package-lock.json'));
  console.log('  installing production dependencies (npm ci --omit=dev)');
  npm(['ci', '--omit=dev', '--no-audit', '--no-fund'], { cwd: stage });
  pruneMidiPrebuilds(join(stage, 'node_modules'), platform, arch);

  // 1. Fresh output tree.
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, 'runtime'), { recursive: true });
  mkdirSync(join(out, 'app'), { recursive: true });

  // 2. Portable Node runtime.
  const cacheDir = join(ROOT, '.cache', 'node-runtimes');
  const { binPath, bin } = await downloadNode(platform, arch, version, cacheDir);
  const destBin = join(out, 'runtime', bin);
  copyFileSync(binPath, destBin);
  if (platform !== 'win32') run('chmod', ['+x', destBin]);
  console.log(`  runtime -> runtime/${bin}`);

  // 3. App: dist + production node_modules + package.json.
  cpSync(join(ROOT, 'dist'), join(out, 'app', 'dist'), { recursive: true });
  cpSync(join(stage, 'node_modules'), join(out, 'app', 'node_modules'), { recursive: true });
  copyFileSync(join(ROOT, 'package.json'), join(out, 'app', 'package.json'));
  console.log('  app -> app/dist, app/node_modules, app/package.json');

  // 4. Config patcher + license + version marker.
  copyFileSync(join(HERE, 'configure-claude.mjs'), join(out, 'configure-claude.mjs'));
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  writeFileSync(join(out, 'VERSION'), `${pkg.version}\n`);
  if (existsSync(join(ROOT, 'LICENSE'))) copyFileSync(join(ROOT, 'LICENSE'), join(out, 'LICENSE'));

  console.log(`\nBundle ready: ${out}`);
  console.log(`  (Node ${version} ${platform}/${arch} + app + ${readdirSync(join(out, 'app', 'node_modules')).length} dep dirs)`);
}

main().catch((err) => {
  console.error(`build-bundle failed: ${err.message}`);
  process.exit(1);
});
