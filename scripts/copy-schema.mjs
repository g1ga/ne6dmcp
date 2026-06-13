/**
 * Cross-platform copy of the generated parameter schema into dist/ after tsc.
 * Replaces a Unix-only `mkdir -p && cp` so `npm run build` works on Windows too.
 */
import { mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src', 'schema', 'parameters.json');
const destDir = join(root, 'dist', 'schema');

mkdirSync(destDir, { recursive: true });
copyFileSync(src, join(destDir, 'parameters.json'));
console.log('copied src/schema/parameters.json -> dist/schema/parameters.json');
